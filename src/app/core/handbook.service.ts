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
 */
import { Injectable, signal } from '@angular/core';

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
            const response = await fetch('handbook/Handbook.txt');
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
 * - 含制表符的数据行按列解析：第 1 列作为 type（如 "currency"、"第一章 L1-1"），
 *   第 2 列必为 ID；后续列若为 key=value 形式则入 attrs，第一个非 key=value 列
 *   作为 name（无则用 id 兜底）；
 * - 分区内的说明文字行（不含制表符的普通文本）跳过。
 *
 * 支持两种行格式：
 * 1. 传统：type <TAB> id <TAB> name <TAB> key=value ...
 *    例：currency \t hcoin \t 水晶 \t alias=239 \t GM=...
 * 2. 剧情/九霄关卡：chapter <TAB> id <TAB> type=N <TAB> GM=...
 *    例：第一章 L1-1 \t 8351 \t type=1 \t GM=storyrange&...&from=8351&to=8351
 */
function parse(text: string): Map<string, HandbookEntry[]> {
    const sections = new Map<string, HandbookEntry[]>();
    let current: string | null = null;

    for (const rawLine of text.split('\n')) {
        const line = rawLine.replace(/\r$/, '');
        if (!line.trim()) continue;

        const headerMatch = /^\[(.+)\]\s*$/.exec(line);
        if (headerMatch) {
            current = headerMatch[1];
            if (!sections.has(current)) sections.set(current, []);
            continue;
        }

        if (current === null || !line.includes('\t')) continue;

        const columns = line.split('\t').map(v => v.trim());
        if (columns.length < 2) continue;

        const type = columns[0];
        const id = columns[1];
        const attrs: Record<string, string> = {};
        let name: string | undefined;

        for (let i = 2; i < columns.length; i++) {
            const col = columns[i];
            const eq = col.indexOf('=');
            if (eq > 0) {
                attrs[col.slice(0, eq)] = col.slice(eq + 1);
            } else if (name === undefined) {
                name = col;
            } else {
                // 多余的非属性列（如多个空格分隔的尾注）拼到 name
                name += ' ' + col;
            }
        }

        sections.get(current)!.push({
            section: current,
            type,
            id,
            name: name ?? id,
            attrs,
        });
    }
    return sections;
}
