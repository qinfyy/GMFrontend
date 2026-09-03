/**
 * 单件发放页（give）。类型 Tab + Handbook 选择器 + 数量 + 装备/养成参数。
 * 表单采用 commuse 模式：右对齐 label + 弹性 input。
 */
import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HandbookEntry } from '../../core/handbook.service';
import { CommandBarComponent } from '../../shared/command-bar';
import { ResultPanelComponent } from '../../shared/result-panel';
import { EntryPickerComponent } from '../../shared/entry-picker';
import { pageExecutor } from '../../shared/page-executor';

interface TypeTab {
  type: string;
  label: string;
  section: string;
  hasAmount: boolean;
  hint: string;
}

@Component({
  imports: [FormsModule, CommandBarComponent, ResultPanelComponent, EntryPickerComponent],
  template: `
    <section class="page">
      <header class="page-head">
        <h2>单件发放</h2>
        <p>give：只接受显式 ID。选择类型后在列表中搜索条目。</p>
      </header>

      <div class="tabs" role="tablist">
        @for (tab of tabs; track tab.type) {
          <button
            type="button"
            role="tab"
            [class.active]="current().type === tab.type"
            [attr.aria-selected]="current().type === tab.type"
            (click)="selectTab(tab)"
          >
            {{ tab.label }}
          </button>
        }
      </div>
      @if (current(); as tab) {
        <p class="hint">{{ tab.hint }}</p>
      }

      <div class="commuse">
        <div class="commuse-item">
          <div class="label">选择条目</div>
          <div class="value">
            <gm-entry-picker
              [section]="current().section"
              [placeholder]="'搜索' + current().label + '（ID 或名称）…'"
              [(value)]="entryId"
              [extraOf]="extraOfCurrent()"
            />
          </div>
        </div>

        <div class="commuse-item">
          <div class="label">uid</div>
          <div class="value"><input type="text" inputmode="numeric" [(ngModel)]="uid" /></div>
        </div>

        @if (current().hasAmount) {
          <div class="commuse-item">
            <div class="label">数量 amount</div>
            <div class="value"><input type="number" min="1" [(ngModel)]="amount" /></div>
          </div>
        }

        @if (isPotential()) {
          <div class="commuse-item">
            <div class="label">ID 说明</div>
            <div class="value">
              <input type="text" value="common = 账号通用训练组件，或填角色 ID" disabled />
            </div>
          </div>
        }

        @if (hasEquipmentAttrs()) {
          <fieldset class="commuse-block">
            <legend>装备 / 养成参数（可省略，超出上限按资源截断）</legend>
            <div class="commuse-item">
              <div class="label">等级 level</div>
              <div class="value"><input type="number" min="1" [(ngModel)]="equip['level']" /></div>
            </div>
            <div class="commuse-item">
              <div class="label">星级 star</div>
              <div class="value"><input type="number" min="0" placeholder="上限 99" [(ngModel)]="equip['star']" /></div>
            </div>
            <div class="commuse-item">
              <div class="label">技能 skill</div>
              <div class="value"><input type="number" min="0" [(ngModel)]="equip['skill']" /></div>
            </div>
            <div class="commuse-item">
              <div class="label">升格 promote</div>
              <div class="value"><input type="number" min="0" [(ngModel)]="equip['promote']" /></div>
            </div>
            <div class="commuse-item">
              <div class="label">亲密 intimacy</div>
              <div class="value"><input type="number" min="0" [(ngModel)]="equip['intimacy']" /></div>
            </div>
            <div class="commuse-item">
              <div class="label">圣痕 talent</div>
              <div class="value"><input type="number" min="0" placeholder="99=点满" [(ngModel)]="equip['talent']" /></div>
            </div>
            <div class="commuse-item">
              <div class="label">限解 potential</div>
              <div class="value"><input type="number" min="0" placeholder="上限 4" [(ngModel)]="equip['potential']" /></div>
            </div>
            <div class="commuse-item">
              <div class="label">基础等级 baselevel</div>
              <div class="value"><input type="number" min="1" placeholder="1–50" [(ngModel)]="equip['baselevel']" /></div>
            </div>
            <div class="commuse-item">
              <div class="label">精通 masterylevel</div>
              <div class="value"><input type="number" min="0" placeholder="50+M" [(ngModel)]="equip['masterylevel']" /></div>
            </div>
          </fieldset>
        }
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
export class GivePage {
  protected readonly exec = pageExecutor();

  protected readonly tabs: TypeTab[] = [
    { type: 'currency', label: '货币', section: 'currency', hasAmount: true, hint: 'hcoin 水晶、bhcoin 祈之共鸣、scoin 金币，或 RewardData 数字 CoinType。' },
    { type: 'material', label: '材料', section: 'material', hasAmount: true, hint: '背包堆叠材料，按 MetaId 发放。' },
    { type: 'weapon', label: '装备武器', section: 'weapon', hasAmount: true, hint: '每份创建独立实体，支持 level/star/skill/promote/intimacy 参数。' },
    { type: 'costume', label: '服装', section: 'costume', hasAmount: true, hint: '服装类装备实体。' },
    { type: 'badge', label: '徽章', section: 'badge', hasAmount: true, hint: '徽章类装备实体。' },
    { type: 'role', label: '角色', section: 'role', hasAmount: true, hint: '发放新角色，已拥有同 MetaId 也会照发新的一份。' },
    { type: 'potential', label: '限解道具', section: 'potential', hasAmount: true, hint: 'id=common 是账号通用训练组件；id=<角色ID> 是该角色专属限解特装。需先拥有该角色。' },
    { type: 'skin', label: '皮肤', section: 'skin', hasAmount: false, hint: '重复发放幂等；皮肤 ID 与适用角色见列表。' },
    { type: 'partner', label: '看板', section: 'partner', hasAmount: true, hint: '看板（Poster）。' },
  ];

  protected readonly current = signal(this.tabs[0]);

  protected entryId = '';
  protected uid = '';
  protected amount: number | null = null;

  /** 装备/养成参数表单值（字符串留空即不发送） */
  protected readonly equip: Record<string, string | number> = {};

  protected readonly isPotential = computed(() => this.current().type === 'potential');

  /** 装备参数只在装备型 Tab 下展示（货币/材料/skin/partner/potential 不需要） */
  protected readonly hasEquipmentAttrs = computed(() =>
    ['weapon', 'costume', 'badge', 'role'].includes(this.current().type),
  );

  /** 选择器右侧附加信息：货币显示别名，皮肤显示适用角色 */
  protected extraOfCurrent(): ((e: HandbookEntry) => string) | null {
    const type = this.current().type;
    if (type === 'currency') return e => (e.attrs['alias'] ? `alias=${e.attrs['alias']}` : '');
    if (type === 'skin') return e => (e.attrs['roles'] ? `roles=${e.attrs['roles']}` : '');
    return null;
  }

  protected selectTab(tab: TypeTab): void {
    this.current.set(tab);
    this.entryId = '';
  }

  protected readonly preview = computed(() => {
    const parts = ['cmd=give'];
    if (this.uid.trim()) parts.push(`uid=${this.uid.trim()}`);
    parts.push(`type=${this.current().type}`);
    if (this.entryId.trim()) parts.push(`id=${encodeURIComponent(this.entryId.trim())}`);
    if (this.current().hasAmount && this.amount !== null && this.amount > 0) {
      parts.push(`amount=${Math.floor(this.amount)}`);
    }
    for (const key of ['level', 'star', 'skill', 'promote', 'intimacy', 'talent', 'potential', 'baselevel', 'masterylevel']) {
      const raw = this.equip[key];
      if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
        parts.push(`${key}=${String(raw).trim()}`);
      }
    }
    return parts.join('&');
  });

  protected send(): void {
    void this.exec.run(() => {
      const record: Record<string, string> = { cmd: 'give' };
      if (this.uid.trim()) record['uid'] = this.uid.trim();
      record['type'] = this.current().type;
      if (this.entryId.trim()) record['id'] = this.entryId.trim();
      if (this.current().hasAmount && this.amount !== null && this.amount > 0) {
        record['amount'] = String(Math.floor(this.amount));
      }
      for (const key of ['level', 'star', 'skill', 'promote', 'intimacy', 'talent', 'potential', 'baselevel', 'masterylevel']) {
        const raw = this.equip[key];
        if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
          record[key] = String(raw).trim();
        }
      }
      return record;
    });
  }
}
