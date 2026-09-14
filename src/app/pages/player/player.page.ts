/**
 * 玩家设置页（setlevel）。
 * 命令行：/setlevel <等级> [@uid]，服务端也接受 /setlevel lv<等级> [@uid]。
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
                <h2>玩家设置</h2>
                <p>setlevel：设置玩家等级。等级上限与升级所需经验由服务端按当前资源校验。</p>
            </header>

            <div class="commuse">
                <div class="commuse-item">
                    <div class="label">uid</div>
                    <div class="value"><input type="text" inputmode="numeric" [(ngModel)]="uid" /></div>
                </div>
                <div class="commuse-item">
                    <div class="label">等级 level</div>
                    <div class="value"><input type="number" min="1" [(ngModel)]="level" placeholder="正整数" /></div>
                </div>
            </div>

            <gm-command-bar
                [preview]="preview()"
                [sending]="exec.sending()"
                [disabled]="!canSend()"
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
            width: 120px; text-align: right; padding-right: 10px;
            color: var(--color-text-2); font-size: var(--text-sm); flex-shrink: 0;
        }
        .commuse-item .value { flex: 1; min-width: 0; }
    `,
})
export class PlayerPage {
    protected readonly exec = pageExecutor();

    protected uid = '';
    protected level: number | null = null;

    /** 等级是必填位置参数，为空时禁用发送 */
    protected canSend(): boolean {
        return this.level !== null && this.level > 0;
    }

    protected preview(): string {
        return cmdLine('setlevel', [arg(this.level)], this.uid);
    }

    protected send(): void {
        void this.exec.run(() => this.preview());
    }
}
