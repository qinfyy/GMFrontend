/**
 * 主题服务。
 *
 * 三种模式：
 * - light   始终明亮
 * - dark    始终黑暗
 * - system  跟随操作系统的 prefers-color-scheme
 *
 * 用户选择持久化到 localStorage，默认为 system。
 * 解析后的实际主题（'light' | 'dark'）写入 <html data-theme>，
 * 配套在 src/styles.css 中以 [data-theme="dark"] 选择器定义暗色 Token。
 */
import { Injectable, computed, effect, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'bh2-gm-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly mq = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;

  /** 用户选择的主题模式；默认 system 跟随系统 */
  readonly mode = signal<ThemeMode>(this.load());

  /** 解析后实际生效的主题；system 模式下跟随系统变化 */
  readonly resolved = computed<ResolvedTheme>(() => {
    const m = this.mode();
    if (m === 'light') return 'light';
    if (m === 'dark') return 'dark';
    return this.mq?.matches ? 'dark' : 'light';
  });

  constructor() {
    // 把解析结果同步到 <html data-theme>；styles.css 按此选择暗色 Token
    effect(() => {
      const r = this.resolved();
      if (typeof document !== 'undefined') {
        document.documentElement.dataset['theme'] = r;
      }
    });

    // 持久化用户选择
    effect(() => {
      const m = this.mode();
      try {
        localStorage.setItem(STORAGE_KEY, m);
      } catch {
        // 隐私模式或 quota 满时静默失败
      }
    });

    // system 模式下系统主题变化时立即更新
    this.mq?.addEventListener('change', () => {
      if (this.mode() === 'system') {
        // 触发 resolved 重算（effect 会写回 documentElement）
        this.mode.set('system');
      }
    });
  }

  setMode(m: ThemeMode): void {
    this.mode.set(m);
  }

  /** 三个展示选项 */
  readonly options: { value: ThemeMode; label: string; hint: string }[] = [
    { value: 'light', label: '明亮', hint: '始终使用浅色界面' },
    { value: 'dark', label: '黑暗', hint: '始终使用深色界面' },
    { value: 'system', label: '跟随系统', hint: '与操作系统设置一致' },
  ];

  private load(): ThemeMode {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === 'light' || v === 'dark' || v === 'system') return v;
    } catch {
      // 读取失败按默认
    }
    return 'system';
  }
}
