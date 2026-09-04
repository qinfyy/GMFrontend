/**
 * GM API 客户端。
 *
 * 服务端只有一个端点：GET /api/gm?cmd=<命令>&uid=<UID>&<参数>=<值>
 * - 成功：{ success: true, result: GameMasterResult }
 * - 失败：{ error: string, error_description? }，HTTP 400/401/404/500
 * - 鉴权：ApiKey 非空时用 Authorization: Bearer <key> 头
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { SettingsStore } from './settings.store';

/**
 * 服务端响应字段为 camelCase（System.Text.Json 默认策略），
 * 已用真实服务器 cmd=help 响应核对。
 */
export interface GmCommandHelp {
    label: string;
    aliases: string[];
    description: string;
    usage: string[];
    notes: string[];
}

export interface GmResult {
    uid: number | null;
    command: string;
    before: unknown;
    after: unknown;
    amount: number | null;
    syncDelivered: boolean;
    options?: Record<string, number | null> | null;
    help?: GmCommandHelp[] | null;
}

/** 归一化后的调用错误，message 已翻译为中文提示 */
export class GmApiError extends Error {
    constructor(
        readonly status: number,
        readonly code: string,
        readonly description: string | undefined,
        message: string,
    ) {
        super(message);
    }
}

@Injectable({ providedIn: 'root' })
export class GmApiService {
    private readonly http = inject(HttpClient);
    private readonly settings = inject(SettingsStore);

    /**
     * 执行一条 GM 命令。params 中的空值会被剔除；
     * cmd 是必填参数，uid 由调用方决定是否传入。
     */
    async execute(params: Record<string, string>): Promise<GmResult> {
        const query = Object.entries(params).filter(([, v]) => v !== '' && v != null);
        const httpParams = new HttpParams({ fromObject: Object.fromEntries(query) });
        const headers = this.authHeaders();

        const url = `${this.settings.baseUrl() || ''}/api/gm`;
        try {
            const body = await firstValueFrom(
                this.http.get<{ success: boolean; result: GmResult }>(url, { params: httpParams, headers }),
            );
            return body.result;
        } catch (error) {
            throw this.toGmError(error);
        }
    }

    /** 拉取服务端全部命令说明（cmd=help），与 Handbook 同源 */
    async fetchHelp(): Promise<GmCommandHelp[]> {
        const result = await this.execute({ cmd: 'help' });
        if (!result.help?.length) {
            throw new GmApiError(0, 'empty_help', undefined, '服务端未返回命令说明');
        }
        return result.help;
    }

    private authHeaders(): HttpHeaders | undefined {
        const key = this.settings.apiKey();
        return key ? new HttpHeaders({ Authorization: `Bearer ${key}` }) : undefined;
    }

    private toGmError(error: unknown): GmApiError {
        if (error instanceof GmApiError) return error;

        if (error instanceof HttpErrorResponse) {
            const body = error.error as { error?: string; error_description?: string } | null;
            const code = body?.error ?? '';
            const description = body?.error_description;
            let message = describeStatus(error.status, code);
            // 服务端业务异常（GameMasterCommandException 等）直接透传原文
            if (!code && typeof error.error === 'string' && error.error.length < 500) {
                message = error.error;
            }
            return new GmApiError(error.status, code, description, description ? `${message}：${description}` : message);
        }
        return new GmApiError(0, 'network', undefined, '网络错误：无法连接服务器，请检查服务器地址');
    }
}

function describeStatus(status: number, code: string): string {
    switch (status) {
        case 400:
            return code === 'invalid_request' ? '请求格式无效' : '命令执行失败';
        case 401:
            return code === 'invalid_token' ? 'ApiKey 无效' : '未认证：请在设置中填写 ApiKey';
        case 404:
            return '玩家不存在（UID 错误或尚未创建角色）';
        case 500:
            return '服务器内部错误，请查看服务端日志';
        default:
            return `请求失败（HTTP ${status}）`;
    }
}
