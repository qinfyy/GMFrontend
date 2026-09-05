/**
 * Handbook 条目搜索选择器。
 * 输入一个分区名（如 weapon / role / material），提供按 ID 或名称的过滤列表。
 * 大分区（数千行）采用截断展示 + 继续输入过滤，避免一次渲染上万 DOM。
 */
import { Component, computed, inject, input, model, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HandbookEntry, HandbookService } from '../core/handbook.service';

const MAX_RENDER = 200;

@Component({
    selector: 'gm-entry-picker',
    imports: [FormsModule],
    template: `
        @if (handbook.failed()) {
            <p class="missing">Handbook 加载失败，请手动填写 ID。</p>
        } @else {
            <div class="search-row">
                <input
                    type="search"
                    [(ngModel)]="query"
                    [placeholder]="placeholder()"
                    aria-label="搜索条目"
                />
                @if (value()) {
                    <button type="button" class="clear-btn" (click)="clear()" aria-label="取消选中">✕</button>
                }
            </div>
            <ul class="list" role="listbox">
                @for (entry of filtered(); track entry.id) {
                    <li>
                        <button
                            type="button"
                            role="option"
                            [class.selected]="entry.id === value()"
                            [attr.aria-selected]="entry.id === value()"
                            (click)="pick(entry)"
                        >
                            <span class="mono id">{{ entry.id }}</span>
                            <span class="name">{{ entry.name }}</span>
                            @if (extra(entry); as extraText) {
                                <span class="extra mono">{{ extraText }}</span>
                            }
                        </button>
                    </li>
                } @empty {
                    <li class="empty">无匹配条目</li>
                }
            </ul>
            @if (hiddenCount() > 0) {
                <p class="more">共 {{ total() }} 条，仅显示前 {{ MAX }} 条，请继续输入缩小范围</p>
            }
        }
    `,
    styles: `
        :host { display: flex; flex-direction: column; gap: var(--space-2); min-width: 0; }
        .search-row { position: relative; display: flex; align-items: center; }
        input[type='search'] { width: 100%; box-sizing: border-box; }
        .search-row input { padding-right: 32px; }
        .clear-btn {
            position: absolute; right: 6px; top: 50%; transform: translateY(-50%);
            width: 24px; height: 24px; padding: 0;
            background: transparent; color: var(--color-text-3);
            border: 0; border-radius: var(--radius-full);
            font-size: var(--text-sm); line-height: 1;
        }
        .clear-btn:hover { background: var(--color-bg-3); color: var(--color-text-1); }
        .list {
            list-style: none; margin: 0; padding: 4px;
            max-height: 320px; overflow-y: auto;
            background: var(--color-bg-1);
            border: 1px solid var(--color-border-1); border-radius: var(--radius-md);
        }
        .list button {
            display: flex; align-items: baseline; gap: var(--space-3); width: 100%;
            text-align: left; background: transparent; border: none;
            padding: 6px var(--space-3); border-radius: var(--radius-sm);
            font-size: var(--text-sm); color: var(--color-text-1);
        }
        .list button:hover { background: var(--color-primary-1); color: var(--color-primary-6); }
        .list button.selected { background: var(--color-primary-6); color: #fff; }
        .mono { font-family: var(--font-mono); }
        .id { color: var(--color-text-3); flex-shrink: 0; min-width: 4.5em; }
        .list button:hover .id, .list button.selected .id { color: inherit; opacity: 0.8; }
        .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .extra { margin-left: auto; color: var(--color-text-3); flex-shrink: 0; font-size: var(--text-xs); }
        .empty { padding: var(--space-4); font-size: var(--text-sm); color: var(--color-text-3); text-align: center; }
        .more { margin: 0; font-size: var(--text-xs); color: var(--color-text-3); }
        .missing { margin: 0; font-size: var(--text-sm); color: var(--color-warning); }
    `,
})
export class EntryPickerComponent {
    protected readonly handbook = inject(HandbookService);
    protected readonly MAX = MAX_RENDER;

    /** Handbook 分区名 */
    readonly section = input.required<string>();
    readonly placeholder = input('按 ID 或名称搜索…');
    /** 选中值（双向绑定到父表单） */
    readonly value = model('');
    /** 可选：每行右侧的附加信息提取器 */
    readonly extraOf = input<((entry: HandbookEntry) => string) | null>(null);
    /** 可选：只显示 entry.type 等于此值的行（如 'chapter' / 'level'） */
    readonly typeFilter = input<string | null>(null);
    /** 可选：点击已选中的条目时是否取消选中（默认 false） */
    readonly toggleable = input(false);
    /** 可选：自定义谓词过滤（与 typeFilter 叠加），如按章节联动过滤关卡 */
    readonly filterOf = input<((entry: HandbookEntry) => boolean) | null>(null);

    protected readonly query = signal('');

    private readonly entries = computed(() => {
        let all = this.handbook.section(this.section());
        const tf = this.typeFilter();
        if (tf) all = all.filter(e => e.type === tf);
        const fn = this.filterOf();
        if (fn) all = all.filter(fn);
        return all;
    });

    protected readonly total = computed(() => this.entries().length);

    protected readonly filtered = computed(() => {
        const q = this.query().trim().toLowerCase();
        const all = this.entries();
        if (!q) return all.slice(0, MAX_RENDER);
        const matched = all.filter(
            e => e.id.toLowerCase().includes(q) || e.name.toLowerCase().includes(q),
        );
        return matched.slice(0, MAX_RENDER);
    });

    protected readonly hiddenCount = computed(() => {
        const q = this.query().trim().toLowerCase();
        if (!q) return Math.max(0, this.total() - MAX_RENDER);
        return Math.max(
            0,
            this.entries().filter(e => e.id.toLowerCase().includes(q) || e.name.toLowerCase().includes(q)).length -
                MAX_RENDER,
        );
    });

    protected pick(entry: HandbookEntry): void {
        // toggleable 模式：点击已选中的条目 = 取消选中
        if (this.toggleable() && entry.id === this.value()) {
            this.clear();
            return;
        }
        this.value.set(entry.id);
    }

    /** 清空选中（✕ 按钮或再次点击已选条目触发） */
    protected clear(): void {
        this.value.set('');
    }

    protected extra(entry: HandbookEntry): string | null {
        const fn = this.extraOf();
        return fn ? fn(entry) : null;
    }
}
