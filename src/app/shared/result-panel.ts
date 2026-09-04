/**
 * 结果面板：展示一次 GM 调用的结果或错误。
 * 成功时显示 Before/After 对比与同步状态；失败时用 --color-error 强调。
 */
import { Component, input } from '@angular/core';
import { GmResult, GmApiError } from '../core/gm-api.service';

@Component({
    selector: 'gm-result-panel',
    template: `
        @if (error(); as err) {
            <div class="panel error" role="alert">
                <div class="head">
                    <span class="badge error-badge">失败</span>
                    <span class="meta">HTTP {{ err.status }} · {{ err.code }}</span>
                </div>
                <p class="message">{{ err.message }}</p>
            </div>
        } @else if (result(); as res) {
            <div class="panel success">
                <div class="head">
                    <span class="badge success-badge">成功</span>
                    <span class="meta">cmd={{ res.command }}</span>
                    @if (res.uid !== null) { <span class="meta">uid={{ res.uid }}</span> }
                    @if (res.amount !== null) { <span class="meta">amount={{ res.amount }}</span> }
                    <span class="meta sync" [class.warn]="!res.syncDelivered">
                        {{ res.syncDelivered ? '已在线同步' : '在线同步未送达' }}
                    </span>
                </div>
                @if (res.help) {
                    <p class="hint">命令说明共 {{ res.help.length }} 条，可在「命令手册」页查看。</p>
                } @else {
                    <div class="diff">
                        <div class="col">
                            <h4>Before</h4>
                            <pre>{{ pretty(res.before) }}</pre>
                        </div>
                        <div class="col">
                            <h4>After</h4>
                            <pre>{{ pretty(res.after) }}</pre>
                        </div>
                    </div>
                }
            </div>
        }
    `,
    styles: `
        .panel {
            border: 1px solid var(--color-border-1);
            border-radius: var(--radius-lg);
            padding: var(--space-4) var(--space-5);
            background: var(--color-bg-1);
        }
        .panel.error { border-color: var(--color-error); background: rgba(245, 63, 63, 0.04); }
        .head { display: flex; align-items: center; gap: var(--space-3); margin-bottom: var(--space-3); flex-wrap: wrap; }
        .badge {
            display: inline-flex; align-items: center;
            font-size: var(--text-xs); font-weight: var(--weight-medium);
            padding: 2px 10px; border-radius: var(--radius-full);
        }
        .success-badge { background: rgba(0, 180, 42, 0.1); color: var(--color-success); }
        .error-badge { background: rgba(245, 63, 63, 0.1); color: var(--color-error); }
        .meta { font-family: var(--font-mono); font-size: var(--text-xs); color: var(--color-text-2); }
        .sync { margin-left: auto; }
        .sync.warn { color: var(--color-warning); }
        .message { margin: 0; font-size: var(--text-sm); color: var(--color-text-1); }
        .hint { margin: 0; font-size: var(--text-sm); color: var(--color-text-2); }

        .diff { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); }
        .col h4 { margin: 0 0 var(--space-2); font-size: var(--text-xs); color: var(--color-text-3); font-weight: var(--weight-medium); }
        pre {
            margin: 0; padding: var(--space-3);
            background: var(--color-bg-inverted); color: #e5e6eb;
            border-radius: var(--radius-md); overflow: auto; max-height: 220px;
            font-family: var(--font-mono); font-size: var(--text-xs); line-height: 1.6;
        }
        @media (max-width: 720px) { .diff { grid-template-columns: 1fr; } }
    `,
})
export class ResultPanelComponent {
    readonly result = input<GmResult | null>(null);
    readonly error = input<GmApiError | null>(null);

    pretty(value: unknown): string {
        return value === null || value === undefined ? '（无）' : JSON.stringify(value, null, 2);
    }
}
