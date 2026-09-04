/**
 * 角色养成页（role）。改写玩家已拥有角色的养成属性。
 */
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommandBarComponent } from '../../shared/command-bar';
import { ResultPanelComponent } from '../../shared/result-panel';
import { EntryPickerComponent } from '../../shared/entry-picker';
import { pageExecutor } from '../../shared/page-executor';

@Component({
    imports: [FormsModule, CommandBarComponent, ResultPanelComponent, EntryPickerComponent],
    template: `
        <section class="page">
            <header class="page-head">
                <h2>角色养成</h2>
                <p>role：改写玩家已拥有角色的养成属性。角色必须已被玩家拥有，未拥有时先到「单件发放」发放。</p>
            </header>

            <div class="commuse">
                <div class="commuse-item align-top">
                    <div class="label">选择角色</div>
                    <div class="value">
                        <gm-entry-picker
                            section="role-develop"
                            placeholder="搜索角色（ID 或名称）…"
                            [(value)]="roleId"
                            [extraOf]="extraOf"
                        />
                    </div>
                </div>

                <div class="commuse-item">
                    <div class="label">uid</div>
                    <div class="value"><input type="text" inputmode="numeric" [(ngModel)]="uid" /></div>
                </div>

                <fieldset class="commuse-block">
                    <legend>养成属性（至少填一项，超出上限按资源截断）</legend>
                    <div class="commuse-item">
                        <div class="label">圣痕 talent（类型1 角色）</div>
                        <div class="value"><input type="number" min="0" [(ngModel)]="talent" placeholder="99=点满，0=清空" /></div>
                    </div>
                    <div class="commuse-item">
                        <div class="label">限解 potential（类型2 角色）</div>
                        <div class="value"><input type="number" min="0" [(ngModel)]="potential" placeholder="上限见列表" /></div>
                    </div>
                    <div class="commuse-item">
                        <div class="label">基础等级 baselevel</div>
                        <div class="value"><input type="number" min="1" max="50" [(ngModel)]="baseLevel" placeholder="1–50" /></div>
                    </div>
                    <div class="commuse-item">
                        <div class="label">精通等级 masterylevel</div>
                        <div class="value"><input type="number" min="0" [(ngModel)]="masteryLevel" placeholder="0 起，对应 50+M" /></div>
                    </div>
                </fieldset>

                @if (baseLevel !== null && baseLevel > 0 && masteryLevel !== null && masteryLevel >= 0) {
                    <p class="conflict">baselevel 与 masterylevel 是同一条等级线，只能给一个，同时给出服务端会报错。</p>
                }

                <fieldset class="commuse-block">
                    <legend>装备属性（原地改写该角色全部已拥有装备实体，可省略）</legend>
                    <div class="commuse-item">
                        <div class="label">装备等级 level</div>
                        <div class="value"><input type="number" [(ngModel)]="equip['level']" /></div>
                    </div>
                    <div class="commuse-item">
                        <div class="label">星级 star</div>
                        <div class="value"><input type="number" [(ngModel)]="equip['star']" /></div>
                    </div>
                    <div class="commuse-item">
                        <div class="label">技能 skill</div>
                        <div class="value"><input type="number" [(ngModel)]="equip['skill']" /></div>
                    </div>
                    <div class="commuse-item">
                        <div class="label">升格 promote</div>
                        <div class="value"><input type="number" [(ngModel)]="equip['promote']" /></div>
                    </div>
                    <div class="commuse-item">
                        <div class="label">亲密 intimacy</div>
                        <div class="value"><input type="number" [(ngModel)]="equip['intimacy']" /></div>
                    </div>
                </fieldset>
            </div>

            <gm-command-bar
                [preview]="preview()"
                [sending]="exec.sending()"
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
        .commuse-item.align-top { align-items: flex-start; }
        .commuse-item .label {
            width: 160px; text-align: right; padding-right: 10px;
            color: var(--color-text-2); font-size: var(--text-sm); flex-shrink: 0;
            line-height: 32px;
        }
        .commuse-item.align-top .label { line-height: 1.5; padding-top: 6px; }
        .commuse-item .value { flex: 1; min-width: 0; }
        .commuse-block { border: none; padding: 0; margin: var(--space-3) 0 0; }
        .commuse-block legend { font-size: var(--text-sm); color: var(--color-text-2); padding: 0; margin-bottom: var(--space-2); }
        .conflict { margin: 0 0 0 170px; font-size: var(--text-xs); color: var(--color-error); }
    `,
})
export class RolePage {
    protected readonly exec = pageExecutor();

    protected roleId = '';
    protected uid = '';

    protected talent: number | null = null;
    protected potential: number | null = null;
    protected baseLevel: number | null = null;
    protected masteryLevel: number | null = null;

    protected readonly equip: Record<string, string | number> = {};

    protected readonly extraOf = (e: { attrs: Record<string, string> }): string => {
        const parts: string[] = [];
        if (e.attrs['max_level'] && e.attrs['max_level'] !== '0') parts.push(`基础≤${e.attrs['max_level']}`);
        if (e.attrs['max_mastery'] && e.attrs['max_mastery'] !== '0') parts.push(`精通+${e.attrs['max_mastery']}`);
        if (e.attrs['max_potential'] && e.attrs['max_potential'] !== '0') parts.push(`限解≤${e.attrs['max_potential']}`);
        if (e.attrs['talent'] === 'yes') parts.push('有圣痕');
        return parts.join(' ');
    };

    protected preview(): string {
        const parts = ['cmd=role'];
        if (this.uid.trim()) parts.push(`uid=${this.uid.trim()}`);
        if (this.roleId.trim()) parts.push(`id=${encodeURIComponent(this.roleId.trim())}`);
        const num = (v: number | null) =>
            v !== null && !Number.isNaN(v) && String(v).trim() !== '' ? String(Math.floor(v)) : '';
        for (const [key, value] of [
            ['talent', num(this.talent)],
            ['potential', num(this.potential)],
            ['baselevel', num(this.baseLevel)],
            ['masterylevel', num(this.masteryLevel)],
        ] as const) {
            if (value) parts.push(`${key}=${value}`);
        }
        for (const key of ['level', 'star', 'skill', 'promote', 'intimacy']) {
            const raw = this.equip[key];
            if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
                parts.push(`${key}=${String(raw).trim()}`);
            }
        }
        return parts.join('&');
    }

    protected send(): void {
        void this.exec.run(() => {
            const record: Record<string, string> = { cmd: 'role' };
            if (this.uid.trim()) record['uid'] = this.uid.trim();
            if (this.roleId.trim()) record['id'] = this.roleId.trim();
            const set = (key: string, v: number | null): void => {
                if (v !== null && !Number.isNaN(v) && String(v).trim() !== '') record[key] = String(Math.floor(v));
            };
            set('talent', this.talent);
            set('potential', this.potential);
            set('baselevel', this.baseLevel);
            set('masterylevel', this.masteryLevel);
            for (const key of ['level', 'star', 'skill', 'promote', 'intimacy']) {
                const raw = this.equip[key];
                if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
                    record[key] = String(raw).trim();
                }
            }
            return record;
        });
    }
}
