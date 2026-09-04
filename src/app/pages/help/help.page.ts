/**
 * 命令手册页。优先实时调用 cmd=help；下方提供 Handbook 分区浏览。
 *
 * 搜索行为：
 * - 在所选分区（currentSection）内按 ID / 名称 / 附加信息（attrs）过滤
 * - "全部分区"模式：跨所有分区搜索，按分区名+ID/名称/附加信息匹配
 * - 命中字符在结果中高亮
 * - 搜索框带清除按钮
 * - section tab 显示条目数
 */
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GmApiService, GmApiError, GmCommandHelp } from '../../core/gm-api.service';
import { HandbookEntry, HandbookService } from '../../core/handbook.service';

const ALL_SECTIONS = '全部分区';

/** 手册浏览页支持的分区清单（与 Handbook.txt 生成顺序一致） */
const KNOWN_SECTIONS = [
  'currency', 'weapon', 'costume', 'badge', 'role', 'material', 'potential',
  'role-develop', 'skin', 'partner',
  '九霄故事（逐火之蛾主玩法）',
  'ZeroDLC 故事（逐火之蛾 Roguelike 战斗 DLC）',
  '九霄任务目录（逐火之蛾主玩法）',
  'kyusyoUnlockLevel 九霄关卡目录（逐火之蛾出击）',
  'kyusyoAchievement 九霄成就目录（逐火之蛾探索）',
  'ZeroDLC（逐火之蛾 Roguelike 战斗 DLC）内容目录',
  '普通剧情、教学与其他 LevelMetaV2 资源',
  '九霄关卡',
] as const;

const MAX_RENDER = 500;

interface FilteredEntry {
  entry: HandbookEntry;
  /** 命中的子串（用于高亮） */
  matchKey: string;
  matchId: string;
  matchName: string;
  matchAttrs: string;
}

@Component({
  imports: [FormsModule],
  template: `
    <section class="page">
      <header class="page-head">
        <h2>命令手册</h2>
        <p>与服务器启动时生成的 Handbook.txt 同源。上方来自 cmd=help 实时响应，下方为本地 Handbook 分区。</p>
      </header>

      <div class="commands">
        @if (loading()) {
          <p class="status">正在从服务器读取命令定义…</p>
        } @else if (loadError(); as err) {
          <div class="status warn">服务端命令定义读取失败：{{ err.message }}</div>
        }
        @for (cmd of commands(); track cmd.label) {
          <article class="cmd-card">
            <header>
              <h3 class="mono">{{ cmd.label }}</h3>
              @if (cmd.aliases.length) {
                <span class="aliases">别名：{{ cmd.aliases.join('、') }}</span>
              }
            </header>
            <p class="desc">{{ cmd.description }}</p>
            @for (u of cmd.usage; track u) {
              <code class="usage">{{ u }}</code>
            }
            @if (cmd.notes.length) {
              <ul>
                @for (n of cmd.notes; track n) {
                  <li>{{ n }}</li>
                }
              </ul>
            }
          </article>
        }
      </div>

      <hr />

      <h3 class="sub">Handbook 浏览</h3>
      @if (handbook.failed()) {
        <p class="status warn">Handbook.txt 加载失败，无法浏览分区。</p>
      } @else {
        <div class="browser">
          <div class="commuse-item align-top">
            <div class="label">搜索条目</div>
            <div class="value search-row">
              <input
                type="search"
                [ngModel]="query()"
                (ngModelChange)="onQuery($event)"
                (keydown.escape)="query.set('')"
                placeholder="按 ID / 名称 / 附加信息（alias、talent 等）过滤…"
                aria-label="搜索条目"
              />
              @if (query()) {
                <button type="button" class="clear-btn" (click)="query.set('')" aria-label="清除搜索">✕</button>
              }
            </div>
          </div>

          <div class="sections">
            <button type="button" class="sec-tab"
                    [class.active]="currentSection() === allSectionsKey"
                    (click)="selectSection(allSectionsKey)">
              {{ allSectionsKey }} <span class="count">{{ totalAll() }}</span>
            </button>
            @for (name of sectionNames(); track name) {
              <button type="button" class="sec-tab"
                      [class.active]="currentSection() === name"
                      (click)="selectSection(name)">
                {{ name }} <span class="count">{{ countOf(name) }}</span>
              </button>
            }
          </div>

          <div class="entries-head">
            @if (query()) {
              <span>匹配 <strong class="match">{{ totalMatched() }}</strong> 条</span>
            } @else {
              <span>{{ currentSection() }} · 共 {{ totalInCurrent() }} 条</span>
            }
            <span class="hint-inline">搜索区分大小写；空查询展示分区全部</span>
          </div>

          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style="width: 90px">ID</th>
                  <th>名称</th>
                  <th>附加信息</th>
                  <th style="width: 200px"></th>
                </tr>
              </thead>
              <tbody>
                @for (item of filteredEntries(); track item.entry.section + ':' + item.entry.id) {
                  <tr>
                    <td class="mono">
                      @if (currentSection() === allSectionsKey) {
                        <div class="entry-section">{{ shortSection(item.entry.section) }}</div>
                      }
                      <span [innerHTML]="item.matchId"></span>
                    </td>
                    <td><span [innerHTML]="item.matchName"></span></td>
                    <td class="attrs"><span [innerHTML]="item.matchAttrs"></span></td>
                    <td>
                      @if (item.entry.attrs['GM']; as gm) {
                        <button type="button" class="btn tiny" (click)="copy(gm)" [title]="gm">复制 GM 模板</button>
                      }
                    </td>
                  </tr>
                } @empty {
                  <tr><td colspan="4" class="empty">
                    @if (query()) {
                      无匹配条目
                    } @else {
                      请选择左侧分区，或在搜索框输入关键词
                    }
                  </td></tr>
                }
              </tbody>
            </table>
          </div>
          @if (filteredEntries().length === MAX) {
            <p class="more">仅显示前 {{ MAX }} 条，请输入关键词缩小范围</p>
          }
          @if (copied()) {
            <p class="copied">已复制到剪贴板</p>
          }
        </div>
      }
    </section>
  `,
  styles: `
    .page { max-width: 1020px; }
    .page-head { margin-bottom: var(--space-5); }
    .page-head h2 { margin: 0; font-size: var(--text-lg); font-weight: var(--weight-semibold); }
    .page-head p { margin: var(--space-1) 0 0; font-size: var(--text-sm); color: var(--color-text-2); }

    .commands { display: flex; flex-direction: column; gap: var(--space-3); margin-bottom: var(--space-5); }
    .cmd-card {
      border: 1px solid var(--color-border-1);
      border-radius: var(--radius-lg);
      padding: var(--space-4) var(--space-5);
      background: var(--color-bg-1);
    }
    .cmd-card header { display: flex; align-items: baseline; gap: var(--space-3); flex-wrap: wrap; }
    .cmd-card h3 { margin: 0; font-size: var(--text-md); color: var(--color-primary-6); font-weight: var(--weight-semibold); }
    .aliases { font-size: var(--text-xs); color: var(--color-text-3); }
    .desc { margin: var(--space-2) 0; font-size: var(--text-sm); color: var(--color-text-2); }
    .usage {
      display: block; margin: var(--space-1) 0;
      padding: 6px 10px;
      background: var(--color-bg-inverted); color: #e5e6eb;
      border-radius: var(--radius-md); overflow-x: auto; white-space: nowrap;
      font-family: var(--font-mono); font-size: var(--text-xs);
    }
    ul { margin: var(--space-2) 0 0; padding-left: var(--space-5); }
    li { font-size: var(--text-xs); color: var(--color-text-2); line-height: 1.8; list-style: disc; }
    .status { font-size: var(--text-sm); color: var(--color-text-3); margin: 0; }
    .warn { color: var(--color-warning); }

    hr { margin: var(--space-5) 0; }
    .sub { margin: 0 0 var(--space-4); font-size: var(--text-md); font-weight: var(--weight-semibold); }

    .browser { display: flex; flex-direction: column; gap: var(--space-3); }
    .commuse-item { display: flex; align-items: center; margin: 12px 0; }
    .commuse-item.align-top { align-items: flex-start; }
    .commuse-item .label {
      width: 120px; text-align: right; padding-right: 10px;
      color: var(--color-text-2); font-size: var(--text-sm); flex-shrink: 0;
      padding-top: 8px;
    }
    .commuse-item .value { flex: 1; min-width: 0; }
    .search-row { position: relative; display: flex; align-items: center; }
    .search-row input { flex: 1; padding-right: 36px; }
    .clear-btn {
      position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
      width: 24px; height: 24px; padding: 0;
      background: transparent; color: var(--color-text-3);
      border: 0; border-radius: var(--radius-full);
      font-size: var(--text-sm); line-height: 1;
    }
    .clear-btn:hover { background: var(--color-bg-3); color: var(--color-text-1); }

    .sections { display: flex; gap: var(--space-1); flex-wrap: wrap; padding: 4px 0; }
    .sec-tab {
      background: transparent; color: var(--color-text-2);
      padding: 4px 12px; border-radius: var(--radius-full);
      font-size: var(--text-xs);
      border: 1px solid var(--color-border-1);
      transition: all var(--duration-fast) var(--ease-default);
      display: inline-flex; align-items: center; gap: 6px;
    }
    .sec-tab:hover { color: var(--color-primary-6); border-color: var(--color-primary-6); }
    .sec-tab.active { background: var(--color-primary-6); border-color: var(--color-primary-6); color: #fff; }
    .sec-tab .count {
      font-size: 10px; padding: 1px 6px; border-radius: 8px;
      background: var(--color-bg-2); color: var(--color-text-2);
    }
    .sec-tab.active .count { background: rgba(255,255,255,0.25); color: #fff; }

    .entries-head {
      display: flex; align-items: baseline; gap: var(--space-3);
      font-size: var(--text-xs); color: var(--color-text-3);
    }
    .entries-head .match { color: var(--color-primary-6); }
    .hint-inline { color: var(--color-text-3); }

    .table-wrap { border: 1px solid var(--color-border-1); border-radius: var(--radius-md); overflow: hidden; }
    table { width: 100%; border-collapse: collapse; font-size: var(--text-sm); background: var(--color-bg-1); }
    th { text-align: left; color: var(--color-text-3); font-weight: var(--weight-medium); padding: 8px 12px; border-bottom: 1px solid var(--color-border-1); background: var(--color-bg-2); }
    td { padding: 6px 12px; border-bottom: 1px solid var(--color-border-3); vertical-align: top; }
    tbody tr:last-child td { border-bottom: none; }
    tbody tr:hover { background: var(--color-bg-2); }
    .attrs { color: var(--color-text-2); word-break: break-all; }
    .entry-section { font-size: 10px; color: var(--color-text-3); margin-bottom: 2px; }
    .empty { text-align: center; color: var(--color-text-3); padding: var(--space-4); }
    .more { margin: 0; font-size: var(--text-xs); color: var(--color-text-3); text-align: center; }
    .btn.tiny {
      background: transparent; color: var(--color-text-2);
      padding: 2px 10px; border-radius: var(--radius-md);
      border: 1px solid var(--color-border-1);
      font-size: var(--text-xs); white-space: nowrap;
      transition: all var(--duration-fast) var(--ease-default);
    }
    .btn.tiny:hover { color: var(--color-primary-6); border-color: var(--color-primary-6); background: var(--color-primary-1); }
    .copied { margin: 0; font-size: var(--text-xs); color: var(--color-success); }
    /* 命中字符高亮 */
    :host ::ng-deep mark { background: rgba(22, 93, 255, 0.18); color: var(--color-primary-6); padding: 0 2px; border-radius: 2px; }
  `,
})
export class HelpPage {
  private readonly api = inject(GmApiService);
  protected readonly handbook = inject(HandbookService);

  protected readonly loading = signal(false);
  protected readonly loadError = signal<GmApiError | null>(null);
  protected readonly commands = signal<GmCommandHelp[]>([]);

  /** 搜索框用 signal + 显式 setter 绑定 ngModel */
  readonly query = signal('');
  /** 当前所选分区；'全部分区' 表示跨分区搜索 */
  readonly currentSection = signal<string>(ALL_SECTIONS);
  protected readonly allSectionsKey = ALL_SECTIONS;
  protected readonly MAX = MAX_RENDER;

  protected readonly sectionNames = signal<string[]>([]);
  private readonly sectionsSnapshot = computed<Map<string, HandbookEntry[]>>(() =>
    this.handbook.loaded() ? this.snapshotSections() : new Map(),
  );
  /** 跨分区扁平数组（用于"全部分区"搜索） */
  private readonly allEntries = computed<HandbookEntry[]>(() => {
    const map = this.sectionsSnapshot();
    const list: HandbookEntry[] = [];
    for (const entries of map.values()) {
      for (const e of entries) list.push(e);
    }
    return list;
  });

  private snapshotCache: Map<string, HandbookEntry[]> | null = null;

  constructor() {
    void this.refreshHelp();
  }

  protected async refreshHelp(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      this.commands.set(await this.api.fetchHelp());
    } catch (e) {
      this.loadError.set(
        e instanceof GmApiError ? e : new GmApiError(0, 'unknown', undefined, String(e)),
      );
    } finally {
      this.loading.set(false);
    }
  }

  private snapshotSections(): Map<string, HandbookEntry[]> {
    if (!this.snapshotCache) {
      const names: string[] = [];
      const cache = new Map<string, HandbookEntry[]>();
      for (const name of KNOWN_SECTIONS) {
        const entries = this.handbook.section(name);
        if (entries.length) {
          names.push(name);
          cache.set(name, entries);
        }
      }
      this.sectionNames.set(names);
      this.snapshotCache = cache;
    }
    return this.snapshotCache;
  }

  protected selectSection(name: string): void {
    this.currentSection.set(this.currentSection() === name ? '' : name);
  }

  protected countOf(name: string): number {
    return this.sectionsSnapshot().get(name)?.length ?? 0;
  }

  protected totalAll(): number {
    return this.allEntries().length;
  }

  protected totalInCurrent(): number {
    if (this.currentSection() === ALL_SECTIONS) return this.totalAll();
    return this.countOf(this.currentSection());
  }

  /** 当前过滤结果条数（未截断） */
  protected totalMatched(): number {
    return this._matchAll().length;
  }

  /**
   * 命中搜索的全部条目（在当前分区内或全部分区）。
   * 先过滤再限制条数，给前端展示用。
   */
  private readonly _matchAll = computed<HandbookEntry[]>(() => {
    const q = this.query().trim().toLowerCase();
    const source = this.currentSection() === ALL_SECTIONS
      ? this.allEntries()
      : (this.sectionsSnapshot().get(this.currentSection()) ?? []);
    if (!q) return source;
    return source.filter(e => matchEntry(e, q));
  });

  protected readonly filteredEntries = computed<FilteredEntry[]>(() => {
    return this._matchAll().slice(0, MAX_RENDER).map(e => this.buildHighlighted(e));
  });

  protected onQuery(value: string): void {
    this.query.set(value);
  }

  /** 把匹配串包裹成 <mark>，安全转义 HTML。 */
  private buildHighlighted(e: HandbookEntry): FilteredEntry {
    const q = this.query().trim();
    return {
      entry: e,
      matchKey: q ? highlight(q, e.type) : escapeHtml(e.type),
      matchId: q ? highlight(q, e.id) : escapeHtml(e.id),
      matchName: q ? highlight(q, e.name) : escapeHtml(e.name),
      matchAttrs: q ? highlightAttrs(q, e) : escapeHtml(this.attrsText(e)),
    };
  }

  protected attrsText(entry: HandbookEntry): string {
    return Object.entries(entry.attrs)
      .filter(([k]) => k !== 'GM')
      .map(([k, v]) => `${k}=${v}`)
      .join('　');
  }

  protected shortSection(name: string): string {
    // 截短分区名（保留前 8 个字符）以节省表格空间
    return name.length > 8 ? name.slice(0, 8) + '…' : name;
  }

  protected copied = signal(false);

  protected async copy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1500);
    } catch {
      // 剪贴板不可用（非安全上下文）时静默失败
    }
  }
}

/** 命中判定：ID / 名称 / 类型 / 附加信息（key 与 value）任一包含 q 即算命中 */
function matchEntry(e: HandbookEntry, q: string): boolean {
  if (e.id.toLowerCase().includes(q)) return true;
  if (e.name.toLowerCase().includes(q)) return true;
  if (e.type.toLowerCase().includes(q)) return true;
  for (const [k, v] of Object.entries(e.attrs)) {
    if (k === 'GM') continue;
    if (k.toLowerCase().includes(q)) return true;
    if (v.toLowerCase().includes(q)) return true;
  }
  return false;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function highlight(query: string, text: string): string {
  const escaped = escapeHtml(text);
  if (!query) return escaped;
  // 用 indexOf 大小写不敏感地查找所有出现位置，按原文位置标记
  const re = new RegExp(escapeRegExp(query), 'gi');
  return escaped.replace(re, m => `<mark>${m}</mark>`);
}

function highlightAttrs(query: string, e: HandbookEntry): string {
  const text = Object.entries(e.attrs)
    .filter(([k]) => k !== 'GM')
    .map(([k, v]) => `${k}=${v}`)
    .join('　');
  if (!query) return escapeHtml(text);
  // 对 key= 也高亮
  const re = new RegExp(escapeRegExp(query), 'gi');
  return escapeHtml(text).replace(re, m => `<mark>${m}</mark>`);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
