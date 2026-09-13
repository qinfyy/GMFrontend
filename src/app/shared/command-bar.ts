/**
 * 命令栏：页面底部统一的「命令行预览 + 发送按钮」。
 * preview 为将要执行的 GM 命令行（如 /give hcoin x100 @1），danger 为 true 时用错误色并要求二次确认。
 * 预览框右侧可一键复制该命令行，方便直接粘进控制台或游戏内聊天框。
 */
import { Component, computed, input, output, signal } from '@angular/core';

@Component({
    selector: 'gm-command-bar',
    template: `
        <div class="bar">
            <div class="preview">
                @if (preview()) {
                    <code class="mono">{{ preview() }}</code>
                } @else {
                    <code class="mono placeholder">（填写表单后此处显示将执行的命令）</code>
                }
                <button
                    type="button"
                    class="copy"
                    [disabled]="!preview()"
                    (click)="copyCommand()"
                    [title]="'复制命令：' + preview()"
                >
                    {{ copied() ? '已复制' : '复制命令' }}
                </button>
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
            display: flex; align-items: center; gap: var(--space-3);
            padding: var(--space-3) var(--space-4);
            background: var(--color-bg-inverted);
            color: #e5e6eb;
            border-radius: var(--radius-md);
            min-width: 0;
        }
        .preview code {
            color: #e5e6eb; font-size: var(--text-xs);
            overflow-x: auto; overflow-y: hidden; white-space: nowrap;
            flex: 1; min-width: 0;
            scrollbar-width: thin;
        }
        .preview code.placeholder { color: #8a8f99; }
        .preview code::-webkit-scrollbar { height: 8px; }
        .preview code::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); border-radius: 4px; }
        .preview code::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.25); border-radius: 4px; }
        .preview code::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.45); }
        .copy {
            flex-shrink: 0;
            background: transparent; color: #b7bcc4;
            border: 1px solid rgba(255,255,255,0.22); border-radius: var(--radius-sm);
            padding: 3px 10px; font-size: var(--text-xs);
            transition: color var(--duration-fast) var(--ease-default), border-color var(--duration-fast) var(--ease-default);
        }
        .copy:hover:not(:disabled) { color: #fff; border-color: rgba(255,255,255,0.5); }
        .copy:disabled { opacity: 0.4; cursor: not-allowed; }

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
    /** 命令行预览，如 /give hcoin x100 @1；为空时禁用发送与复制 */
    readonly preview = input('');
    readonly disabled = input(false);
    readonly busy = input(false);
    readonly sending = input(false);
    /** 危险操作：需要二次确认并以错误色渲染 */
    readonly danger = input(false);
    readonly dangerReason = input('');
    readonly send = output<void>();

    readonly confirming = signal(false);
    readonly copied = signal(false);

    readonly sendLabel = computed(() => (this.sending() ? '发送中…' : '执行命令'));

    protected async copyCommand(): Promise<void> {
        const command = this.preview().trim();
        if (!command) return;
        try {
            await navigator.clipboard.writeText(command);
            this.copied.set(true);
            setTimeout(() => this.copied.set(false), 1500);
        } catch {
            // 剪贴板不可用（非安全上下文）时静默失败
        }
    }

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
