/**
 * 剧情 / 九霄页。
 * 服务端命令集（2026-09-14，共 14 条）:
 *   - storycompleted (sc)        完成普通剧情指定关卡及其全部资源前置
 *   - newstorycompleted (nsc)    完成崩坏学园篇整章或指定关卡
 *   - kyusyoTaskCompleted (ktc)  九霄任务推进到指定状态；id 可为 all
 *   - kyusyoLevel (kl)           设置九霄等级（范围由 KyusyoData 资源表决定）
 *   - kyusyoUnlockLevel (kul)    解锁九霄出击关卡；id 可为 all
 *   - kyusyoAchievement (ka)     完成九霄成就（探索）；id 可为 all
 *
 * 命令行（统一为 LunarCore 风格，位置参数 + 前缀修饰符 + -flag + @uid）:
 *   /storycompleted <终点关卡> [@uid]
 *   /newstorycompleted <章节菜单ID> [关卡ID] [-noprecede] [@uid]
 *   /kyusyoTaskCompleted <任务ID|all> [status] [@uid]
 *   /kyusyoLevel <等级> [-notrigger] [@uid]（也接受 /kl lv<等级> [@uid]）
 *   /kyusyoUnlockLevel <关卡ID|all> [-notrigger] [@uid]
 *   /kyusyoAchievement <ExpoID|all> [@uid]
 */
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommandBarComponent } from '../../shared/command-bar';
import { ResultPanelComponent } from '../../shared/result-panel';
import { EntryPickerComponent } from '../../shared/entry-picker';
import { pageExecutor } from '../../shared/page-executor';
import { HandbookEntry, parseGmTemplate } from '../../core/handbook.service';
import { CmdPart, arg, cmdLine, flag } from '../../core/command-line';

type StoryTab = 'sc' | 'nsc' | 'ktc' | 'kl' | 'kul' | 'ka';

@Component({
    imports: [FormsModule, CommandBarComponent, ResultPanelComponent, EntryPickerComponent],
    template: `
        <section class="page">
            <header class="page-head">
                <h2>剧情 / 九霄</h2>
                <p>普通剧情 / 崩坏学园篇 / 九霄任务·等级·关卡·成就命令。</p>
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

                @if (tab() === 'sc') {
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
                        <div class="label">终点关卡</div>
                        <div class="value">
                            <gm-entry-picker
                                [section]="storySection()"
                                placeholder="搜索关卡（ID 或章节标题）…"
                                [(value)]="to"
                            />
                        </div>
                    </div>
                }

                @if (tab() === 'nsc') {
                    <div class="commuse-item align-top">
                        <div class="label">章节 ID</div>
                        <div class="value">
                            <gm-entry-picker
                                section="崩坏学园篇章节目录"
                                typeFilter="chapter"
                                placeholder="搜索章节（ID 或名称）；容器章节 Type=2 不可用"
                                [(value)]="nscChapterId"
                                [extraOf]="nscChapterExtra"
                            />
                        </div>
                    </div>
                    <div class="commuse-item align-top">
                        <div class="label">关卡 ID</div>
                        <div class="value">
                            <gm-entry-picker
                                section="崩坏学园篇章节目录"
                                typeFilter="level"
                                [filterOf]="nscLevelFilter"
                                [toggleable]="true"
                                [placeholder]="nscChapterId()
                                    ? '搜索关卡（仅显示所选章节的关卡）；留空 = 整章完成'
                                    : '搜索关卡（全部章节）；留空 = 整章完成'"
                                [(value)]="nscLevelId"
                            />
                        </div>
                    </div>
                    <div class="commuse-item">
                        <div class="label">执行模式</div>
                        <div class="value">
                            <span class="mode">{{ nscLevelId ? 'level 模式：只完成指定关卡（已达成的可领任务自动领取发奖）' : '整章模式：关卡全通关 + 挑战 + 评分 + 章节任务全部完成发奖' }}</span>
                        </div>
                    </div>
                    @if (nscLevelId) {
                        <div class="commuse-item">
                            <div class="label">自动前置</div>
                            <div class="value">
                                <label class="check">
                                    <input type="checkbox" [(ngModel)]="nscPrecede" />
                                    <span>自动一并完成章节内排在目标关卡之前的关卡（取消勾选则追加 -noprecede）</span>
                                </label>
                            </div>
                        </div>
                    }
                }

                @if (tab() === 'ktc') {
                    <div class="commuse-item align-top">
                        <div class="label">任务 ID</div>
                        <div class="value">
                            <gm-entry-picker
                                section="九霄任务目录（逐火之蛾主玩法）"
                                placeholder="搜索任务（ID 或名称）；勾选下方 all 时忽略"
                                [(value)]="taskId"
                                [extraOf]="missionExtra"
                            />
                        </div>
                    </div>
                    <div class="commuse-item">
                        <div class="label">id = all</div>
                        <div class="value">
                            <label class="check">
                                <input type="checkbox" [(ngModel)]="ktcAll" />
                                <span>全部主线+支线任务；status 缺省 claimed 全完成发奖</span>
                            </label>
                        </div>
                    </div>
                    <div class="commuse-item">
                        <div class="label">目标状态</div>
                        <div class="value">
                            <select [(ngModel)]="ktcStatus">
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
                        <div class="label">九霄等级</div>
                        <div class="value"><input type="number" min="1" [(ngModel)]="kyusyoLevel" placeholder="按 KyusyoData 资源表上限" /></div>
                    </div>
                    <div class="commuse-item">
                        <div class="label">联动解锁</div>
                        <div class="value">
                            <label class="check">
                                <input type="checkbox" [(ngModel)]="klTrigger" />
                                <span>按新等级刷新武器解锁与槽位并联动触发关卡解锁（取消勾选则追加 -notrigger）</span>
                            </label>
                        </div>
                    </div>
                }

                @if (tab() === 'kul') {
                    <div class="commuse-item align-top">
                        <div class="label">关卡 ID</div>
                        <div class="value">
                            <gm-entry-picker
                                section="kyusyoUnlockLevel 九霄关卡目录（逐火之蛾出击）"
                                placeholder="搜索关卡（ID 或名称）；留空 = all"
                                [(value)]="levelId"
                                [extraOf]="levelExtra"
                            />
                        </div>
                    </div>
                    <div class="commuse-item">
                        <div class="label">前置闭包</div>
                        <div class="value">
                            <label class="check">
                                <input type="checkbox" [(ngModel)]="kulTrigger" />
                                <span>沿 ParentId 链把前置一并置为可打（取消勾选则追加 -notrigger）</span>
                            </label>
                        </div>
                    </div>
                }

                @if (tab() === 'ka') {
                    <div class="commuse-item align-top">
                        <div class="label">成就 ID</div>
                        <div class="value">
                            <gm-entry-picker
                                section="kyusyoAchievement 九霄成就目录（逐火之蛾探索）"
                                placeholder="搜索成就（ID 或名称）；留空 = all"
                                [(value)]="achievementId"
                                [extraOf]="achievementExtra"
                            />
                        </div>
                    </div>
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
        .mode { font-size: var(--text-sm); color: var(--color-text-2); }

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

    /** sc（普通剧情）用的篇章切换：传承篇 / 新生篇 */
    protected readonly storySection = signal<'传承篇' | '新生篇'>('传承篇');

    protected readonly tabDefs = [
        {
            cmd: 'sc' as const,
            label: '普通剧情',
            hint: '/storycompleted <终点关卡>：完成指定关卡及其全部资源前置（同章节在它之前的关卡），逐关执行确定性首通结算。',
        },
        {
            cmd: 'nsc' as const,
            label: '崩坏学园篇',
            hint: '/newstorycompleted <章节菜单ID> [关卡ID] [-noprecede]：整章模式完成关卡/挑战/评分/章节任务并发奖；给关卡则为 level 模式。',
        },
        {
            cmd: 'ktc' as const,
            label: '九霄任务',
            hint: '/kyusyoTaskCompleted <任务ID|all> [status]：status 缺省 claimed（置可领奖并由服务端发奖）。',
        },
        {
            cmd: 'kl' as const,
            label: '九霄等级',
            hint: '/kyusyoLevel <等级> [-notrigger]：等级范围由 KyusyoData 资源表决定，超出即拒绝。',
        },
        {
            cmd: 'kul' as const,
            label: '九霄关卡解锁',
            hint: '/kyusyoUnlockLevel <关卡ID|all> [-notrigger]：all 解锁全部 Type∈{1,2,3,4} 常规关卡（type=4 为护送）。',
        },
        {
            cmd: 'ka' as const,
            label: '九霄成就',
            hint: '/kyusyoAchievement <ExpoID|all>：按 KyusyoExpoData 发奖，已完成的 expo 幂等不重复发奖。',
        },
    ];

    protected readonly tab = signal<StoryTab>('sc');
    protected uid = '';

    // sc（storycompleted）
    protected to = '';

    // nsc（newstorycompleted）
    /** 章节 ID：关卡 picker 的 filterOf 依赖它做联动过滤 */
    readonly nscChapterId = signal('');
    protected nscLevelId = '';
    /** 自动完成前置关卡（默认开启，关闭时追加 -noprecede） */
    protected nscPrecede = true;

    // ktc
    protected taskId = '';
    protected ktcAll = false;
    protected ktcStatus: 'claimed' | 'claimable' | 'inprogress' | 'created' = 'claimed';

    // kl
    protected kyusyoLevel: number | null = null;
    protected klTrigger = true;

    // kul
    protected levelId = '';
    protected kulTrigger = true;

    // ka
    protected achievementId = '';

    protected hint(): string {
        return this.tabDefs.find(t => t.cmd === this.tab())?.hint ?? '';
    }

    protected isDangerous(): boolean {
        return (this.tab() === 'ktc' && this.ktcAll) || (this.tab() === 'nsc' && !this.nscLevelId);
    }

    protected dangerReason(): string {
        if (this.tab() === 'ktc' && this.ktcAll) {
            return `将一次性完成全部九霄任务并发放奖励（status=${this.ktcStatus}）`;
        }
        if (this.tab() === 'nsc' && !this.nscLevelId) {
            return '整章模式将完成该章节全部关卡并领取所有章节任务奖励';
        }
        return '';
    }

    /** 各 tab 的必填项校验 */
    protected canSend(): boolean {
        switch (this.tab()) {
            case 'sc':
                return this.to.trim() !== '';
            case 'nsc':
                return this.nscChapterId().trim() !== '';
            case 'ktc':
                return this.ktcAll || this.taskId.trim() !== '';
            case 'kl':
                return this.kyusyoLevel !== null && this.kyusyoLevel > 0;
            case 'kul':
            case 'ka':
                return true; // 留空即 all
        }
    }

    protected setTab(cmd: StoryTab): void {
        this.tab.set(cmd);
        this.to = '';
        this.nscChapterId.set('');
        this.nscLevelId = '';
        this.taskId = '';
        this.levelId = '';
        this.achievementId = '';
    }

    /** sc 篇章切换：清空 to（跨篇章 ID 不通用） */
    protected setStorySection(s: '传承篇' | '新生篇'): void {
        this.storySection.set(s);
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
     * 关卡行的 GM 模板形如 newstorycompleted&uid=<UID>&id=2&level=402001，
     * 归一化后的第一个位置参数就是所属章节 ID。
     */
    protected readonly nscLevelFilter = (e: HandbookEntry): boolean => {
        const chapter = this.nscChapterId();
        if (!chapter) return true;
        return parseGmTemplate(e.attrs['GM'] ?? '').positionals[0] === chapter;
    };

    protected readonly levelExtra = (e: { attrs: Record<string, string> }): string => {
        const t = e.attrs['levelTypeForServer'];
        const typeMap: Record<string, string> = { '1': '闯关', '2': '生存', '3': '迷宫', '4': '护送' };
        return t ? `type=${typeMap[t] ?? t}` : '';
    };

    protected readonly achievementExtra = (e: { attrs: Record<string, string> }): string => {
        return e.attrs['reward'] ? `奖励 ${e.attrs['reward']}` : '';
    };

    protected preview(): string {
        const tab = this.tab();
        if (tab === 'sc') {
            return cmdLine('storycompleted', [arg(this.to)], this.uid);
        }
        if (tab === 'nsc') {
            const parts: CmdPart[] = [arg(this.nscChapterId()), arg(this.nscLevelId)];
            if (this.nscLevelId) parts.push(flag('noprecede', !this.nscPrecede));
            return cmdLine('newstorycompleted', parts, this.uid);
        }
        if (tab === 'ktc') {
            const parts: CmdPart[] = [arg(this.ktcAll ? 'all' : this.taskId)];
            if (this.ktcStatus !== 'claimed') parts.push(arg(this.ktcStatus));
            return cmdLine('kyusyoTaskCompleted', parts, this.uid);
        }
        if (tab === 'kl') {
            return cmdLine('kyusyoLevel', [arg(this.kyusyoLevel), flag('notrigger', !this.klTrigger)], this.uid);
        }
        if (tab === 'kul') {
            return cmdLine(
                'kyusyoUnlockLevel',
                [arg(this.levelId || 'all'), flag('notrigger', !this.kulTrigger)],
                this.uid,
            );
        }
        return cmdLine('kyusyoAchievement', [arg(this.achievementId || 'all')], this.uid);
    }

    protected send(): void {
        void this.exec.run(() => this.preview());
    }
}
