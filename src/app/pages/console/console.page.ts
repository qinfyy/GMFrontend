/**
 * 控制台页：自由执行任意 GM 命令。
 * cmd 下拉（含服务端 help 返回的命令集）+ 动态键值参数表单 + 原始查询串预览。
 * 表单采用 LunarCoreToolsWeb 的 commuse 模式：右对齐 label + 弹性 input。
 */
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GmApiService } from '../../core/gm-api.service';
import { CommandBarComponent } from '../../shared/command-bar';
import { ResultPanelComponent } from '../../shared/result-panel';
import { pageExecutor } from '../../shared/page-executor';

interface ParamRow {
    key: string;
    value: string;
}

@Component({
    imports: [FormsModule, CommandBarComponent, ResultPanelComponent],
    template: `
        <section class="page">
            <header class="page-head">
                <h2>控制台</h2>
                <p>直接组合任意 GM 命令。命令与参数说明见「命令手册」。</p>
            </header>

            <div class="commuse">
                <div class="commuse-item">
                    <div class="label">命令 cmd</div>
                    <div class="value">
                        <input type="text" [(ngModel)]="cmd" (ngModelChange)="bump()" placeholder="如 give / setlevel / dlcunlock" list="known-cmds" />
                        <datalist id="known-cmds">
                            @for (c of knownCommands(); track c) {
                                <option [value]="c"></option>
                            }
                        </datalist>
                    </div>
                </div>

                <div class="commuse-item">
                    <div class="label">uid（可选）</div>
                    <div class="value">
                        <input type="text" inputmode="numeric" [(ngModel)]="uid" (ngModelChange)="bump()" placeholder="留空则不传" />
                    </div>
                </div>

                <fieldset class="commuse-block">
                    <legend>其他参数</legend>
                    @for (row of params(); track $index) {
                        <div class="commuse-item">
                            <div class="label">参数 {{ $index + 1 }}</div>
                            <div class="value param-row">
                                <input type="text" [(ngModel)]="row.key" (ngModelChange)="bump()" placeholder="参数名，如 type" />
                                <input type="text" [(ngModel)]="row.value" (ngModelChange)="bump()" placeholder="值" />
                                <button type="button" class="btn ghost" (click)="removeParam($index)" aria-label="删除参数">✕</button>
                            </div>
                        </div>
                    }
                    <div class="generate">
                        <button type="button" class="btn add" (click)="addParam()">＋ 添加参数</button>
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
        .page-head { margin-bottom: var(--space-5); }
        .page-head h2 { margin: 0; font-size: var(--text-lg); font-weight: var(--weight-semibold); }
        .page-head p { margin: var(--space-1) 0 0; font-size: var(--text-sm); color: var(--color-text-2); }

        .commuse { display: flex; flex-direction: column; gap: 0; }
        .commuse-item { display: flex; align-items: center; margin: 18px 0; }
        .commuse-item .label {
            width: 120px; text-align: right; padding-right: 10px;
            color: var(--color-text-2); font-size: var(--text-sm); flex-shrink: 0;
        }
        .commuse-item .value { flex: 1; min-width: 0; }
        .param-row { display: flex; gap: var(--space-2); }
        .param-row > input { flex: 1; }
        .btn.ghost {
            width: 32px; height: 32px; padding: 0; flex-shrink: 0;
            background: transparent; color: var(--color-text-3);
            border: 1px solid var(--color-border-1); border-radius: var(--radius-md);
            transition: all var(--duration-fast) var(--ease-default);
        }
        .btn.ghost:hover { color: var(--color-error); border-color: var(--color-error); }

        .commuse-block { border: none; padding: 0; margin: 0; }
        .commuse-block legend { font-size: var(--text-sm); color: var(--color-text-2); padding: 0; margin-top: var(--space-2); }
        .generate { display: flex; justify-content: flex-start; padding-left: 130px; }
        .btn.add {
            background: transparent; color: var(--color-primary-6);
            border: 1px dashed var(--color-border-2); border-radius: var(--radius-md);
            padding: 6px 16px; font-size: var(--text-sm);
            transition: all var(--duration-fast) var(--ease-default);
        }
        .btn.add:hover { border-color: var(--color-primary-6); background: var(--color-primary-1); }
    `,
})
export class ConsolePage {
    private readonly api = inject(GmApiService);
    protected readonly exec = pageExecutor();

    /** 已知命令名：优先来自服务端缓存，失败时给静态清单 */
    protected readonly knownCommands = signal([
        'give', 'giveall', 'role', 'setlevel',
        'storyrange', 'ktc', 'kl', 'kul', 'ka', 'account', 'help',
    ]);

    protected cmd = '';
    protected uid = '';
    protected readonly params = signal<ParamRow[]>([{ key: '', value: '' }]);
    /** 输入触发：每个表单字段的 (ngModelChange) 调用，驱动 preview 实时重算 */
    private readonly revision = signal(0);
    protected bump(): void { this.revision.update(n => n + 1); }

    protected readonly preview = computed(() => {
        this.revision(); // 实时依赖
        const parts: string[] = [];
        if (this.cmd.trim()) parts.push(`cmd=${this.cmd.trim()}`);
        if (this.uid.trim()) parts.push(`uid=${this.uid.trim()}`);
        for (const row of this.params()) {
            if (row.key.trim() && row.value.trim()) parts.push(`${row.key.trim()}=${encodeURIComponent(row.value.trim())}`);
        }
        return parts.join('&');
    });

    constructor() {
        // 静默拉一次 help，把服务端真实命令集填进 datalist
        this.api.fetchHelp().then(help => {
            this.knownCommands.set(help.map(h => h.label));
        }).catch(() => undefined);
    }

    protected addParam(): void {
        this.params.update(rows => [...rows, { key: '', value: '' }]);
    }

    protected removeParam(index: number): void {
        this.params.update(rows => rows.filter((_, i) => i !== index));
    }

    protected send(): void {
        void this.exec.run(() => {
            const record: Record<string, string> = {};
            if (this.cmd.trim()) record['cmd'] = this.cmd.trim();
            if (this.uid.trim()) record['uid'] = this.uid.trim();
            for (const row of this.params()) {
                if (row.key.trim() && row.value.trim()) record[row.key.trim()] = row.value.trim();
            }
            return record;
        });
    }
}
