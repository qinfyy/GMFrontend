/**
 * Handbook.txt 解析服务。
 *
 * Handbook 由服务器启动时生成（Sv/GameMaster/GameMasterHandbookGenerator.cs），
 * 结构为「分区标题 + 分隔符切列的数据行」，分区标题有两种写法：
 *
 *   [currency]                        ← 方括号标题
 *   崩坏学园篇章节目录                 ← 裸标题 + 下划线分隔行
 *   ------------------
 *
 * 数据行格式（2026-09-14 起）：
 *   1. 制表符分隔：type <TAB> id <TAB> name <TAB> k=v ... <TAB> GM=/命令 ...
 *      例：currency	hcoin	水晶	alias=239	GM=/give currency hcoin x<数量> [@uid]
 *      例：chapter	2	今我来思	type=3	...	GM=/newstorycompleted 2
 *   2. 单空格分隔（传承篇 / 新生篇）：
 *      例：第一章 L1-1 8351 type=1 GM=/storycompleted 8351 [@uid]
 *
 * 这里把它解析成结构化目录，供各功能页做选择器数据源。
 *
 * 关于 GM 模板：上游 2026-09-14 把 Handbook 里所有遗留的 `cmd&uid=..&k=v` 查询串
 * 彻底改成了命令行写法（`/cmd <位置参数> [x数量] [lv..] [-flag] [@uid]`），
 * 因此这里只按命令行解析，不再保留旧的查询串兼容层。
 */
import { Injectable, signal } from '@angular/core';

/** 一条 Handbook 数据行（已解析出 ID / 名称 / 尾注） */
export interface HandbookEntry {
    /** 所属分区名（用于全部分区搜索显示来源） */
    section: string;
    /** 行首类型标记（如 currency / weapon / role / level / chapter） */
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

    /**
     * 全部「有数据行」的分区名，按文件出现顺序。
     *
     * 分区名由服务端按装备 TypeId 动态生成（weapon / costume / badge / role / emblem / petchip …），
     * 上游新增装备类型就会多出一个分区，因此这里不做白名单，直接枚举。
     * 纯说明区（命令 / 类型说明 / 剧情关卡目录）没有任何 tab 数据行，天然被排除。
     */
    sectionNames(): string[] {
        const names: string[] = [];
        for (const [name, entries] of this._sections()) {
            if (entries.length > 0) names.push(name);
        }
        return names;
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
 * - `[section]` 行开启新分区；
 * - 「标题 + 3 个以上连字符」的裸标题也开启新分区（如「崩坏学园篇章节目录」）；
 * - 传承篇 / 新生篇的单空格行按「第X章 关卡名 ID 尾注...」解析；
 * - 其余行必须含制表符才视为数据行，按 type / id / name / 尾注 切列；
 * - 分区内的说明文字行跳过。
 */
function parse(text: string): Map<string, HandbookEntry[]> {
    const sections = new Map<string, HandbookEntry[]>();
    let current: string | null = null;
    let prevLine = '';

    for (const rawLine of text.split('\n')) {
        const line = rawLine.replace(/\r$/, '');
        if (!line.trim()) {
            prevLine = line;
            continue;
        }

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

        if (current === null) {
            prevLine = line;
            continue;
        }

        const entry = parseEntry(current, line);
        if (entry) sections.get(current)!.push(entry);
        prevLine = line;
    }
    return sections;
}

/** 解析一条数据行；说明文字行返回 null */
function parseEntry(section: string, line: string): HandbookEntry | null {
    // 传承篇 / 新生篇：`第一章 L1-1 8351 type=1 GM=/storycompleted 8351 [@uid]`
    // 章节名与关卡名之间用空格，ID 是纯数字，其后为尾注。
    const chapter = /^(第\S+)\s+(\S+)\s+(\d+)\s+(.*)$/.exec(line.trim());
    if (chapter) {
        return {
            section,
            type: 'level',
            id: chapter[3],
            name: `${chapter[1]} ${chapter[2]}`,
            attrs: parseAttrs(chapter[4]),
        };
    }

    // 其余分区必须用制表符切列，否则视为说明文字
    if (!line.includes('\t')) return null;

    const columns = line.split('\t').map(value => value.trim());
    if (columns.length < 2) return null;

    let name: string | undefined;
    const attrs: Record<string, string> = {};
    for (let i = 2; i < columns.length; i++) {
        const column = columns[i];
        const eq = column.indexOf('=');
        if (eq > 0) {
            attrs[column.slice(0, eq)] = column.slice(eq + 1);
        } else if (name === undefined) {
            name = column;
        } else {
            name += ' ' + column;
        }
    }

    return { section, type: columns[0], id: columns[1], name: name ?? columns[1], attrs };
}

/**
 * 解析空格分隔的尾注。
 * `GM=` 的值可以含空格（如 `/give currency hcoin x<数量> [@uid]`）且总是行尾字段，
 * 因此先把它整段切出来，再解析其余 key=value。
 */
function parseAttrs(text: string): Record<string, string> {
    const attrs: Record<string, string> = {};
    let rest = text;

    const gm = /(?:^|\s)GM=(.*)$/.exec(rest);
    if (gm) {
        attrs['GM'] = gm[1].trim();
        rest = rest.slice(0, gm.index).trim();
    }

    for (const token of rest.split(/\s+/).filter(Boolean)) {
        const eq = token.indexOf('=');
        if (eq > 0) attrs[token.slice(0, eq)] = token.slice(eq + 1);
    }
    return attrs;
}

// ---------------------------------------------------------------------------
// GM 命令模板
// ---------------------------------------------------------------------------

export interface ParsedGmTemplate {
    /** 命令名（小写，不含前缀斜杠） */
    label: string;
    /** 位置参数，按服务端解析顺序 */
    positionals: string[];
    /** 修饰符（已带前缀，如 lv80 / x100） */
    modifiers: string[];
    /** 目标玩家，如 `1` 或 `<UID>` 占位 */
    uid: string;
}

/**
 * 解析 Handbook 里的 GM 模板。
 * 上游 2026-09-14 起模板一律是命令行写法，形如：
 *
 *   /give currency hcoin x<数量> [@uid]
 *   /role 4001 t<圣痕等级> [@uid]
 *   /newstorycompleted 2 402001
 *
 * 返回的 positionals / modifiers 只是按「是否带前缀修饰符」做的粗分类，
 * 供页面做联动过滤等用途；真正执行时直接用模板原文即可。
 */
export function parseGmTemplate(raw: string): ParsedGmTemplate {
    const result: ParsedGmTemplate = { label: '', positionals: [], modifiers: [], uid: '' };
    const text = raw.trim();
    if (!text) return result;

    const tokens = text.replace(/^\//, '').split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return result;

    result.label = tokens[0].toLowerCase();
    for (const token of tokens.slice(1)) {
        // 占位写法 [@uid] 与实参写法 @1 都算目标玩家
        const uidToken = /^\[?@(.+?)\]?$/.exec(token);
        if (uidToken) result.uid = uidToken[1];
        else if (isModifier(token)) result.modifiers.push(token);
        else result.positionals.push(token);
    }
    return result;
}

/** 服务端 CommandContext.TryParseModifier 认得的通用修饰符前缀 */
const MODIFIER_PREFIXES = ['x', 'X', '*', 'lv', 'pt', 'bl', 'ml', 'sk', 'r', 'R', 'p', 'P', 's', 'S', 'i', 'I', 't', 'T'];

/** token 是否为「前缀 + 数值」形式的通用修饰符 */
function isModifier(token: string): boolean {
    if (token.startsWith('-')) return true;
    return MODIFIER_PREFIXES.some(prefix => {
        if (!token.startsWith(prefix) || token.length === prefix.length) return false;
        const value = token.slice(prefix.length);
        return /^\d+$/.test(value);
    });
}
