/**
 * 功能页通用执行逻辑。
 *
 * 每个功能页都是「参数表单 → 拼一条 GM 命令行 → 执行 → 结果面板」的同构流程，
 * 这里把状态机（sending / result / error）与 UID 记忆收敛到一处，
 * 页面只提供「如何把表单拼成命令行」。
 */
import { computed, inject, signal } from '@angular/core';
import { GmApiService, GmApiError, GmResult } from '../core/gm-api.service';
import { SettingsStore } from '../core/settings.store';

export function pageExecutor() {
    const api = inject(GmApiService);
    const settings = inject(SettingsStore);

    const sending = signal(false);
    const result = signal<GmResult | null>(null);
    const error = signal<GmApiError | null>(null);

    /** 全局 UID（来自最近一次成功执行的 @uid），页面表单可覆盖 */
    const globalUid = signal(settings.recentUids()[0] ?? '');
    settings.recentUids; // 保持响应式引用

    const busy = computed(() => sending());

    async function run(build: () => string): Promise<void> {
        sending.set(true);
        result.set(null);
        error.set(null);
        try {
            const command = build();
            const uid = extractUid(command);
            if (uid) {
                settings.rememberUid(uid);
                globalUid.set(uid);
            }
            result.set(await api.execute(command));
        } catch (e) {
            error.set(
                e instanceof GmApiError
                    ? e
                    : new GmApiError(0, 'unknown', e instanceof Error ? e.message : String(e)),
            );
        } finally {
            sending.set(false);
        }
    }

    return { run, sending, busy, result, error, globalUid };
}

/** 从命令行里取出 @uid 修饰符，用于「最近使用 UID」记忆 */
function extractUid(command: string): string {
    const matched = /(?:^|\s)@(\d+)(?:\s|$)/.exec(command);
    return matched ? matched[1] : '';
}
