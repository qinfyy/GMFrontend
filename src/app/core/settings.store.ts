/**
 * 全局设置存储。
 * 持久化到 localStorage：服务器地址、ApiKey、最近使用的 UID 列表。
 * 服务器地址为空时走 dev 代理（/api/gm），非空时直连（跨域场景需服务器允许 CORS）。
 */
import { Injectable, signal, computed } from '@angular/core';

const STORAGE_KEY = 'bh2-gm-settings';

export interface GmSettings {
  /** 服务器基地址，如 http://127.0.0.1:21000；空串表示使用 dev 代理 */
  baseUrl: string;
  /** GameMaster:ApiKey；空串表示服务器未启用鉴权 */
  apiKey: string;
  /** 最近使用的玩家 UID，最新的在最前 */
  recentUids: string[];
}

const DEFAULTS: GmSettings = {
  baseUrl: '',
  apiKey: '',
  recentUids: [],
};

@Injectable({ providedIn: 'root' })
export class SettingsStore {
  private readonly _settings = signal<GmSettings>(load());

  readonly settings = this._settings.asReadonly();
  readonly baseUrl = computed(() => this._settings().baseUrl);
  readonly apiKey = computed(() => this._settings().apiKey);
  readonly recentUids = computed(() => this._settings().recentUids);

  update(partial: Partial<GmSettings>): void {
    const next = { ...this._settings(), ...partial };
    this._settings.set(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // localStorage 不可用（隐私模式等）时仅保留内存态
    }
  }

  /** 记录一次成功使用的 UID，去重后最多保留 10 条 */
  rememberUid(uid: string): void {
    const trimmed = uid.trim();
    if (!trimmed) return;
    const next = [trimmed, ...this._settings().recentUids.filter(v => v !== trimmed)].slice(0, 10);
    this.update({ recentUids: next });
  }
}

function load(): GmSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    // 解析失败按默认值处理
  }
  return DEFAULTS;
}
