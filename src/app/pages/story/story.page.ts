/**
 * 剧情 / 九霄页。
 * 服务端命令集（2026-09）:
 *   - storyrange        普通剧情资源依赖图推进
 *   - kyusyoTaskCompleted (ktc) 九霄任务推进到指定状态；id 可为 all
 *   - kyusyoLevel       (kl)  设置九霄等级 1-99
 *   - kyusyoUnlockLevel (kul) 解锁九霄出击关卡；level 可为 all
 *   - kyusyoAchievement (ka)  完成九霄成就（探索）；id 可为 all
 */
import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommandBarComponent } from '../../shared/command-bar';
import { ResultPanelComponent } from '../../shared/result-panel';
import { EntryPickerComponent } from '../../shared/entry-picker';
import { pageExecutor } from '../../shared/page-executor';
import { HandbookEntry } from '../../core/handbook.service';

type StoryTab = 'storyrange' | 'nsc' | 'ktc' | 'kl' | 'kul' | 'ka';

@Component({
    imports: [FormsModule, CommandBarComponent, ResultPanelComponent, EntryPickerComponent],
    template: `
        <section class="page">
            <header class="page-head">
                <h2>剧情 / 九霄</h2>
                <p>普通剧情推进与九霄任务/关卡/成就命令。ZeroDLC 与旧 dlcunlock/dlcstory 已下线。</p>
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
                    <div class="value"><input type="text" inputmode="numeric" [(ngModel)]="uid" (ngModelChange)="bump()" /></div>
                </div>

                @if (tab() === 'storyrange') {
                    <div class="commuse-item">
                        <div class="label">篇章</div>
                        <div class="value">
                            <div class="seg-tabs">
                                <button type="button" class="seg-tab"
                                        [class.active]="storySection() === '传承篇'"
                                        (click)="setStorySection('传承篇')">传承篇</button>
                                <button type="button" class="seg-tab"
                                        [class.active]="storySection() === '新生篇'"
                                        (click)="setStorySection('新生篇')">新生篇</button>
                            </div>
                        </div>
                    </div>
                    <div class="commuse-item align-top">
                        <div class="label">起点关卡 from</div>
                        <div class="value">
                            <gm-entry-picker
                                [section]="storySection()"
                                placeholder="搜索起点（ID 或章节标题）…"
                                [(value)]="from" (valueChange)="bump()"
                            />
                        </div>
                    </div>
                    <div class="commuse-item align-top">
                        <div class="label">终点关卡 to</div>
                        <div class="value">
                            <gm-entry-picker
                                [section]="storySection()"
                                placeholder="搜索终点（ID 或章节标题）…"
                                [(value)]="to" (valueChange)="bump()"
                            />
                        </div>
                    </div>
                }

                @if (tab() === 'ktc') {
                    <div class="commuse-item align-top">
                        <div class="label">任务 id</div>
                        <div class="value">
                            <gm-entry-picker
                                section="九霄任务目录（逐火之蛾主玩法）"
                                placeholder="搜索任务（ID 或名称）；id=all 时清空"
                                [(value)]="taskId" (valueChange)="bump()"
                                [extraOf]="missionExtra"
                            />
                        </div>
                    </div>
                    <div class="commuse-item">
                        <div class="label">id = all</div>
                        <div class="value">
                            <label class="check">
                                <input type="checkbox" [(ngModel)]="ktcAll" (ngModelChange)="bump()" />
                                <span>全部主线+支线任务；status 缺省 claimed 全完成发奖</span>
                            </label>
                        </div>
                    </div>
                    <div class="commuse-item">
                        <div class="label">目标状态</div>
                        <div class="value">
                            <select [(ngModel)]="ktcStatus" (ngModelChange)="bump()">
                                <option value="claimed">claimed（默认，置可领奖并发放奖励）</option>
                                <option value="claimable">claimable（可领奖，不发奖）</option>
                                <option value="inprogress">inprogress（进行中）</option>
                                <option value="created">created（已创建未接取）</option>
                            </select>
                        </div>
                    </div>
                }

                @if (tab() === 'kl') {
                    <div class="commuse-item">
                        <div class="label">九霄等级 level</div>
                        <div class="value"><input type="number" min="1" max="99" [(ngModel)]="kyusyoLevel" (ngModelChange)="bump()" placeholder="1–99（按 KyusyoData 上限）" /></div>
                    </div>
                }

                @if (tab() === 'nsc') {
                    <div class="commuse-item align-top">
                        <div class="label">章节 id</div>
                        <div class="value">
                            <gm-entry-picker
                                section="崩坏学园篇章节目录"
                                typeFilter="chapter"
                                placeholder="搜索章节（ID 或名称）；容器章节 Type=2 不可用"
                                [(value)]="nscChapterId"
                                (valueChange)="onNscChapterChange($event)"
                                [extraOf]="nscChapterExtra"
                            />
                        </div>
                    </div>
                    <div class="commuse-item align-top">
                        <div class="label">关卡 level</div>
                        <div class="value">
                            <gm-entry-picker
                                section="崩坏学园篇章节目录"
                                typeFilter="level"
                                [filterOf]="nscLevelFilter"
                                [placeholder]="nscChapterId()
                                    ? '搜索关卡（仅显示所选章节的关卡）；留空 = 整章完成'
                                    : '搜索关卡（全部章节）；留空 = 整章完成；可手填逗号分隔多个'"
                                [(value)]="nscLevelId" (valueChange)="bump()"
                            />
                        </div>
                    </div>
                    <div class="commuse-item">
                        <div class="label">执行模式</div>
                        <div class="value">
                            <label class="check">
                                <span>{{ nscLevelId ? 'level 模式：只完成指定关卡（任务推进到可领，奖励自领）' : '整章模式：关卡全通关 + 挑战 + 评分 + 章节任务全部完成发奖' }}</span>
                            </label>
                        </div>
                    </div>
                }

                @if (tab() === 'kul') {
                    <div class="commuse-item align-top">
                        <div class="label">关卡 level</div>
                        <div class="value">
                            <gm-entry-picker
                                section="kyusyoUnlockLevel 九霄关卡目录（逐火之蛾出击）"
                                placeholder="搜索关卡（ID 或名称）；level=all 时清空"
                                [(value)]="levelId" (valueChange)="bump()"
                                [extraOf]="levelExtra"
                            />
                        </div>
                    </div>
                    <div class="commuse-item">
                        <div class="label">前置 trigger</div>
                        <div class="value">
                            <label class="check">
                                <input type="checkbox" [(ngModel)]="kulTrigger" (ngModelChange)="bump()" />
                                <span>trigger=1（默认，沿 ParentId 链解锁前置闭包）</span>
                            </label>
                        </div>
                    </div>
                }

                @if (tab() === 'ka') {
                    <div class="commuse-item align-top">
                        <div class="label">成就 id</div>
                        <div class="value">
                            <gm-entry-picker
                                section="kyusyoAchievement 九霄成就目录（逐火之蛾探索）"
                                placeholder="搜索成就（ID 或名称）；id=all 时清空"
                                [(value)]="achievementId" (valueChange)="bump()"
                                [extraOf]="achievementExtra"
                            />
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
        .commuse-item .value select { width: 100%; }
        .check { display: inline-flex; align-items: center; gap: var(--space-2); font-size: var(--text-sm); color: var(--color-text-2); }

        /* 篇章段控件（传承篇 / 新生篇） */
        .seg-tabs { display: inline-flex; gap: var(--space-1); padding: 4px 0; }
        .seg-tab {
            background: transparent; color: var(--color-text-2);
            padding: 6px 16px; border-radius: var(--radius-md);
            font-size: var(--text-sm); font-weight: var(--weight-medium);
            border: 1px solid var(--color-border-1);
            transition: all var(--duration-fast) var(--ease-default);
        }
        .seg-tab:hover { color: var(--color-primary-6); border-color: var(--color-primary-6); }
        .seg-tab.active { background: var(--color-primary-6); border-color: var(--color-primary-6); color: #fff; }
    `,
})
export class StoryPage {
    protected readonly exec = pageExecutor();

    /** storyrange 用的篇章切换：传承篇 / 新生篇（普通剧情两个分支） */
    protected readonly storySection = signal<'传承篇' | '新生篇'>('传承篇');

    protected readonly tabDefs = [
        {
            cmd: 'storyrange' as const,
            label: '普通剧情',
            hint: '沿普通剧情资源依赖图从 from 推进到 to；前置闭包自动完成，新完成关卡逐项发首通奖励。',
        },
        {
            cmd: 'nsc' as const,
            label: '崩坏学园篇',
            hint: 'newstorycompleted：完成崩坏学园篇整章或指定关卡（通关、挑战触发器补全、评分填满；整章模式额外完成章节任务并发奖）。',
        },
        {
            cmd: 'ktc' as const,
            label: '九霄任务',
            hint: 'kyusyoTaskCompleted：把九霄任务推进到指定状态。status 缺省 claimed（置可领奖并由服务端发奖）。',
        },
        {
            cmd: 'kl' as const,
            label: '九霄等级',
            hint: 'kyusyoLevel：设置九霄等级 1-99，超出 KyusyoData 上限会被拒绝。',
        },
        {
            cmd: 'kul' as const,
            label: '九霄关卡解锁',
            hint: 'kyusyoUnlockLevel：解锁指定九霄关卡。level=all 解锁全部 Type∈{1,2,3,4} 常规关卡；trigger=0 只解指定关卡。',
        },
        {
            cmd: 'ka' as const,
            label: '九霄成就',
            hint: 'kyusyoAchievement：完成九霄成就（探索）并按 KyusyoExpoData 发奖；id=all 完成全部 95 个。',
        },
    ];

    protected readonly tab = signal<StoryTab>('storyrange');
    protected uid = '';

    // storyrange
    protected from = '';
    protected to = '';

    // nsc（newstorycompleted）
    /** 章节 ID：signal，关卡 picker 的 filterOf 依赖它做联动过滤 */
    readonly nscChapterId = signal('');
    protected nscLevelId = '';

    // ktc
    protected taskId = '';
    protected ktcAll = false;
    protected ktcStatus: 'claimed' | 'claimable' | 'inprogress' | 'created' = 'claimed';

    // kl
    protected kyusyoLevel: number | null = null;

    // kul
    protected levelId = '';
    protected kulTrigger = true;

    // ka
    protected achievementId = '';

    protected readonly hint = computed(
        () => this.tabDefs.find(t => t.cmd === this.tab())?.hint ?? '',
    );

    protected readonly isDangerous = computed(() => this.tab() === 'ktc' && this.ktcAll);

    protected readonly dangerReason = computed(() =>
        this.isDangerous()
            ? `将一次性完成全部九霄任务并发放奖励（status=${this.ktcStatus}）`
            : '',
    );

    protected setTab(cmd: StoryTab): void {
        this.tab.set(cmd);
        this.from = '';
        this.to = '';
        this.nscChapterId.set('');
        this.nscLevelId = '';
        this.taskId = '';
        this.levelId = '';
        this.achievementId = '';
    }

    /** storyrange 篇章切换：清空 from/to（跨篇章 ID 不通用） */
    protected setStorySection(s: '传承篇' | '新生篇'): void {
        this.storySection.set(s);
        this.from = '';
        this.to = '';
    }

    protected readonly missionExtra = (e: { attrs: Record<string, string> }): string => {
        const parts: string[] = [];
        if (e.attrs['showtype']) parts.push(e.attrs['showtype']);
        if (e.attrs['parents']) parts.push(`前置 ${e.attrs['parents']}`);
        return parts.join(' · ');
    };

    /** nsc 章节 picker 附加信息：type / 关卡数 / ID 范围 */
    protected readonly nscChapterExtra = (e: { type: string; attrs: Record<string, string> }): string => {
        const parts: string[] = [];
        const t = e.attrs['type'];
        if (t === '1') parts.push('主线');
        else if (t === '3') parts.push('支线/番外');
        else if (t === '2') parts.push('容器（不可用）');
        if (e.attrs['levels']) parts.push(`${e.attrs['levels']} 关`);
        if (e.attrs['range']) parts.push(e.attrs['range']);
        return parts.join(' · ');
    };

    /**
     * 关卡 picker 联动过滤：选中章节后只显示该章节的关卡。
     * 关卡行的 GM 模板含 id=<章节ID>&level=...，从中解析章节归属。
     */
    protected readonly nscLevelFilter = (e: HandbookEntry): boolean => {
        const chapter = this.nscChapterId();
        if (!chapter) return true;
        const m = /(?:^|&)id=(\d+)(?:&|$)/.exec(e.attrs['GM'] ?? '');
        return m !== null && m[1] === chapter;
    };

    /** 章节切换：清空已选关卡（跨章节的关卡 ID 不通用）并触发 preview 重算 */
    protected onNscChapterChange(value: string): void {
        this.nscChapterId.set(value);
        this.nscLevelId = '';
        this.bump();
    }

    protected readonly levelExtra = (e: { attrs: Record<string, string> }): string => {
        const t = e.attrs['levelTypeForServer'];
        const typeMap: Record<string, string> = { '1': '闯关', '2': '生存', '3': '迷宫', '4': '护送' };
        return t ? `type=${typeMap[t] ?? t}` : '';
    };

    protected readonly achievementExtra = (e: { attrs: Record<string, string> }): string => {
        return e.attrs['reward'] ? `奖励 ${e.attrs['reward']}` : '';
    };
    /** 输入触发：每个表单字段 (ngModelChange) 调用，驱动 preview 实时重算 */
    private readonly revision = signal(0);
    protected bump(): void { this.revision.update(n => n + 1); }

    

    protected readonly preview = computed(() => {
        this.revision(); // 实时依赖
        const parts: string[] = [];
        switch (this.tab()) {
            case 'storyrange': {
                parts.push('cmd=storyrange');
                if (this.uid.trim()) parts.push(`uid=${this.uid.trim()}`);
                if (this.from.trim()) parts.push(`from=${encodeURIComponent(this.from.trim())}`);
                if (this.to.trim()) parts.push(`to=${encodeURIComponent(this.to.trim())}`);
                break;
            }
            case 'nsc': {
                parts.push('cmd=nsc');
                if (this.uid.trim()) parts.push(`uid=${this.uid.trim()}`);
                if (this.nscChapterId().trim()) parts.push(`id=${encodeURIComponent(this.nscChapterId().trim())}`);
                if (this.nscLevelId.trim()) parts.push(`level=${encodeURIComponent(this.nscLevelId.trim())}`);
                break;
            }
            case 'ktc': {
                parts.push('cmd=ktc');
                if (this.uid.trim()) parts.push(`uid=${this.uid.trim()}`);
                if (this.ktcAll) {
                    parts.push('id=all');
                } else if (this.taskId.trim()) {
                    parts.push(`id=${encodeURIComponent(this.taskId.trim())}`);
                } else {
                    // 任务 id 必填
                    parts.push('id=__REQUIRED__');
                }
                if (this.ktcStatus !== 'claimed') parts.push(`status=${this.ktcStatus}`);
                break;
            }
            case 'kl': {
                parts.push('cmd=kl');
                if (this.uid.trim()) parts.push(`uid=${this.uid.trim()}`);
                if (this.kyusyoLevel !== null && this.kyusyoLevel > 0) {
                    parts.push(`level=${Math.floor(this.kyusyoLevel)}`);
                }
                break;
            }
            case 'kul': {
                parts.push('cmd=kul');
                if (this.uid.trim()) parts.push(`uid=${this.uid.trim()}`);
                if (this.levelId.trim()) {
                    parts.push(`level=${encodeURIComponent(this.levelId.trim())}`);
                } else {
                    parts.push('level=all');
                }
                if (!this.kulTrigger) parts.push('trigger=0');
                break;
            }
            case 'ka': {
                parts.push('cmd=ka');
                if (this.uid.trim()) parts.push(`uid=${this.uid.trim()}`);
                if (this.achievementId.trim()) {
                    parts.push(`id=${encodeURIComponent(this.achievementId.trim())}`);
                } else {
                    parts.push('id=all');
                }
                break;
            }
        }
        return parts.join('&');
    });

    protected send(): void {
        void this.exec.run(() => {
            const record: Record<string, string> = {};
            if (this.uid.trim()) record['uid'] = this.uid.trim();
            switch (this.tab()) {
                case 'storyrange':
                    record['cmd'] = 'storyrange';
                    if (this.from.trim()) record['from'] = this.from.trim();
                    if (this.to.trim()) record['to'] = this.to.trim();
                    break;
                case 'nsc':
                    record['cmd'] = 'nsc';
                    if (this.nscChapterId().trim()) record['id'] = this.nscChapterId().trim();
                    if (this.nscLevelId.trim()) record['level'] = this.nscLevelId.trim();
                    break;
                case 'ktc':
                    record['cmd'] = 'ktc';
                    if (this.ktcAll) record['id'] = 'all';
                    else if (this.taskId.trim()) record['id'] = this.taskId.trim();
                    if (this.ktcStatus !== 'claimed') record['status'] = this.ktcStatus;
                    break;
                case 'kl':
                    record['cmd'] = 'kl';
                    if (this.kyusyoLevel !== null && this.kyusyoLevel > 0) record['level'] = String(Math.floor(this.kyusyoLevel));
                    break;
                case 'kul':
                    record['cmd'] = 'kul';
                    if (this.levelId.trim()) record['level'] = this.levelId.trim();
                    else record['level'] = 'all';
                    if (!this.kulTrigger) record['trigger'] = '0';
                    break;
                case 'ka':
                    record['cmd'] = 'ka';
                    if (this.achievementId.trim()) record['id'] = this.achievementId.trim();
                    else record['id'] = 'all';
                    break;
            }
            return record;
        });
    }
}
