/**
 * 命令手册页。优先实时调用 cmd=help；下方提供 Handbook 分区浏览。
 */
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GmApiService, GmApiError, GmCommandHelp } from '../../core/gm-api.service';
import { HandbookEntry, HandbookService } from '../../core/handbook.service';

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
          <div class="commuse-item">
            <div class="label">搜索条目</div>
            <div class="value"><input type="search" [(ngModel)]="query" placeholder="按 ID 或名称过滤…" /></div>
          </div>

          <div class="sections">
            @for (name of sectionNames(); track name) {
              <button type="button" class="sec-tab"
                      [class.active]="currentSection() === name"
                      (click)="selectSection(name)">
                {{ name }}
              </button>
            }
          </div>

          @if (currentSection()) {
            <div class="entries-head">{{ currentSection() }} · 共 {{ totalInSection() }} 条</div>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr><th style="width: 90px">ID</th><th>名称</th><th>附加信息</th><th style="width: 160px"></th></tr>
                </thead>
                <tbody>
                  @for (entry of filteredEntries(); track entry.id) {
                    <tr>
                      <td class="mono">{{ entry.id }}</td>
                      <td>{{ entry.name }}</td>
                      <td class="attrs">{{ attrsText(entry) }}</td>
                      <td>
                        @if (entry.attrs['GM']; as gm) {
                          <button type="button" class="btn tiny" (click)="copy(gm)" [title]="gm">复制 GM 模板</button>
                        }
                      </td>
                    </tr>
                  } @empty {
                    <tr><td colspan="4" class="empty">无匹配条目</td></tr>
                  }
                </tbody>
              </table>
            </div>
            @if (copied()) {
              <p class="copied">已复制到剪贴板</p>
            }
          }
        </div>
      }
    </section>
  `,
  styles: `
    .page { max-width: 960px; }
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
    .commuse-item .label {
      width: 120px; text-align: right; padding-right: 10px;
      color: var(--color-text-2); font-size: var(--text-sm); flex-shrink: 0;
    }
    .commuse-item .value { flex: 1; min-width: 0; }
    .sections { display: flex; gap: var(--space-1); flex-wrap: wrap; padding: 4px 0; }
    .sec-tab {
      background: transparent; color: var(--color-text-2);
      padding: 4px 12px; border-radius: var(--radius-full);
      font-size: var(--text-xs);
      border: 1px solid var(--color-border-1);
      transition: all var(--duration-fast) var(--ease-default);
    }
    .sec-tab:hover { color: var(--color-primary-6); border-color: var(--color-primary-6); }
    .sec-tab.active { background: var(--color-primary-6); border-color: var(--color-primary-6); color: #fff; }
    .entries-head { font-size: var(--text-xs); color: var(--color-text-3); }

    .table-wrap { border: 1px solid var(--color-border-1); border-radius: var(--radius-md); overflow: hidden; }
    table { width: 100%; border-collapse: collapse; font-size: var(--text-sm); background: var(--color-bg-1); }
    th { text-align: left; color: var(--color-text-3); font-weight: var(--weight-medium); padding: 8px 12px; border-bottom: 1px solid var(--color-border-1); background: var(--color-bg-2); }
    td { padding: 6px 12px; border-bottom: 1px solid var(--color-border-3); vertical-align: top; }
    tbody tr:last-child td { border-bottom: none; }
    tbody tr:hover { background: var(--color-bg-2); }
    .attrs { color: var(--color-text-2); word-break: break-all; }
    .empty { text-align: center; color: var(--color-text-3); padding: var(--space-4); }
    .btn.tiny {
      background: transparent; color: var(--color-text-2);
      padding: 2px 10px; border-radius: var(--radius-md);
      border: 1px solid var(--color-border-1);
      font-size: var(--text-xs); white-space: nowrap;
      transition: all var(--duration-fast) var(--ease-default);
    }
    .btn.tiny:hover { color: var(--color-primary-6); border-color: var(--color-primary-6); background: var(--color-primary-1); }
    .copied { margin: 0; font-size: var(--text-xs); color: var(--color-success); }
  `,
})
export class HelpPage {
  private readonly api = inject(GmApiService);
  protected readonly handbook = inject(HandbookService);

  protected readonly loading = signal(false);
  protected readonly loadError = signal<GmApiError | null>(null);
  protected readonly commands = signal<GmCommandHelp[]>([]);

  protected readonly query = signal('');
  protected readonly currentSection = signal('');

  protected readonly sectionNames = signal<string[]>([]);
  private readonly sectionsSnapshot = computed<Map<string, HandbookEntry[]>>(() =>
    this.handbook.loaded() ? this.snapshotSections() : new Map(),
  );

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

  protected totalInSection(): number {
    return this.sectionsSnapshot().get(this.currentSection())?.length ?? 0;
  }

  protected readonly filteredEntries = computed<HandbookEntry[]>(() => {
    const entries = this.sectionsSnapshot().get(this.currentSection()) ?? [];
    const q = this.query().trim().toLowerCase();
    if (!q) return entries.slice(0, 500);
    return entries
      .filter(e => e.id.toLowerCase().includes(q) || e.name.toLowerCase().includes(q))
      .slice(0, 500);
  });

  protected attrsText(entry: HandbookEntry): string {
    return Object.entries(entry.attrs)
      .filter(([k]) => k !== 'GM')
      .map(([k, v]) => `${k}=${v}`)
      .join('　');
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
