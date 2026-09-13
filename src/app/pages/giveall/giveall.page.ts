/**
 * 批量补齐页（giveall）。按类别批量补齐；type=all 与 material/currency 为危险操作。
 * 命令行：/giveall <type> [x数量] [lv.. r.. s.. p.. i.. t.. pt.. bl..|ml..] [@uid]
 * 注意：装备类别按 MetaId 去重，不接受 x数量；material/currency 必须显式给 x数量。
 */
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommandBarComponent } from '../../shared/command-bar';
import { ResultPanelComponent } from '../../shared/result-panel';
import { pageExecutor } from '../../shared/page-executor';
import { CmdPart, arg, cmdLine, mod, xAmount } from '../../core/command-line';

interface TypeTab {
    type: string;
    label: string;
    /** 是否要求 x数量（material / currency 必须显式给） */
    requiresAmount: boolean;
    hint: string;
}

@Component({
    imports: [FormsModule, CommandBarComponent, ResultPanelComponent],
    template: `
        <section class="page">
            <header class="page-head">
                <h2>批量补齐</h2>
                <p>giveall：按类别批量补齐当前资源里的物品。装备类别按 MetaId 去重跳过已拥有条目，重复执行为零增量。</p>
            </header>

            <div class="tabs" role="tablist">
                @for (tab of tabs; track tab.type) {
                    <button type="button" role="tab"
                                    [class.active]="current().type === tab.type"
                                    [attr.aria-selected]="current().type === tab.type"
                                    (click)="selectTab(tab)">
                        {{ tab.label }}
                    </button>
                }
            </div>
            @if (current(); as tab) {
                <p class="hint">{{ tab.hint || '按所选类型批量补齐' }}</p>
            }

            <div class="commuse">
                <div class="commuse-item">
                    <div class="label">uid</div>
                    <div class="value"><input type="text" inputmode="numeric" [(ngModel)]="uid" /></div>
                </div>

                @if (current().requiresAmount) {
                    <div class="commuse-item">
                        <div class="label">数量 x（必填）</div>
                        <div class="value"><input type="number" min="1" [(ngModel)]="amount" placeholder="如 100" /></div>
                    </div>
                }

                @if (hasEquipmentAttrs()) {
                    <fieldset class="commuse-block">
                        <legend>装备 / 养成参数（可省略）</legend>
                        <div class="commuse-item">
                            <div class="label">等级 lv</div>
                            <div class="value"><input type="number" [(ngModel)]="equip['level']" /></div>
                        </div>
                        <div class="commuse-item">
                            <div class="label">星级 r</div>
                            <div class="value"><input type="number" [(ngModel)]="equip['star']" /></div>
                        </div>
                        <div class="commuse-item">
                            <div class="label">技能 s</div>
                            <div class="value"><input type="number" [(ngModel)]="equip['skill']" /></div>
                        </div>
                        <div class="commuse-item">
                            <div class="label">升格 p</div>
                            <div class="value"><input type="number" [(ngModel)]="equip['promote']" /></div>
                        </div>
                        <div class="commuse-item">
                            <div class="label">亲密 i</div>
                            <div class="value"><input type="number" [(ngModel)]="equip['intimacy']" /></div>
                        </div>
                        <div class="commuse-item">
                            <div class="label">圣痕 t</div>
                            <div class="value"><input type="number" [(ngModel)]="equip['talent']" /></div>
                        </div>
                        <div class="commuse-item">
                            <div class="label">限解 pt</div>
                            <div class="value"><input type="number" [(ngModel)]="equip['potential']" /></div>
                        </div>
                        <div class="commuse-item">
                            <div class="label">基础等级 bl</div>
                            <div class="value"><input type="number" [(ngModel)]="equip['baselevel']" /></div>
                        </div>
                        <div class="commuse-item">
                            <div class="label">精通等级 ml</div>
                            <div class="value"><input type="number" [(ngModel)]="equip['masterylevel']" /></div>
                        </div>
                    </fieldset>
                    <p class="note">bl 与 ml 是同一条等级线，只能给一个。</p>
                }
            </div>

            <gm-command-bar
                [preview]="preview()"
                [sending]="exec.sending()"
                [disabled]="!canSend()"
                [danger]="isDangerous()"
                [dangerReason]="dangerReason()"
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

        .tabs { display: flex; gap: var(--space-1); flex-wrap: wrap; margin-bottom: var(--space-2); }
        .tabs button {
            background: transparent; color: var(--color-text-2);
            padding: 6px 14px; border-radius: var(--radius-md);
            font-size: var(--text-sm); font-weight: var(--weight-medium);
            border: 1px solid var(--color-border-1);
            transition: all var(--duration-fast) var(--ease-default);
        }
        .tabs button:hover { color: var(--color-primary-6); border-color: var(--color-primary-6); }
        .tabs button.active { background: var(--color-primary-6); border-color: var(--color-primary-6); color: #fff; }
        .hint { margin: 0 0 var(--space-3); font-size: var(--text-xs); color: var(--color-text-3); }
        .note { margin: var(--space-2) 0 0 130px; font-size: var(--text-xs); color: var(--color-text-3); }

        .commuse { display: flex; flex-direction: column; }
        .commuse-item { display: flex; align-items: center; margin: 12px 0; }
        .commuse-item .label {
            width: 120px; text-align: right; padding-right: 10px;
            color: var(--color-text-2); font-size: var(--text-sm); flex-shrink: 0;
        }
        .commuse-item .value { flex: 1; min-width: 0; }
        .commuse-block { border: none; padding: 0; margin: var(--space-3) 0 0; }
        .commuse-block legend { font-size: var(--text-sm); color: var(--color-text-2); padding: 0; margin-bottom: var(--space-2); }
    `,
})
export class GiveAllPage {
    protected readonly exec = pageExecutor();

    protected readonly tabs: TypeTab[] = [
        { type: 'all', label: '全部', requiresAmount: false, hint: '覆盖全部可发放装备类型和 IsOpen=1 的看板（不含 skin/potential）。' },
        { type: 'weapon', label: '武器', requiresAmount: false, hint: '' },
        { type: 'costume', label: '服装', requiresAmount: false, hint: '' },
        { type: 'badge', label: '徽章', requiresAmount: false, hint: '' },
        { type: 'role', label: '角色', requiresAmount: false, hint: '' },
        { type: 'partner', label: '看板', requiresAmount: false, hint: '按 PosterID 去重补齐，不接受数量。' },
        { type: 'skin', label: '皮肤', requiresAmount: false, hint: '按当前资源补齐全部标准角色皮肤，不接受数量或装备参数。' },
        { type: 'material', label: '材料', requiresAmount: true, hint: '按数量累加，没有「已拥有」概念，必须显式指定 x数量。' },
        { type: 'currency', label: '货币', requiresAmount: true, hint: '只发水晶与金币各 x数量；活动 Wallet 货币请用「单件发放」按数字 CoinType 单独发。' },
    ];

    protected readonly current = signal(this.tabs[0]);
    protected uid = '';
    protected amount: number | null = null;

    protected readonly equip: Record<string, string | number> = {};

    protected hasEquipmentAttrs(): boolean {
        return ['all', 'weapon', 'costume', 'badge', 'role'].includes(this.current().type);
    }

    /** material / currency 必须给数量，其余类别直接可发 */
    protected canSend(): boolean {
        if (!this.current().requiresAmount) return true;
        return this.amount !== null && this.amount > 0;
    }

    protected isDangerous(): boolean {
        return ['all', 'material', 'currency'].includes(this.current().type);
    }

    protected dangerReason(): string {
        const type = this.current().type;
        if (type === 'all') return '将一次性发放全类别物品';
        if (type === 'material') return `将为所有材料各累加 ${this.amount ?? '?'} 个`;
        if (type === 'currency') return `将发放水晶与金币各 ${this.amount ?? '?'}，请确认数量`;
        return '';
    }

    protected selectTab(tab: TypeTab): void {
        this.current.set(tab);
    }

    protected preview(): string {
        const tab = this.current();
        const parts: CmdPart[] = [arg(tab.type)];
        if (tab.requiresAmount) {
            parts.push(xAmount(this.amount));
        }
        if (this.hasEquipmentAttrs()) {
            parts.push(
                mod('lv', this.equip['level']),
                mod('r', this.equip['star']),
                mod('s', this.equip['skill']),
                mod('p', this.equip['promote']),
                mod('i', this.equip['intimacy']),
                mod('t', this.equip['talent']),
                mod('pt', this.equip['potential']),
                mod('bl', this.equip['baselevel']),
                mod('ml', this.equip['masterylevel']),
            );
        }
        return cmdLine('giveall', parts, this.uid);
    }

    protected send(): void {
        void this.exec.run(() => this.preview());
    }
}
