/**
 * 控制台页：自由执行任意 GM 命令。
 *
 * 上游 2026-09 起接口只收整条命令行（content 参数），所以这里不再拼键值参数，
 * 而是一个「命令行输入框 + 可选 @uid」：输入 `/give hcoin x100` 即可执行。
 * 下方命令速查直接来自服务端 /help，点击用法可一键填入输入框。
 */
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GmApiService, GmCommandHelp } from '../../core/gm-api.service';
import { CommandBarComponent } from '../../shared/command-bar';
import { ResultPanelComponent } from '../../shared/result-panel';
import { pageExecutor } from '../../shared/page-executor';
import { cmdLine } from '../../core/command-line';

@Component({
    imports: [FormsModule, CommandBarComponent, ResultPanelComponent],
    template: `
        <section class="page">
            <header class="page-head">
                <h2>控制台</h2>
                <p>直接输入任意 GM 命令行。前缀斜杠可省略，命令与参数说明见「命令手册」。</p>
            </header>

            <div class="commuse">
                <div class="commuse-item">
                    <div class="label">命令行</div>
                    <div class="value">
                        <input
                            type="text"
                            [(ngModel)]="command"
                            placeholder="如 /give hcoin x100 或 give hcoin x100"
                            list="known-cmds"
                            spellcheck="false"
                        />
                        <datalist id="known-cmds">
                            @for (c of knownLabels(); track c) {
                                <option [value]="c"></option>
                            }
                        </datalist>
                    </div>
                </div>

                <div class="commuse-item">
                    <div class="label">uid（可选）</div>
                    <div class="value">
                        <input type="text" inputmode="numeric" [(ngModel)]="uid"
                                   placeholder="追加为 @uid；命令行里已写 @ 时忽略" />
                    </div>
                </div>
            </div>

            @if (matched(); as cmd) {
                <div class="matched">
                    <div class="matched-head">
                        <span class="mono name">{{ cmd.label }}</span>
                        @if (cmd.aliases.length) {
                            <span class="aliases">别名：{{ cmd.aliases.join('、') }}</span>
                        }
                        <span class="desc">{{ cmd.description }}</span>
                    </div>
                    @for (u of cmd.usage; track u) {
                        <code class="usage mono">{{ u }}</code>
                    }
                </div>
            }

            <gm-command-bar
                [preview]="preview()"
                [sending]="exec.sending()"
                [disabled]="!preview()"
                (send)="send()"
            />
            <gm-result-panel [result]="exec.result()" [error]="exec.error()" />

            <section class="reference">
                <h3>命令速查</h3>
                <p class="ref-hint">来自服务端 /help；点击用法可填入上方命令行。</p>
                @if (helpFailed()) {
                    <p class="ref-warn">未能读取服务端命令定义，请检查服务器连接。</p>
                }
                @for (c of commands(); track c.label) {
                    <article class="ref-card">
                        <div class="ref-head">
                            <span class="mono name">{{ c.label }}</span>
                            @if (c.aliases.length) {
                                <span class="aliases">别名：{{ c.aliases.join('、') }}</span>
                            }
                            <span class="desc">{{ c.description }}</span>
                        </div>
                        @for (u of c.usage; track u) {
                            <button type="button" class="usage-btn" (click)="fill(u)" [title]="'填入：' + u">
                                <code class="mono">{{ u }}</code>
                            </button>
                        }
                    </article>
                }
            </section>
        </section>
    `,
    styles: `
        .page { max-width: 860px; }
        .page-head { margin-bottom: var(--space-5); }
        .page-head h2 { margin: 0; font-size: var(--text-lg); font-weight: var(--weight-semibold); }
        .page-head p { margin: var(--space-1) 0 0; font-size: var(--text-sm); color: var(--color-text-2); }

        .commuse { display: flex; flex-direction: column; }
        .commuse-item { display: flex; align-items: center; margin: 18px 0; }
        .commuse-item .label {
            width: 120px; text-align: right; padding-right: 10px;
            color: var(--color-text-2); font-size: var(--text-sm); flex-shrink: 0;
        }
        .commuse-item .value { flex: 1; min-width: 0; }
        .commuse-item input { font-family: var(--font-mono); }

        /* 已识别命令的用法提示 */
        .matched {
            margin: var(--space-2) 0 var(--space-4);
            padding: var(--space-3) var(--space-4);
            border: 1px dashed var(--color-border-2);
            border-radius: var(--radius-md);
            background: var(--color-primary-1);
        }
        .matched-head { display: flex; align-items: baseline; gap: var(--space-3); flex-wrap: wrap; }
        .name { color: var(--color-primary-6); font-weight: var(--weight-semibold); font-size: var(--text-sm); }
        .aliases { font-size: var(--text-xs); color: var(--color-text-3); }
        .desc { font-size: var(--text-xs); color: var(--color-text-2); }
        .usage {
            display: block; margin-top: var(--space-2);
            font-size: var(--text-xs); color: var(--color-text-1);
            white-space: pre-wrap; word-break: break-word;
        }

        /* 命令速查 */
        .reference { margin-top: var(--space-6); }
        .reference h3 { margin: 0; font-size: var(--text-md); font-weight: var(--weight-semibold); }
        .ref-hint { margin: var(--space-1) 0 var(--space-3); font-size: var(--text-xs); color: var(--color-text-3); }
        .ref-warn { margin: 0 0 var(--space-3); font-size: var(--text-sm); color: var(--color-warning); }
        .ref-card {
            border: 1px solid var(--color-border-1);
            border-radius: var(--radius-md);
            background: var(--color-bg-1);
            padding: var(--space-3) var(--space-4);
            margin-bottom: var(--space-2);
        }
        .ref-head { display: flex; align-items: baseline; gap: var(--space-3); flex-wrap: wrap; margin-bottom: var(--space-2); }
        .usage-btn {
            display: block; width: 100%; text-align: left;
            background: transparent; border: 0;
            padding: 4px 6px; border-radius: var(--radius-sm);
            transition: background var(--duration-fast) var(--ease-default);
        }
        .usage-btn:hover { background: var(--color-primary-1); }
        .usage-btn:hover code { color: var(--color-primary-6); }
        .usage-btn code { font-size: var(--text-xs); color: var(--color-text-2); white-space: pre-wrap; word-break: break-word; }
    `,
})
export class ConsolePage {
    private readonly api = inject(GmApiService);
    protected readonly exec = pageExecutor();

    protected command = '';
    protected uid = '';

    protected readonly commands = signal<GmCommandHelp[]>([]);
    protected readonly helpFailed = signal(false);

    protected readonly knownLabels = signal([
        'give', 'giveall', 'role', 'setlevel',
        'storycompleted', 'newstorycompleted', 'kyusyoTaskCompleted',
        'kyusyoLevel', 'kyusyoUnlockLevel', 'kyusyoAchievement', 'account', 'help',
    ]);

    constructor() {
        // 静默拉一次 /help，把服务端真实命令集与用法填进速查表
        this.api
            .fetchHelp()
            .then(help => {
                this.commands.set(help);
                this.knownLabels.set(help.map(h => h.label));
            })
            .catch(() => this.helpFailed.set(true));
    }

    /** 当前输入命中的命令（按命令名或别名匹配），用于显示用法 */
    protected matched(): GmCommandHelp | null {
        const label = this.labelOf(this.command);
        if (!label) return null;
        const lower = label.toLowerCase();
        return (
            this.commands().find(
                c => c.label.toLowerCase() === lower || c.aliases.some(a => a.toLowerCase() === lower),
            ) ?? null
        );
    }

    protected preview(): string {
        const raw = this.command.trim();
        if (!raw) return '';
        const withoutSlash = raw.startsWith('/') ? raw.slice(1) : raw;
        const space = withoutSlash.search(/\s/);
        const label = space < 0 ? withoutSlash : withoutSlash.slice(0, space);
        const rest = space < 0 ? '' : withoutSlash.slice(space + 1).trim();
        // 命令行里已经写了 @uid 就不再追加，避免出现两个目标
        const uid = /(?:^|\s)@\d/.test(withoutSlash) ? '' : this.uid;
        return cmdLine(label, [rest], uid);
    }

    protected fill(usage: string): void {
        this.command = usage;
    }

    protected send(): void {
        void this.exec.run(() => this.preview());
    }

    private labelOf(command: string): string {
        const raw = command.trim().replace(/^\//, '');
        const space = raw.search(/\s/);
        return space < 0 ? raw : raw.slice(0, space);
    }
}
