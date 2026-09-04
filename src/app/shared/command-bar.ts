/**
 * 命令栏：页面底部统一的「请求预览 + 发送按钮」。
 * preview 为将要发出的查询串（不含 baseUrl），danger 为 true 时用错误色并要求二次确认。
 */
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { SettingsStore } from '../core/settings.store';

@Component({
    selector: 'gm-command-bar',
    template: `
        <div class="bar">
            <div class="preview" title="将发送的请求">
                <span class="label">GET</span>
                <code class="mono">{{ fullUrl() }}</code>
            </div>
            @if (confirming()) {
                <div class="confirm">
                    <span>确认执行{{ dangerReason() ? '（' + dangerReason() + '）' : '' }}？</span>
                    <button type="button" class="btn danger" (click)="doSend()">确认执行</button>
                    <button type="button" class="btn ghost" (click)="confirming.set(false)">取消</button>
                </div>
            } @else {
                <div class="actions">
                    <button
                        type="button"
                        class="btn send"
                        [class.danger]="danger()"
                        [disabled]="disabled() || !preview()"
                        (click)="onSend()"
                    >
                        {{ sendLabel() }}
                    </button>
                </div>
            }
        </div>
    `,
    styles: `
        .bar {
            display: flex; flex-direction: column; gap: var(--space-3);
            padding: var(--space-4) var(--space-5);
            border: 1px solid var(--color-border-1);
            border-radius: var(--radius-lg);
            background: var(--color-bg-1);
        }
        .preview {
            display: flex; align-items: baseline; gap: var(--space-3);
            padding: var(--space-3) var(--space-4);
            background: var(--color-bg-inverted);
            color: #e5e6eb;
            border-radius: var(--radius-md);
            min-width: 0;
            overflow-x: auto; overflow-y: hidden;
            scrollbar-width: thin;
        }
        .label { font-size: var(--text-xs); color: #8ec0ff; font-weight: var(--weight-semibold); flex-shrink: 0; }
        .preview code {
            color: #e5e6eb; font-size: var(--text-xs);
            overflow-x: auto; overflow-y: hidden; white-space: nowrap;
            display: block; width: 100%;
            min-width: max-content;
            scrollbar-width: thin;
        }
        .preview::-webkit-scrollbar, .preview code::-webkit-scrollbar { height: 8px; }
        .preview::-webkit-scrollbar-track, .preview code::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); border-radius: 4px; }
        .preview::-webkit-scrollbar-thumb, .preview code::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.25); border-radius: 4px; }
        .preview::-webkit-scrollbar-thumb:hover, .preview code::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.45); }

        .actions { display: flex; justify-content: flex-end; }
        .btn {
            border-radius: var(--radius-md);
            padding: 8px 20px;
            font-weight: var(--weight-medium); font-size: var(--text-base);
            transition: background var(--duration-fast) var(--ease-default), transform var(--duration-fast) var(--ease-default);
        }
        .btn:hover:not(:disabled) { transform: translateY(-1px); }
        .btn.send { background: var(--color-primary-6); color: #fff; }
        .btn.send:hover:not(:disabled) { background: var(--color-primary-7); }
        .btn.danger { background: var(--color-error); color: #fff; }
        .btn.danger:hover:not(:disabled) { background: #d62929; }
        .btn.ghost { background: transparent; color: var(--color-text-2); border: 1px solid var(--color-border-2); }
        .btn.ghost:hover { color: var(--color-primary-6); border-color: var(--color-primary-6); }
        .btn:disabled { opacity: 0.4; cursor: not-allowed; }

        .confirm { display: flex; align-items: center; gap: var(--space-3); justify-content: flex-end; font-size: var(--text-sm); color: var(--color-error); }
    `,
})
export class CommandBarComponent {
    /** 查询串预览，如 cmd=give&uid=1&...；为空时禁用发送 */
    readonly preview = input('');
    readonly disabled = input(false);
    readonly busy = input(false);
    readonly sending = input(false);
    /** 危险操作：需要二次确认并以错误色渲染 */
    readonly danger = input(false);
    readonly dangerReason = input('');
    readonly send = output<void>();

    private readonly settings = inject(SettingsStore);
    readonly confirming = signal(false);

    readonly sendLabel = computed(() => (this.sending() ? '发送中…' : '执行命令'));

    readonly fullUrl = computed(() => {
        // 实时合并：baseUrl（设置项）+ preview（父组件信号输入），任一变化即重算
        const base = this.settings.baseUrl().replace(/\/$/, '');
        return base ? `${base}/api/gm?${this.preview()}` : `/api/gm?${this.preview()}`;
    });

    protected onSend(): void {
        if (this.danger()) {
            this.confirming.set(true);
        } else {
            this.doSend();
        }
    }

    protected doSend(): void {
        this.confirming.set(false);
        this.send.emit();
    }
}
