/**
 * GM API 客户端。
 *
 * 服务端只有一个端点：GET /api/gm?content=<整条 GM 命令行>
 * 鉴权：ApiKey 非空时用 Authorization: Bearer <key> 头（也支持 access_token 查询参数）。
 *
 * 上游 2026-09 重构后，命令与参数不再拆成查询串，而是整条命令行塞进 content；
 * 响应也不再是 before/after 结构化对象，而是逐条人类可读的 messages：
 *
 *   成功：{ success: true,  errorDescription: null,        messages: [...] }
 *   失败：{ success: false, errorDescription: "文案或短码", messages: [] }，HTTP 400/401/404/500
 *
 * 只认这一版外壳，不做多版本兼容。
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { SettingsStore } from './settings.store';

/** 服务端命令说明投影（help 与 Handbook 同源，由 help 文本解析得到） */
export interface GmCommandHelp {
    label: string;
    aliases: string[];
    description: string;
    usage: string[];
    notes: string[];
}

/** 归一化后的执行结果 */
export interface GmResult {
    messages: string[];
}

/** 服务端 GmCommandResJson（当前版本） */
interface GmResponse {
    success: boolean;
    errorDescription: string | null;
    messages: string[];
}

/** 归一化后的调用错误，message 已翻译为中文提示 */
export class GmApiError extends Error {
    constructor(
        readonly status: number,
        readonly code: string,
        message: string,
    ) {
        super(message);
    }
}

/** 服务端以短码形式回传的错误；其余情况 errorDescription 就是中文原文 */
const ERROR_CODES: Record<string, string> = {
    player_not_found: '玩家不存在（UID 错误或尚未创建角色）',
    numeric_overflow: '数值超出服务端可处理范围',
    internal_error: '服务器内部错误，请查看服务端日志',
    invalid_token: 'ApiKey 无效',
    unauthorized: '未认证：请在设置中填写 ApiKey',
    invalid_request: '请求格式无效',
};

@Injectable({ providedIn: 'root' })
export class GmApiService {
    private readonly http = inject(HttpClient);
    private readonly settings = inject(SettingsStore);

    /**
     * 执行一条 GM 命令行。content 为空时直接抛错，不发出请求。
     * 传入的可以是完整命令行（如 `/give hcoin x100 @1`），前缀斜杠可省略。
     */
    async execute(content: string): Promise<GmResult> {
        const line = content.trim();
        if (!line) {
            throw new GmApiError(0, 'empty_command', '命令不能为空');
        }

        const params = new HttpParams({ fromObject: { content: line } });
        const headers = this.authHeaders();
        const url = `${this.settings.baseUrl().replace(/\/$/, '')}/api/gm`;

        try {
            const body = await firstValueFrom(this.http.get<GmResponse>(url, { params, headers }));
            // 服务端失败走非 2xx，正常到不了这里；真出现时也要报出来
            if (body.success === false) {
                throw new GmApiError(200, '', body.errorDescription ?? '命令执行失败');
            }
            return { messages: body.messages ?? [] };
        } catch (error) {
            throw this.toGmError(error);
        }
    }

    /** 拉取服务端全部命令说明（/help），与 Handbook 同源 */
    async fetchHelp(): Promise<GmCommandHelp[]> {
        const result = await this.execute('/help');
        const commands = parseHelpText(result.messages);
        if (commands.length === 0) {
            throw new GmApiError(0, 'empty_help', '服务端未返回可解析的命令说明');
        }
        return commands;
    }

    /** 拉取单条命令的详细说明（/help <命令名>），主要为了拿到 notes */
    async fetchCommandDetail(label: string): Promise<GmCommandHelp | null> {
        const result = await this.execute(`/help ${label}`);
        return parseHelpText(result.messages)[0] ?? null;
    }

    private authHeaders(): HttpHeaders | undefined {
        const key = this.settings.apiKey();
        return key ? new HttpHeaders({ Authorization: `Bearer ${key}` }) : undefined;
    }

    private toGmError(error: unknown): GmApiError {
        if (error instanceof GmApiError) return error;

        if (error instanceof HttpErrorResponse) {
            const body = error.error as GmResponse | null;
            const text = typeof body?.errorDescription === 'string' ? body.errorDescription.trim() : '';
            const known = ERROR_CODES[text];
            // 已知短码才作为 code 单独展示，中文原文直接作为提示文案
            return new GmApiError(error.status, known ? text : '', known || text || fallbackMessage(error.status));
        }
        return new GmApiError(0, 'network', '网络错误：无法连接服务器，请检查服务器地址');
    }
}

function fallbackMessage(status: number): string {
    switch (status) {
        case 400:
            return '命令执行失败';
        case 401:
            return '未认证：请在设置中填写 ApiKey';
        case 404:
            return '目标不存在';
        case 500:
            return '服务器内部错误，请查看服务端日志';
        default:
            return `请求失败（HTTP ${status}）`;
    }
}

/**
 * 解析 /help 的文本输出为结构化命令列表。
 *
 * 服务端两种输出共用同一套行格式（OtherCommands.ExecuteHelp）：
 *   共 12 条命令：                    ← 列表模式表头
 *   give（别名 g、item）：单件发放…   ← 命令行（别名可缺省）
 *   /give <id> [x数量] …             ← 用法行，以 / 开头
 *   注: 支持通过 @uid …               ← 单命令模式的补充说明
 *
 * 因此同一个解析器同时服务 /help 与 /help <命令名>：
 * 列表模式不出现「注」行，详情模式不出现表头，两条规则各自落空即可。
 *
 * 先按换行把 messages 摊平成行，再逐行识别（兼容历史上把多行打包进一条 message 的写法）。
 */
export function parseHelpText(messages: readonly string[]): GmCommandHelp[] {
    const commands: GmCommandHelp[] = [];
    let current: GmCommandHelp | null = null;

    const lines: string[] = [];
    for (const message of messages) {
        for (const piece of message.split(/\r?\n/)) {
            lines.push(piece);
        }
    }

    for (const raw of lines) {
        const line = raw.replace(/\s+$/, '');
        if (!line.trim()) continue;

        const note = /^\s*注[:：]\s*(.*)$/.exec(line);
        if (note && current) {
            current.notes.push(note[1].trim());
            continue;
        }

        const usage = /^\s*(\/.+)$/.exec(line);
        if (usage && current) {
            current.usage.push(usage[1].trim());
            continue;
        }

        // 命令行：label（别名 a、b）：描述 —— 别名与全角冒号都可能缺省
        const head = /^\s*([A-Za-z][A-Za-z0-9_]*)\s*(?:（别名[:：]?\s*([^）]*)）)?\s*[:：]\s*(.*)$/.exec(line);
        if (head) {
            current = {
                label: head[1],
                aliases: head[2]
                    ? head[2]
                          .split(/[、,，\s]+/)
                          .map(value => value.trim())
                          .filter(Boolean)
                    : [],
                description: head[3].trim(),
                usage: [],
                notes: [],
            };
            commands.push(current);
            continue;
        }
        // 其余为说明性文字行（如「共 12 条命令：」），忽略
    }

    return commands;
}
