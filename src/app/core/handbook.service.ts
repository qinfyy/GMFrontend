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
 * - 其后含制表符的行视为数据行，按 \t 切分：第 1 列类型、第 2 列 ID、第 3 列名称、其余为 key=value 尾注；
 * - 分区内的说明文字行（不含制表符的普通文本）跳过。
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
    if (columns.length < 3) continue;

    const attrs: Record<string, string> = {};
    for (let i = 3; i < columns.length; i++) {
      const eq = columns[i].indexOf('=');
      if (eq > 0) attrs[columns[i].slice(0, eq)] = columns[i].slice(eq + 1);
    }

    sections.get(current)!.push({
      type: columns[0],
      id: columns[1],
      name: columns[2],
      attrs,
    });
  }
  return sections;
}
