/**
 * 批量补齐页（giveall）。按类别批量补齐；type=all 与 material/currency 为危险操作。
 */
import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommandBarComponent } from '../../shared/command-bar';
import { ResultPanelComponent } from '../../shared/result-panel';
import { pageExecutor } from '../../shared/page-executor';

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
          <div class="value"><input type="text" inputmode="numeric" [(ngModel)]="uid" (ngModelChange)="bump()" /></div>
        </div>

        @if (current().hasAmount) {
          <div class="commuse-item">
            <div class="label">数量 amount</div>
            <div class="value"><input type="number" min="1" [(ngModel)]="amount" (ngModelChange)="bump()" /></div>
          </div>
        }

        @if (hasEquipmentAttrs()) {
          <fieldset class="commuse-block">
            <legend>装备 / 养成参数（可省略）</legend>
            <div class="commuse-item">
              <div class="label">等级 level</div>
              <div class="value"><input type="number" [(ngModel)]="equip['level']" (ngModelChange)="bump()" /></div>
            </div>
            <div class="commuse-item">
              <div class="label">星级 star</div>
              <div class="value"><input type="number" [(ngModel)]="equip['star']" (ngModelChange)="bump()" /></div>
            </div>
            <div class="commuse-item">
              <div class="label">技能 skill</div>
              <div class="value"><input type="number" [(ngModel)]="equip['skill']" (ngModelChange)="bump()" /></div>
            </div>
            <div class="commuse-item">
              <div class="label">升格 promote</div>
              <div class="value"><input type="number" [(ngModel)]="equip['promote']" (ngModelChange)="bump()" /></div>
            </div>
            <div class="commuse-item">
              <div class="label">亲密 intimacy</div>
              <div class="value"><input type="number" [(ngModel)]="equip['intimacy']" (ngModelChange)="bump()" /></div>
            </div>
            <div class="commuse-item">
              <div class="label">圣痕 talent</div>
              <div class="value"><input type="number" [(ngModel)]="equip['talent']" (ngModelChange)="bump()" /></div>
            </div>
            <div class="commuse-item">
              <div class="label">限解 potential</div>
              <div class="value"><input type="number" [(ngModel)]="equip['potential']" (ngModelChange)="bump()" /></div>
            </div>
            <div class="commuse-item">
              <div class="label">基础等级 baselevel</div>
              <div class="value"><input type="number" [(ngModel)]="equip['baselevel']" (ngModelChange)="bump()" /></div>
            </div>
            <div class="commuse-item">
              <div class="label">精通 masterylevel</div>
              <div class="value"><input type="number" [(ngModel)]="equip['masterylevel']" (ngModelChange)="bump()" /></div>
            </div>
          </fieldset>
        }
      </div>

      <gm-command-bar
        [preview]="preview()"
        [sending]="exec.sending()"
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

  protected readonly tabs = [
    { type: 'all', label: '全部', section: '', hasAmount: false, hint: '覆盖全部可发放装备类型和 IsOpen=1 的看板（不含 skin/potential）。' },
    { type: 'weapon', label: '武器', section: 'weapon', hasAmount: false, hint: '' },
    { type: 'costume', label: '服装', section: 'costume', hasAmount: false, hint: '' },
    { type: 'badge', label: '徽章', section: 'badge', hasAmount: false, hint: '' },
    { type: 'role', label: '角色', section: 'role', hasAmount: false, hint: '' },
    { type: 'partner', label: '看板', section: 'partner', hasAmount: false, hint: '' },
    { type: 'skin', label: '皮肤', section: 'skin', hasAmount: false, hint: '' },
    { type: 'material', label: '材料', section: 'material', hasAmount: true, hint: '按数量累加，必须显式指定 amount。' },
    { type: 'currency', label: '货币', section: 'currency', hasAmount: true, hint: '只发水晶与金币各 amount；活动货币请用「单件发放」按数字 CoinType 单独发。' },
  ];

  protected readonly current = signal(this.tabs[0]);
  protected uid = '';
  protected amount: number | null = null;

  protected readonly equip: Record<string, string | number> = {};

  protected readonly hasEquipmentAttrs = computed(() =>
    ['all', 'weapon', 'costume', 'badge', 'role'].includes(this.current().type),
  );

  protected readonly isDangerous = computed(() =>
    ['all', 'material', 'currency'].includes(this.current().type),
  );

  protected readonly dangerReason = computed(() => {
    const t = this.current().type;
    if (t === 'all') return '将一次性发放全类别物品';
    if (t === 'material') return `将为所有材料各累加 ${this.amount ?? '?'} 个`;
    if (t === 'currency') return `将发放水晶与金币各 ${this.amount ?? '?'}，请确认数量`;
    return '';
  });

  protected selectTab(tab: (typeof this.tabs)[number]): void {
    this.current.set(tab);
  }
  /** 输入触发：每个表单字段 (ngModelChange) 调用，驱动 preview 实时重算 */
  private readonly revision = signal(0);
  protected bump(): void { this.revision.update(n => n + 1); }

  

  protected readonly preview = computed(() => {
    this.revision(); // 实时依赖
    const parts = ['cmd=giveall'];
    if (this.uid.trim()) parts.push(`uid=${this.uid.trim()}`);
    if (this.current().type !== 'all') parts.push(`type=${this.current().type}`);
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
      const record: Record<string, string> = { cmd: 'giveall' };
      if (this.uid.trim()) record['uid'] = this.uid.trim();
      if (this.current().type !== 'all') record['type'] = this.current().type;
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
