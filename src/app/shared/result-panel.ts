/**
 * 结果面板：展示一次 GM 调用的结果或错误。
 * 2026-09 上游改为逐条消息输出，成功时按服务端 messages 顺序列出；
 * 失败时用 --color-error 强调，并展示 HTTP 状态与服务端错误码。
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
                    <span class="meta">HTTP {{ err.status }}</span>
                    @if (err.code) { <span class="meta">{{ err.code }}</span> }
                </div>
                <p class="message">{{ err.message }}</p>
            </div>
        } @else if (result(); as res) {
            <div class="panel success">
                <div class="head">
                    <span class="badge success-badge">发送成功</span>
                    <span class="meta">输出 {{ res.messages.length }} 条</span>
                </div>
                <div class="output">
                    @for (m of res.messages; track $index) {
                        <div class="line">{{ m }}</div>
                    } @empty {
                        <div class="line muted">（服务端未返回消息）</div>
                    }
                </div>
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
        .message { margin: 0; font-size: var(--text-sm); color: var(--color-text-1); line-height: 1.7; }

        /* 服务端输出：终端风格逐行展示 */
        .output {
            padding: var(--space-3) var(--space-4);
            background: var(--color-bg-inverted); color: #e5e6eb;
            border-radius: var(--radius-md);
            overflow: auto; max-height: 320px;
            font-family: var(--font-mono); font-size: var(--text-xs); line-height: 1.8;
        }
        .line { white-space: pre-wrap; word-break: break-word; }
        .line.muted { color: #8a8f99; }
    `,
})
export class ResultPanelComponent {
    readonly result = input<GmResult | null>(null);
    readonly error = input<GmApiError | null>(null);
}
