/**
 * 账号管理页（account）。
 * 服务端命令：account&operate=<create|settings|delete|ForceLogin>。
 * 注意：create 不传 username 时用 mobile 创建；
 *       settings/delete 的 query 只支持 username 或 mobile，不支持密码。
 *       ForceLogin 把 uid 写入内存（uid=0 清除待执行强制登录），不修改账号数据。
 */
import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommandBarComponent } from '../../shared/command-bar';
import { ResultPanelComponent } from '../../shared/result-panel';
import { pageExecutor } from '../../shared/page-executor';

type Operate = 'create' | 'settings' | 'delete' | 'forcelogin';

@Component({
    imports: [FormsModule, CommandBarComponent, ResultPanelComponent],
    template: `
        <section class="page">
            <header class="page-head">
                <h2>账号管理</h2>
                <p>account：管理 SDK 账号，或安排下一次连接强制登录指定 game 账号。操作均在内存中生效。</p>
            </header>

            <div class="tabs" role="tablist">
                @for (op of operations; track op.value) {
                    <button type="button" role="tab"
                                    [class.active]="operate() === op.value"
                                    [attr.aria-selected]="operate() === op.value"
                                    (click)="selectOp(op.value)">
                        {{ op.label }}
                    </button>
                }
            </div>
            @if (currentHint(); as h) {
                <p class="hint">{{ h }}</p>
            }

            <div class="commuse">
                @if (operate() === 'create') {
                    <div class="commuse-item">
                        <div class="label">用户名 username</div>
                        <div class="value"><input type="text" [(ngModel)]="username" (ngModelChange)="bump()" placeholder="可省略（用 mobile 创建）" /></div>
                    </div>
                    <div class="commuse-item">
                        <div class="label">密码 password</div>
                        <div class="value">
                            <input type="password" [(ngModel)]="password" (ngModelChange)="bump()" placeholder="提供密码时必须同时填 username" />
                        </div>
                    </div>
                    <div class="commuse-item">
                        <div class="label">手机号 mobile</div>
                        <div class="value"><input type="text" inputmode="numeric" [(ngModel)]="mobile" (ngModelChange)="bump()" placeholder="username、mobile 至少提供一个" /></div>
                    </div>
                }

                @if (operate() === 'settings') {
                    <div class="commuse-item">
                        <div class="label">query（必填）</div>
                        <div class="value">
                            <input type="text" [(ngModel)]="query" (ngModelChange)="bump()" placeholder="被改账号的 username 或 mobile，不支持密码查询" />
                        </div>
                    </div>
                    <fieldset class="commuse-block">
                        <legend>新值（仅给出的字段会被修改）</legend>
                        <div class="commuse-item">
                            <div class="label">新用户名 newusername</div>
                            <div class="value"><input type="text" [(ngModel)]="newUsername" (ngModelChange)="bump()" /></div>
                        </div>
                        <div class="commuse-item">
                            <div class="label">新密码 newpassword</div>
                            <div class="value"><input type="password" [(ngModel)]="newPassword" (ngModelChange)="bump()" /></div>
                        </div>
                        <div class="commuse-item">
                            <div class="label">新手机号 newmobile</div>
                            <div class="value"><input type="text" inputmode="numeric" [(ngModel)]="newMobile" (ngModelChange)="bump()" /></div>
                        </div>
                    </fieldset>
                }

                @if (operate() === 'delete') {
                    <div class="commuse-item">
                        <div class="label">query（必填）</div>
                        <div class="value">
                            <input type="text" [(ngModel)]="query" (ngModelChange)="bump()" placeholder="被删账号的 username 或 mobile" />
                        </div>
                    </div>
                }

                @if (operate() === 'forcelogin') {
                    <div class="commuse-item">
                        <div class="label">uid</div>
                        <div class="value">
                            <input type="text" inputmode="numeric" [(ngModel)]="forceLoginUid" (ngModelChange)="bump()" placeholder="玩家 UID；填 0 清除待执行的强制登录" />
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
        .commuse-item .label {
            width: 140px; text-align: right; padding-right: 10px;
            color: var(--color-text-2); font-size: var(--text-sm); flex-shrink: 0;
        }
        .commuse-item .value { flex: 1; min-width: 0; }
        .commuse-block { border: none; padding: 0; margin: var(--space-3) 0 0; }
        .commuse-block legend { font-size: var(--text-sm); color: var(--color-text-2); padding: 0; margin-bottom: var(--space-2); }
    `,
})
export class AccountPage {
    protected readonly exec = pageExecutor();

    protected readonly operations: { value: Operate; label: string; hint: string }[] = [
        { value: 'create', label: '创建', hint: 'create：username、mobile 至少提供一个；提供 password 必须同时提供 username。' },
        { value: 'settings', label: '修改', hint: 'settings：query 只支持 username/mobile。仅给出的新字段会被修改。' },
        { value: 'delete', label: '删除', hint: 'delete：按 username/mobile 删除账号。' },
        { value: 'forcelogin', label: '强制登录', hint: 'ForceLogin：uid=0 清除待执行强制登录；非 0 时下一次 Gateway 登录会改为该玩家。' },
    ];

    protected readonly operate = signal<Operate>('create');

    // 通用字段
    protected username = '';
    protected password = '';
    protected mobile = '';

    // settings 专用
    protected query = '';
    protected newUsername = '';
    protected newPassword = '';
    protected newMobile = '';

    // forcelogin 专用
    protected forceLoginUid = '';

    protected readonly currentHint = computed(
        () => this.operations.find(o => o.value === this.operate())?.hint ?? '',
    );

    protected selectOp(op: Operate): void {
        this.operate.set(op);
    }

    protected readonly isDangerous = computed(() => this.operate() === 'delete');

    protected readonly dangerReason = computed(() =>
        this.operate() === 'delete' ? '将删除该账号及其关联玩家数据' : '',
    );
    /** 输入触发：每个表单字段 (ngModelChange) 调用，驱动 preview 实时重算 */
    private readonly revision = signal(0);
    protected bump(): void { this.revision.update(n => n + 1); }

    

    protected readonly preview = computed(() => {
        this.revision(); // 实时依赖
        const parts: string[] = ['cmd=account'];
        switch (this.operate()) {
            case 'create':
                parts.push('operate=create');
                if (this.username.trim()) parts.push(`username=${encodeURIComponent(this.username.trim())}`);
                if (this.password.trim()) parts.push(`password=${encodeURIComponent(this.password.trim())}`);
                if (this.mobile.trim()) parts.push(`mobile=${encodeURIComponent(this.mobile.trim())}`);
                break;
            case 'settings':
                parts.push('operate=settings');
                if (this.query.trim()) parts.push(`query=${encodeURIComponent(this.query.trim())}`);
                if (this.newUsername.trim()) parts.push(`newusername=${encodeURIComponent(this.newUsername.trim())}`);
                if (this.newPassword.trim()) parts.push(`newpassword=${encodeURIComponent(this.newPassword.trim())}`);
                if (this.newMobile.trim()) parts.push(`newmobile=${encodeURIComponent(this.newMobile.trim())}`);
                break;
            case 'delete':
                parts.push('operate=delete');
                if (this.query.trim()) parts.push(`query=${encodeURIComponent(this.query.trim())}`);
                break;
            case 'forcelogin':
                parts.push('operate=ForceLogin');
                if (this.forceLoginUid.trim()) parts.push(`uid=${this.forceLoginUid.trim()}`);
                break;
        }
        return parts.join('&');
    });

    protected send(): void {
        void this.exec.run(() => {
            const record: Record<string, string> = { cmd: 'account' };
            switch (this.operate()) {
                case 'create':
                    record['operate'] = 'create';
                    if (this.username.trim()) record['username'] = this.username.trim();
                    if (this.password.trim()) record['password'] = this.password.trim();
                    if (this.mobile.trim()) record['mobile'] = this.mobile.trim();
                    break;
                case 'settings':
                    record['operate'] = 'settings';
                    if (this.query.trim()) record['query'] = this.query.trim();
                    if (this.newUsername.trim()) record['newusername'] = this.newUsername.trim();
                    if (this.newPassword.trim()) record['newpassword'] = this.newPassword.trim();
                    if (this.newMobile.trim()) record['newmobile'] = this.newMobile.trim();
                    break;
                case 'delete':
                    record['operate'] = 'delete';
                    if (this.query.trim()) record['query'] = this.query.trim();
                    break;
                case 'forcelogin':
                    record['operate'] = 'ForceLogin';
                    if (this.forceLoginUid.trim()) record['uid'] = this.forceLoginUid.trim();
                    break;
            }
            return record;
        });
    }
}
