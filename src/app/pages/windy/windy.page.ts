/**
 * 脚本热更页（windy）：把服务器上的 Lua 脚本立刻下发给在线客户端执行。
 *
 * 命令行：/windy <服务器脚本路径> [@uid]
 * 目标必须在线（RequireTargetOnline）。服务端按以下顺序查找脚本：
 *   ServerData/windseed → ServerData → 服务器运行目录 → 绝对路径
 * 客户端在登录响应包里执行脚本，会顺带触发一次客户端重新初始化，
 * 因此这属于会影响玩家客户端的操作，发送前二次确认。
 */
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommandBarComponent } from '../../shared/command-bar';
import { ResultPanelComponent } from '../../shared/result-panel';
import { pageExecutor } from '../../shared/page-executor';
import { arg, cmdLine } from '../../core/command-line';

@Component({
    imports: [FormsModule, CommandBarComponent, ResultPanelComponent],
    template: `
        <section class="page">
            <header class="page-head">
                <h2>脚本热更</h2>
                <p>windy：把服务器上的 Lua 脚本立刻下发给在线客户端执行（windseed 热更）。</p>
            </header>

            <div class="commuse">
                <div class="commuse-item">
                    <div class="label">目标 uid（必填）</div>
                    <div class="value">
                        <input type="text" inputmode="numeric" [(ngModel)]="uid" placeholder="在线玩家的 UID" />
                    </div>
                </div>

                <div class="commuse-item">
                    <div class="label">脚本路径（必填）</div>
                    <div class="value">
                        <input type="text" [(ngModel)]="path" list="windy-scripts" spellcheck="false"
                                   placeholder="如 login.lua 或 PopWin.lua" />
                        <datalist id="windy-scripts">
                            @for (s of knownScripts; track s) {
                                <option [value]="s"></option>
                            }
                        </datalist>
                    </div>
                </div>
            </div>

            <p class="note">
                查找顺序：<code>ServerData/windseed</code> → <code>ServerData</code> → 服务器运行目录 → 绝对路径。<br />
                目标必须在线；脚本在登录响应包里执行，会顺带触发一次客户端重新初始化。
            </p>

            <gm-command-bar
                [preview]="preview()"
                [sending]="exec.sending()"
                [disabled]="!canSend()"
                [danger]="true"
                [dangerReason]="'将向玩家 ' + uid.trim() + ' 下发并执行 Lua 脚本 ' + path.trim()"
                (send)="send()"
            />
            <gm-result-panel [result]="exec.result()" [error]="exec.error()" />
        </section>
    `,
    styles: `
        .page { max-width: 760px; }
        .page-head { margin-bottom: var(--space-3); }
        .page-head h2 { margin: 0; font-size: var(--text-lg); font-weight: var(--weight-semibold); }
        .page-head p { margin: var(--space-1) 0 0; font-size: var(--text-sm); color: var(--color-text-2); }

        .commuse { display: flex; flex-direction: column; }
        .commuse-item { display: flex; align-items: center; margin: 12px 0; }
        .commuse-item .label {
            width: 140px; text-align: right; padding-right: 10px;
            color: var(--color-text-2); font-size: var(--text-sm); flex-shrink: 0;
        }
        .commuse-item .value { flex: 1; min-width: 0; }
        .commuse-item .value input { font-family: var(--font-mono); }

        .note {
            margin: var(--space-3) 0 0;
            font-size: var(--text-xs); color: var(--color-text-3); line-height: 1.9;
        }
        .note code {
            font-family: var(--font-mono);
            background: var(--color-bg-2); padding: 1px 5px; border-radius: var(--radius-sm);
        }
    `,
})
export class WindyPage {
    protected readonly exec = pageExecutor();

    protected uid = '';
    protected path = '';

    /** 服务器 ServerData/windseed 下的示例脚本，仅作为输入提示 */
    protected readonly knownScripts = ['login.lua', 'PopWin.lua'];

    protected canSend(): boolean {
        return this.uid.trim() !== '' && this.path.trim() !== '';
    }

    protected preview(): string {
        return cmdLine('windy', [arg(this.path)], this.uid);
    }

    protected send(): void {
        void this.exec.run(() => this.preview());
    }
}
