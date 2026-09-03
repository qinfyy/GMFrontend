/**
 * 剧情推进页。覆盖 5 条命令：storyrange / kyusyoclear / kyusystory / dlcstory / dlcunlock。
 */
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommandBarComponent } from '../../shared/command-bar';
import { ResultPanelComponent } from '../../shared/result-panel';
import { EntryPickerComponent } from '../../shared/entry-picker';
import { pageExecutor } from '../../shared/page-executor';

type StoryTab = 'storyrange' | 'kyusyoclear' | 'kyusystory' | 'dlcstory' | 'dlcunlock';

@Component({
  imports: [FormsModule, CommandBarComponent, ResultPanelComponent, EntryPickerComponent],
  template: `
    <section class="page">
      <header class="page-head">
        <h2>剧情推进</h2>
        <p>普通剧情、九霄与逐火之蛾 DLC 的进度命令。NPC/Boss 图鉴只接受真实战斗上报，不由 GM 伪造。</p>
      </header>

      <div class="tabs" role="tablist">
        @for (t of tabDefs; track t.cmd) {
          <button type="button" role="tab"
                  [class.active]="tab() === t.cmd"
                  [attr.aria-selected]="tab() === t.cmd"
                  (click)="setTab(t.cmd)">
            {{ t.label }}
          </button>
        }
      </div>
      @if (hint(); as h) {
        <p class="hint">{{ h }}</p>
      }

      <div class="commuse">
        <div class="commuse-item">
          <div class="label">uid</div>
          <div class="value"><input type="text" inputmode="numeric" [(ngModel)]="uid" /></div>
        </div>

        @if (tab() === 'storyrange') {
          <div class="commuse-item">
            <div class="label">起点关卡 from</div>
            <div class="value"><input type="number" min="1" [(ngModel)]="from" /></div>
          </div>
          <div class="commuse-item">
            <div class="label">终点关卡 to</div>
            <div class="value"><input type="number" min="1" [(ngModel)]="to" /></div>
          </div>
        }

        @if (tab() === 'kyusyoclear') {
          <div class="commuse-item align-top">
            <div class="label">选择关卡</div>
            <div class="value">
              <gm-entry-picker section="九霄关卡" placeholder="搜索九霄关卡…" [(value)]="levelId" />
            </div>
          </div>
        }
        @if (tab() === 'kyusystory') {
          <div class="commuse-item align-top">
            <div class="label">选择故事</div>
            <div class="value">
              <gm-entry-picker section="九霄故事" placeholder="搜索九霄故事；选「全部已读」可不填" [(value)]="storyId" />
            </div>
          </div>
          <div class="commuse-item">
            <div class="label">全部已读</div>
            <div class="value">
              <label class="check">
                <input type="checkbox" [(ngModel)]="kyusyoAll" />
                <span>all=1</span>
              </label>
            </div>
          </div>
        }
        @if (tab() === 'dlcstory') {
          <div class="commuse-item align-top">
            <div class="label">选择故事</div>
            <div class="value">
              <gm-entry-picker section="逐火之蛾 DLC 故事" placeholder="搜索逐火 DLC 故事；选「全部已读」可不填" [(value)]="storyId" />
            </div>
          </div>
          <div class="commuse-item">
            <div class="label">全部已读</div>
            <div class="value">
              <label class="check">
                <input type="checkbox" [(ngModel)]="dlcAll" />
                <span>all=1</span>
              </label>
            </div>
          </div>
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
    .commuse-item.align-top { align-items: flex-start; }
    .commuse-item .label {
      width: 120px; text-align: right; padding-right: 10px;
      color: var(--color-text-2); font-size: var(--text-sm); flex-shrink: 0;
      line-height: 32px;
    }
    .commuse-item.align-top .label { line-height: 1.5; padding-top: 6px; }
    .commuse-item .value { flex: 1; min-width: 0; }
    .check { display: inline-flex; align-items: center; gap: var(--space-2); line-height: 32px; font-size: var(--text-sm); color: var(--color-text-2); }
  `,
})
export class StoryPage {
  protected readonly exec = pageExecutor();

  protected readonly tabDefs = [
    { cmd: 'storyrange' as const, label: '普通剧情', hint: '沿普通剧情资源依赖图从 from 推进到 to，前置闭包自动完成，新完成关卡逐项发首通奖励。from=to 也合法。' },
    { cmd: 'kyusyoclear' as const, label: '九霄通关', hint: '沿九霄资源依赖图完成指定关卡并解锁后继；不改等级/经验/体力/计时点。存在活动战斗会话时会被拒绝。' },
    { cmd: 'kyusystory' as const, label: '九霄故事', hint: '把指定九霄故事或全部标记为已读，不完成关卡、不推进任务、不发奖。' },
    { cmd: 'dlcstory' as const, label: '逐火故事', hint: '把指定逐火之蛾 DLC 故事或全部标记为已读，不改 ZeroRole/关卡/任务/奖励。' },
    { cmd: 'dlcunlock' as const, label: '逐火全解锁', hint: '解锁逐火之蛾 DLC 全部可玩角色、专用装备、天赋、符文和关卡；不伪造通关/任务/成就/收益。' },
  ];

  protected readonly tab = signal<StoryTab>('storyrange');
  protected uid = '';
  protected from: number | null = null;
  protected to: number | null = null;
  protected levelId = '';
  protected storyId = '';
  protected kyusyoAll = false;
  protected dlcAll = false;

  protected readonly hint = computed(
    () => this.tabDefs.find(t => t.cmd === this.tab())?.hint ?? '',
  );

  protected readonly isDangerous = computed(() => this.tab() === 'dlcunlock');

  protected readonly dangerReason = computed(() =>
    this.isDangerous() ? '将一次性解锁全部 DLC 内容' : '',
  );

  protected setTab(cmd: StoryTab): void {
    this.tab.set(cmd);
    this.levelId = '';
    this.storyId = '';
  }

  protected readonly preview = computed(() => {
    const parts = [`cmd=${this.tab()}`];
    if (this.uid.trim()) parts.push(`uid=${this.uid.trim()}`);
    switch (this.tab()) {
      case 'storyrange': {
        if (this.from !== null && this.from > 0) parts.push(`from=${Math.floor(this.from)}`);
        if (this.to !== null && this.to > 0) parts.push(`to=${Math.floor(this.to)}`);
        break;
      }
      case 'kyusyoclear':
        if (this.levelId.trim()) parts.push(`level=${encodeURIComponent(this.levelId.trim())}`);
        break;
      case 'kyusystory':
        if (this.kyusyoAll) parts.push('all=1');
        else if (this.storyId.trim()) parts.push(`id=${encodeURIComponent(this.storyId.trim())}`);
        break;
      case 'dlcstory':
        if (this.dlcAll) parts.push('all=1');
        else if (this.storyId.trim()) parts.push(`id=${encodeURIComponent(this.storyId.trim())}`);
        break;
      case 'dlcunlock':
        parts.push('all=1');
        break;
    }
    return parts.join('&');
  });

  protected send(): void {
    void this.exec.run(() => {
      const record: Record<string, string> = { cmd: this.tab() };
      if (this.uid.trim()) record['uid'] = this.uid.trim();
      switch (this.tab()) {
        case 'storyrange':
          if (this.from !== null && this.from > 0) record['from'] = String(Math.floor(this.from));
          if (this.to !== null && this.to > 0) record['to'] = String(Math.floor(this.to));
          break;
        case 'kyusyoclear':
          if (this.levelId.trim()) record['level'] = this.levelId.trim();
          break;
        case 'kyusystory':
          if (this.kyusyoAll) record['all'] = '1';
          else if (this.storyId.trim()) record['id'] = this.storyId.trim();
          break;
        case 'dlcstory':
          if (this.dlcAll) record['all'] = '1';
          else if (this.storyId.trim()) record['id'] = this.storyId.trim();
          break;
        case 'dlcunlock':
          record['all'] = '1';
          break;
      }
      return record;
    });
  }
}
