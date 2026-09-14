/**
 * 玩家管理页：踢下线（kick）与封禁 / 解封（ban）。
 *
 * 命令行（2026-09-14 起）：
 *   /kick [rc|aa|kr|re|ns] [消息...] [@uid]      目标必须在线
 *   /ban [unban] [t结束时间] [r封禁理由] [@uid]   离线玩家也可操作
 *
 * 注意两点服务端行为：
 * 1. kick 的消息与 ban 的 t/r 都走「位置参数」，而 CommandContext 会把形如
 *    x1 / lv80 / r5 / t99 / @uid / -flag 的 token 从位置参数里剔除，因此这些片段
 *    不能出现在消息与理由中（理由本身也不允许含空格）。
 * 2. ban 的 t 为 yyyyMMddHHmm 本地时间；省略默认封禁 1 天，且结束时间必须晚于当前时间。
 */
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommandBarComponent } from '../../shared/command-bar';
import { ResultPanelComponent } from '../../shared/result-panel';
import { pageExecutor } from '../../shared/page-executor';
import { CmdPart, arg, cmdLine } from '../../core/command-line';

type Tab = 'kick' | 'ban';

/** 踢人模式：值与服务端 ExecuteKick 的 mode 一致 */
const KICK_MODES = [
    { value: 'rc', label: 'rc: RegistryCloseReadPacket。弹框显示消息，确认后登出回登录页。' },
    { value: 'aa', label: 'aa: AntiAddictionNotifyPacket。可自定义，确认后登出回登录页。' },
	{ value: 'ns', label: 'ns: NotifyStopServerReadPacket。断开连接，该方法会崩溃。' },
    { value: 'kr', label: 'kr: KindlyRequirePlayerToLogoutPacket。防沉迷，确认后回登录页。' },
    { value: 're', label: 're: ReLoginPacket。客户端只清空数据，游戏内不登出，该方法会NRE。' },
];

@Component({
    imports: [FormsModule, CommandBarComponent, ResultPanelComponent],
    template: `
        <section class="page">
            <header class="page-head">
                <h2>玩家管理</h2>
                <p>kick：把在线玩家踢下线；ban：封禁或解封账号（离线玩家也可操作）。</p>
            </header>

            <div class="tabs" role="tablist">
                @for (t of tabDefs; track t.value) {
                    <button type="button" role="tab"
                                    [class.active]="tab() === t.value"
                                    [attr.aria-selected]="tab() === t.value"
                                    (click)="setTab(t.value)">
                        {{ t.label }}
                    </button>
                }
            </div>
            @if (hint(); as h) {
                <p class="hint">{{ h }}</p>
            }

            <div class="commuse">
                <div class="commuse-item">
                    <div class="label">目标 uid（必填）</div>
                    <div class="value">
                        <input type="text" inputmode="numeric" [(ngModel)]="uid"
                                   [placeholder]="tab() === 'kick' ? '被踢玩家的 UID' : '被封禁/解封玩家的 UID'" />
                    </div>
                </div>

                @if (tab() === 'kick') {
                    <div class="commuse-item">
                        <div class="label">踢出模式</div>
                        <div class="value">
                            <select [(ngModel)]="kickMode">
                                @for (m of kickModes; track m.value) {
                                    <option [value]="m.value">{{ m.label }}</option>
                                }
                            </select>
                        </div>
                    </div>
                    <div class="commuse-item">
                        <div class="label">提示正文</div>
                        <div class="value">
                            <input type="text" [(ngModel)]="kickMessage"
                                       [disabled]="!acceptsMessage()"
                                       [placeholder]="acceptsMessage() ? '留空使用服务端默认文案' : '该模式使用固定文案，此项被忽略'" />
                        </div>
                    </div>
                    <p class="note">目标必须在线，否则服务端返回「目标玩家不存在或不在线」。</p>
                }

                @if (tab() === 'ban') {
                    <div class="commuse-item">
                        <div class="label">操作</div>
                        <div class="value">
                            <select [(ngModel)]="banUnban">
                                <option [ngValue]="false">封禁</option>
                                <option [ngValue]="true">解封（unban）</option>
                            </select>
                        </div>
                    </div>

                    @if (!banUnban) {
                        <div class="commuse-item">
                            <div class="label">结束时间 t</div>
                            <div class="value">
                                <input type="datetime-local" [(ngModel)]="banUntil" />
                            </div>
                        </div>
                        <div class="commuse-item">
                            <div class="label">封禁理由 r</div>
                            <div class="value">
                                <input type="text" [(ngModel)]="banReason" placeholder="留空使用默认文案；不能含空格" />
                            </div>
                        </div>
                        <p class="note">
                            结束时间留空 = 封禁 1 天；必须晚于当前时间，服务端按本地时区解析
                            {{ banTime() ? '（当前将发送 t' + banTime() + '）' : '' }}。
                        </p>
                    }
                }
            </div>

            @if (warning(); as w) {
                <p class="warn">{{ w }}</p>
            }

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
        .commuse-item .label {
            width: 140px; text-align: right; padding-right: 10px;
            color: var(--color-text-2); font-size: var(--text-sm); flex-shrink: 0;
        }
        .commuse-item .value { flex: 1; min-width: 0; }
        .commuse-item .value select { width: 100%; }
        .note { margin: var(--space-1) 0 0 150px; font-size: var(--text-xs); color: var(--color-text-3); }
        .warn { margin: var(--space-2) 0 0; font-size: var(--text-xs); color: var(--color-warning); }
    `,
})
export class ModerationPage {
    protected readonly exec = pageExecutor();

    protected readonly tabDefs: { value: Tab; label: string }[] = [
        { value: 'kick', label: '踢下线' },
        { value: 'ban', label: '封禁 / 解封' },
    ];
    protected readonly kickModes = KICK_MODES;

    protected readonly tab = signal<Tab>('kick');
    protected uid = '';

    // kick
    protected kickMode = 'rc';
    protected kickMessage = '';

    // ban
    protected banUnban = false;
    protected banUntil = '';
    protected banReason = '';

    protected setTab(value: Tab): void {
        this.tab.set(value);
    }

    protected hint(): string {
        return this.tab() === 'kick'
            ? '/kick [rc|aa|kr|re|ns] [消息...] [@uid]：目标必须在线。'
            : '/ban [unban] [t结束时间] [r封禁理由] [@uid]：t 为 yyyyMMddHHmm 本地时间，省略默认 1 天。';
    }

    /** rc / aa 支持自定义正文，其余模式文案固定 */
    protected acceptsMessage(): boolean {
        return this.kickMode === 'rc' || this.kickMode === 'aa';
    }

    /** datetime-local 的 'YYYY-MM-DDTHH:mm' → 服务端要的 'yyyyMMddHHmm' */
    protected banTime(): string {
        const matched = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(this.banUntil.trim());
        return matched ? `${matched[1]}${matched[2]}${matched[3]}${matched[4]}${matched[5]}` : '';
    }

    /** 服务端会把修饰符形态的 token 从位置参数里剔除，这里提前提示 */
    protected warning(): string {
        if (this.tab() === 'ban' && !this.banUnban) {
            const time = this.banTime();
            // 服务端要求结束时间晚于当前时间（本地时区）
            if (this.banUntil.trim() && !time) return '结束时间格式无效，请重新选择。';
            if (time && time <= localStamp()) return '结束时间必须晚于当前时间。';

            const reason = this.banReason.trim();
            if (!reason) return '';
            if (/\s/.test(reason)) return '封禁理由不能含空格，服务端会报「未识别的参数」。';
            if (reason.startsWith('@')) return '封禁理由不能以 @ 开头，它会被当作目标 UID。';
            if (isModifierLike(reason)) return '封禁理由不能是 x1 / lv80 / r5 / t99 / -flag 这类修饰符，服务端会把它从理由里剔除。';
            return '';
        }

        if (this.tab() !== 'kick' || !this.acceptsMessage()) return '';

        const tokens = this.kickMessage.trim().split(/\s+/).filter(Boolean);
        if (tokens.length === 0) return '';
        if (tokens.some(token => token.startsWith('@'))) {
            return '正文里不能出现 @ 开头的片段，它会被当作目标 UID。';
        }
        if (tokens.some(isModifierLike)) {
            return '正文里不能出现 x1 / lv80 / r5 / t99 / -flag 这类修饰符片段，服务端会把它从正文里剔除。';
        }
        return '';
    }

    protected canSend(): boolean {
        if (!this.uid.trim()) return false;
        return this.warning() === '';
    }

    protected isDangerous(): boolean {
        if (this.tab() === 'kick') return true;
        return !this.banUnban;
    }

    protected dangerReason(): string {
        if (this.tab() === 'kick') return `将把玩家 ${this.uid.trim()} 踢下线`;
        return this.banUnban ? '' : `将封禁玩家 ${this.uid.trim()} 的账号`;
    }

    protected preview(): string {
        if (this.tab() === 'kick') {
            const parts: CmdPart[] = [arg(this.kickMode)];
            if (this.acceptsMessage()) parts.push(arg(this.kickMessage));
            return cmdLine('kick', parts, this.uid);
        }

        const parts: CmdPart[] = [];
        if (this.banUnban) {
            parts.push(arg('unban'));
        } else {
            parts.push(arg(this.banTime() ? `t${this.banTime()}` : null), arg(this.banReason.trim() ? `r${this.banReason.trim()}` : null));
        }
        return cmdLine('ban', parts, this.uid);
    }

    protected send(): void {
        void this.exec.run(() => this.preview());
    }
}

/** 与服务端 CommandContext.TryParseModifier 相同的修饰符形态判断 */
function isModifierLike(token: string): boolean {
    if (/^-\D/.test(token)) return true;
    return /^(x|X|\*)\d+$/.test(token) || /^(lv|pt|bl|ml|sk)\d+$/i.test(token) || /^(r|p|s|i|t)\d+$/i.test(token);
}

/** 当前本地时间的 yyyyMMddHHmm，用于和服务端同一口径比较 */
function localStamp(): string {
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}`;
}
