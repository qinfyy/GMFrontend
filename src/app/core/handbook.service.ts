/**
 * Handbook.txt 解析服务。
 *
 * Handbook 由服务器启动时生成（Sv/GameMaster/GameMasterHandbookGenerator.cs），
 * 结构为「[分区名] + 制表符分隔的数据行」，数据行尾注是 key=value 形式：
 *
 *   [currency]
 *   currency  hcoin  水晶  alias=239  GM=give&uid=<UID>&type=currency&id=hcoin&amount=<数量>
 *
 * 这里把它解析成结构化目录，供各功能页做选择器数据源。
 *
 * 关于 GM 模板：2026-09 上游把接口改成「整条命令行放进 content」，但 Handbook 生成器
 * 只迁移了一部分分区——skin / potential / role / 数字货币已经是 `/give skin 17001 [@uid]`
 * 的命令行形式，currency 首行、剧情关卡、九霄任务/关卡/成就仍是旧的 `cmd&uid=..&k=v` 查询串。
 * 因此这里提供 parseGmTemplate / normalizeGmTemplate，把两种形式统一成可执行的命令行。
 */
import { Injectable, signal } from '@angular/core';
import { cmdLine } from './command-line';

/** 一条 Handbook 数据行（已解析出 ID / 名称 / 尾注） */
export interface HandbookEntry {
    /** 所属分区名（用于全部分区搜索显示来源） */
    section: string;
    /** 行首类型标记（如 currency / weapon / role） */
    type: string;
    id: string;
    name: string;
    /** key=value 尾注，如 alias、max_level、talent、GM */
    attrs: Record<string, string>;
}

@Injectable({ providedIn: 'root' })
export class HandbookService {
    private readonly _sections = signal<Map<string, HandbookEntry[]>>(new Map());
    private readonly _loaded = signal(false);
    private readonly _failed = signal(false);

    readonly loaded = this._loaded.asReadonly();
    readonly failed = this._failed.asReadonly();

    /** 取某个分区的全部条目；未加载或分区不存在时返回空数组 */
    section(name: string): HandbookEntry[] {
        return this._sections().get(name) ?? [];
    }

    /** 应用启动时调用一次；失败不阻塞 UI，降级为仅控制台模式 */
    async load(): Promise<void> {
        try {
            const response = await fetch('Handbook.txt');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const text = await response.text();
            this._sections.set(parse(text));
            this._loaded.set(true);
        } catch {
            // 解析或加载失败：保留空目录并标记失败，页面据此隐藏选择器
            this._failed.set(true);
        }
    }
}

/**
 * 解析 Handbook 全文。
 * 规则：
 * - `[section]` 行开启新分区；
 * - 数据行按所处分隔符切列后：第 1 列作为 type，第 2 列必为 ID；
 *   后续列若为 key=value 形式则入 attrs，第一个非 key=value 列
 *   作为 name（无则用 id 兜底）；
 * - 分区内的说明文字行（不含分隔符的普通文本）跳过。
 *
 * 同一 Handbook 内的不同分区可能用不同分隔符，handleColumns 自动检测：
 * 1. 制表符分隔：传统区（currency / weapon / role / 九霄任务 等）
 *    例：currency \t hcoin \t 水晶 \t alias=239 \t GM=...
 * 2. 2+ 空格 + 单空格分隔：传承篇 / 新生篇（普通剧情关卡）
 *    例：第一章  L1-1 8351 type=1 GM=storycompleted&...&to=8351
 *    章节标题与 id 之间用 2+ 空格；其余列用单空格。
 */
/**
 * 解析 Handbook 全文。
 * 规则：
 * - `[section]` 括号行开启新分区；
 * - 「XXXX目录」+ 下划线分隔行的裸标题也开启新分区
 *   （如「崩坏学园篇章节目录 / ------------------」，无括号）；
 * - 数据行按 splitColumns 切列（见其注释）；
 * - 分区内的说明文字行（切不出 2 列）跳过。
 *
 * 支持的行格式：
 * 1. tab 分隔：type <TAB> id <TAB> name <TAB> key=value ...
 *    例：currency \t hcoin \t 水晶 \t alias=239 \t GM=...
 *    例：chapter \t 2 \t 今我来思 \t type=3 \t GM=...（崩坏学园篇章节）
 * 2. 单空格分隔（传承篇/新生篇）：第X章 关卡名 id type=N GM=...
 */
function parse(text: string): Map<string, HandbookEntry[]> {
    const sections = new Map<string, HandbookEntry[]>();
    let current: string | null = null;
    let prevLine = '';

    for (const rawLine of text.split('\n')) {
        const line = rawLine.replace(/\r$/, '');
        if (!line.trim()) { prevLine = line; continue; }

        const headerMatch = /^\[(.+)\]\s*$/.exec(line);
        if (headerMatch) {
            current = headerMatch[1];
            if (!sections.has(current)) sections.set(current, []);
            prevLine = line;
            continue;
        }

        // 裸标题分区：上一行是非空普通文本（如「崩坏学园篇章节目录」），
        // 当前行是 3+ 个连字符的下划线分隔行
        if (/^-{3,}$/.test(line.trim()) && prevLine.trim() && !prevLine.includes('\t')) {
            current = prevLine.trim();
            if (!sections.has(current)) sections.set(current, []);
            prevLine = line;
            continue;
        }

        if (current === null) { prevLine = line; continue; }

        const columns = splitColumns(line);
        if (columns.length < 2) { prevLine = line; continue; }

        // 传承篇/新生篇：tokens = [第X章, 关卡名, id, type=N, GM=...]
        // 选择器期望「id  章节名」两列，所以 id = tokens[2]、name = 章节 + 关卡名
        const isChapterRow = columns[0].startsWith('第');

        let type: string;
        let id: string;
        let name: string | undefined;
        const attrs: Record<string, string> = {};

        if (isChapterRow) {
            type = 'level';
            id = columns[2];
            name = `${columns[0]} ${columns[1]}`;
            for (let i = 3; i < columns.length; i++) {
                const col = columns[i];
                const eq = col.indexOf('=');
                if (eq > 0) attrs[col.slice(0, eq)] = col.slice(eq + 1);
            }
        } else {
            type = columns[0];
            id = columns[1];
            for (let i = 2; i < columns.length; i++) {
                const col = columns[i];
                const eq = col.indexOf('=');
                if (eq > 0) {
                    attrs[col.slice(0, eq)] = col.slice(eq + 1);
                } else if (name === undefined) {
                    name = col;
                } else {
                    name += ' ' + col;
                }
            }
        }

        sections.get(current)!.push({
            section: current,
            type,
            id,
            name: name ?? id,
            attrs,
        });
        prevLine = line;
    }
    return sections;
}

/** 自动检测分隔符并切列
 * - 有 \t：tab 分隔（传统 / 九霄任务等）
 * - 无 \t 但首列以「第」开头且至少 4 token：传承篇/新生篇
 *   tokens[0]=第X章 tokens[1]=关卡名 tokens[2]=ID tokens[3]=type=N tokens[4]=GM=...
 * - 其余单空格：视为说明行（无 tab 也非第 X 章），返回空让 parse 跳过
 */
function splitColumns(line: string): string[] {
    if (line.includes('\t')) {
        return line.split('\t').map(v => v.trim());
    }
    const tokens = line.trim().split(/\s+/).filter(Boolean);
    if (tokens.length >= 4 && tokens[0].startsWith('第')) {
        // 保留原始 tokens（type 取 chapter 句，id 取 tokens[2]，name 取 chapter + 关卡名）
        return tokens;
    }
    return [];
}

// ---------------------------------------------------------------------------
// GM 模板解析与归一化
// ---------------------------------------------------------------------------

/** 命令的位置参数顺序；旧查询串里的这些 key 按顺序落成位置参数 */
const POSITIONAL_KEYS: Record<string, string[]> = {
    give: ['type', 'id'],
    giveall: ['type'],
    role: ['id'],
    setlevel: ['level'],
    storycompleted: ['to'],
    newstorycompleted: ['id', 'level'],
    kyusyotaskcompleted: ['id', 'status'],
    kyusyolevel: ['level'],
    kyusyounlocklevel: ['level'],
    kyusyoachievement: ['id'],
    account: ['operate'],
};

/** 旧查询串里的修饰符 key → 命令行前缀 */
const MODIFIER_PREFIX: Record<string, string> = {
    amount: 'x',
    level: 'lv',
    star: 'r',
    skill: 's',
    promote: 'p',
    intimacy: 'i',
    talent: 't',
    potential: 'pt',
    baselevel: 'bl',
    masterylevel: 'ml',
};

export interface ParsedGmTemplate {
    /** 命令名（小写，不含前缀斜杠） */
    label: string;
    /** 位置参数，按服务端解析顺序 */
    positionals: string[];
    /** 修饰符（已带前缀，如 lv80 / x100） */
    modifiers: string[];
    /** 目标玩家占位，如 <UID> */
    uid: string;
}

/**
 * 解析 Handbook 里的 GM 模板，同时兼容两种形式：
 * - 新命令行：`/give skin 17001 [@uid]`、`/role 4001 t<圣痕等级> [@uid]`
 * - 旧查询串：`give&uid=<UID>&type=currency&id=hcoin&amount=<数量>`
 */
export function parseGmTemplate(raw: string): ParsedGmTemplate {
    const text = raw.trim();
    const result: ParsedGmTemplate = { label: '', positionals: [], modifiers: [], uid: '' };
    if (!text) return result;

    // 新命令行：直接按空格切，首段是 label，其余原样保留
    if (text.startsWith('/')) {
        const tokens = text.slice(1).split(/\s+/).filter(Boolean);
        if (tokens.length === 0) return result;
        result.label = tokens[0].toLowerCase();
        for (const token of tokens.slice(1)) {
            if (token.startsWith('@')) result.uid = token.slice(1);
            else result.positionals.push(token);
        }
        return result;
    }

    // 旧查询串：label 后跟 k=v
    const segments = text.split('&');
    result.label = segments[0].trim().toLowerCase();
    const params = new Map<string, string>();
    for (const segment of segments.slice(1)) {
        const eq = segment.indexOf('=');
        if (eq > 0) params.set(segment.slice(0, eq).trim().toLowerCase(), segment.slice(eq + 1).trim());
    }

    for (const key of POSITIONAL_KEYS[result.label] ?? []) {
        const value = params.get(key);
        if (value !== undefined) {
            result.positionals.push(value);
            params.delete(key);
        }
    }

    const uid = params.get('uid');
    if (uid !== undefined) {
        result.uid = uid;
        params.delete('uid');
    }

    for (const [key, value] of params) {
        const prefix = MODIFIER_PREFIX[key];
        result.modifiers.push(prefix ? `${prefix}${value}` : `${key}=${value}`);
    }
    return result;
}

/** 把任意形式的 GM 模板归一化成可执行的命令行（如 `/give currency hcoin x<数量> @<UID>`） */
export function normalizeGmTemplate(raw: string): string {
    const parsed = parseGmTemplate(raw);
    if (!parsed.label) return '';
    return cmdLine(parsed.label, [...parsed.positionals, ...parsed.modifiers], parsed.uid);
}
