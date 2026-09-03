/**
 * 功能页通用执行逻辑。
 *
 * 每个功能页都是「参数表单 → 生成查询串 → 执行 → 结果面板」的同构流程，
 * 这里把状态机（sending / result / error）与全局 UID 读取收敛到一处，
 * 页面只提供参数构造函数。
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

  /** 全局 UID（来自顶栏输入），页面表单可覆盖 */
  const globalUid = signal(settings.recentUids()[0] ?? '');
  settings.recentUids; // 保持响应式引用

  const busy = computed(() => sending());

  async function run(build: () => Record<string, string>): Promise<void> {
    sending.set(true);
    result.set(null);
    error.set(null);
    try {
      const params = build();
      const uid = params['uid']?.trim();
      if (uid) {
        settings.rememberUid(uid);
        globalUid.set(uid);
      }
      result.set(await api.execute(params));
    } catch (e) {
      error.set(
        e instanceof GmApiError
          ? e
          : new GmApiError(0, 'unknown', undefined, e instanceof Error ? e.message : String(e)),
      );
    } finally {
      sending.set(false);
    }
  }

  return { run, sending, busy, result, error, globalUid };
}
