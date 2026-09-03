/**
 * 应用骨架：白色 Header（标题 / 全局 UID / 设置）+ 左侧导航 + 内容区。
 * 视觉参考 LunarCoreToolsWeb：白底、蓝主色、14px 字体、Header 57px 高。
 */
import { Component, inject, model, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SettingsStore } from './core/settings.store';
import { HandbookService } from './core/handbook.service';

interface NavItem {
  path: string;
  label: string;
  hint: string;
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, FormsModule],
  template: `
    <header class="topbar">
      <div class="brand">
        <span class="logo" aria-hidden="true">GM</span>
        <h1>BH2 GM 控制台</h1>
      </div>

      <label class="uid-box">
        <span>玩家 UID</span>
        <input
          type="text"
          inputmode="numeric"
          list="uid-history"
          placeholder="如 1"
          [(ngModel)]="uid"
          (change)="rememberUid()"
        />
        <datalist id="uid-history">
          @for (u of settings.recentUids(); track u) {
            <option [value]="u"></option>
          }
        </datalist>
      </label>

      <button type="button" class="settings-btn" (click)="settingsOpen.set(true)">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
        服务器设置
      </button>
    </header>

    <div class="body">
      <nav class="sidenav" aria-label="功能导航">
        @for (item of navItems; track item.path) {
          <a
            [routerLink]="item.path"
            routerLinkActive="active"
            #rla="routerLinkActive"
            [class.active]="rla.isActive"
            [title]="item.hint"
          >
            {{ item.label }}
          </a>
        }
      </nav>
      <main class="content">
        <router-outlet />
      </main>
    </div>

    @if (settingsOpen()) {
      <div class="overlay" (click)="closeSettings($event)">
        <aside class="drawer" role="dialog" aria-modal="true" aria-label="服务器设置" (click)="$event.stopPropagation()">
          <h2>服务器设置</h2>
          <p class="desc">留空服务器地址时，开发模式下通过本地代理访问 localhost:21000。</p>

          <label>
            <span>服务器地址</span>
            <input type="text" placeholder="http://127.0.0.1:21000"
                   [ngModel]="settings.baseUrl()"
                   (ngModelChange)="settings.update({ baseUrl: $event })" />
          </label>

          <label>
            <span>ApiKey（GameMaster:ApiKey）</span>
            <input type="password" placeholder="未配置则留空"
                   [ngModel]="settings.apiKey()"
                   (ngModelChange)="settings.update({ apiKey: $event })" />
          </label>
          <p class="desc">ApiKey 非空时以 Authorization: Bearer 头发送。</p>

          <button type="button" class="btn primary" (click)="settingsOpen.set(false)">完成</button>
        </aside>
      </div>
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; min-height: 100vh; }

    .topbar {
      display: flex; align-items: center; gap: var(--space-6);
      height: 57px; padding: 0 var(--space-6);
      background: var(--color-bg-1);
      border-bottom: 1px solid var(--color-border-1);
      position: sticky; top: 0; z-index: var(--z-sticky);
    }
    .brand { display: flex; align-items: center; gap: var(--space-3); }
    .logo {
      display: grid; place-items: center;
      width: 32px; height: 32px;
      background: var(--color-primary-6); color: #fff;
      font-family: var(--font-heading); font-weight: var(--weight-bold); font-size: var(--text-sm);
      border-radius: var(--radius-md);
    }
    .brand h1 { margin: 0; font-size: var(--text-md); font-weight: var(--weight-semibold); }

    .uid-box { display: flex; align-items: center; gap: var(--space-2); }
    .uid-box span { font-size: var(--text-sm); color: var(--color-text-2); white-space: nowrap; }
    .uid-box input { width: 120px; }

    .settings-btn {
      margin-left: auto;
      display: inline-flex; align-items: center; gap: var(--space-2);
      color: var(--color-text-2);
      padding: 6px var(--space-3); border-radius: var(--radius-md);
      transition: color var(--duration-fast) var(--ease-default), background var(--duration-fast) var(--ease-default);
    }
    .settings-btn:hover { color: var(--color-primary-6); background: var(--color-primary-1); }

    .body { display: flex; flex: 1; min-height: 0; }
    .sidenav {
      display: flex; flex-direction: column; gap: 2px;
      width: 200px; flex-shrink: 0;
      padding: var(--space-4) var(--space-2);
      background: var(--color-bg-1);
      border-right: 1px solid var(--color-border-1);
      height: calc(100vh - 57px);
      position: sticky; top: 57px;
      overflow-y: auto;
    }
    .sidenav a {
      padding: 8px var(--space-4);
      border-radius: var(--radius-md);
      color: var(--color-text-2);
      font-size: var(--text-base);
      transition: background var(--duration-fast) var(--ease-default), color var(--duration-fast) var(--ease-default);
    }
    .sidenav a:hover { background: var(--color-primary-1); color: var(--color-primary-6); }
    .sidenav a.active { background: var(--color-primary-6); color: #fff; font-weight: var(--weight-medium); }

    .content {
      flex: 1; min-width: 0;
      padding: var(--space-6);
      background: var(--color-bg-1);
    }

    .overlay {
      position: fixed; inset: 0; z-index: var(--z-drawer);
      background: rgba(29, 33, 41, 0.5);
      display: flex; justify-content: flex-end;
      animation: fade var(--duration-normal) var(--ease-default);
    }
    @keyframes fade { from { opacity: 0; } to { opacity: 1; } }
    .drawer {
      width: min(420px, 90vw);
      background: var(--color-bg-1);
      padding: var(--space-6);
      display: flex; flex-direction: column; gap: var(--space-4);
      box-shadow: -4px 0 16px rgba(0,0,0,0.08);
    }
    .drawer h2 { margin: 0; font-size: var(--text-lg); font-weight: var(--weight-semibold); }
    .drawer label { display: flex; flex-direction: column; gap: var(--space-1); }
    .drawer label span { font-size: var(--text-sm); color: var(--color-text-2); }
    .desc { margin: 0; font-size: var(--text-xs); color: var(--color-text-3); }
    .btn.primary {
      align-self: flex-end;
      background: var(--color-primary-6); color: #fff;
      padding: 8px 20px; border-radius: var(--radius-md);
      font-weight: var(--weight-medium);
      transition: background var(--duration-fast) var(--ease-default);
    }
    .btn.primary:hover { background: var(--color-primary-7); }

    @media (max-width: 900px) {
      .sidenav { width: 140px; }
      .sidenav a { padding: 8px var(--space-2); font-size: var(--text-sm); }
    }
  `,
})
export class App {
  protected readonly settings = inject(SettingsStore);
  private readonly handbook = inject(HandbookService);

  /** 各功能页共享同一个 UID：由全局输入框统一管理 */
  readonly uid = model(this.settings.recentUids()[0] ?? '');
  protected readonly navItems: NavItem[] = [
    { path: '/console', label: '控制台', hint: '自由执行任意 GM 命令' },
    { path: '/give', label: '单件发放', hint: 'give：按 ID 发放货币/材料/装备/角色等' },
    { path: '/giveall', label: '批量补齐', hint: 'giveall：按类别批量补齐物品' },
    { path: '/role', label: '角色养成', hint: 'role：设置已拥有角色的养成属性' },
    { path: '/player', label: '玩家设置', hint: 'setlevel：设置玩家等级' },
    { path: '/story', label: '剧情推进', hint: '剧情 / 九霄 / 逐火之蛾 DLC 推进' },
    { path: '/help', label: '命令手册', hint: 'help 与 Handbook 分区浏览' },
  ];
  protected readonly settingsOpen = signal(false);

  constructor() {
    // 启动即加载 Handbook 目录；失败不阻塞界面
    this.handbook.load();
  }

  protected rememberUid(): void {
    const value = this.uid().trim();
    if (value) this.settings.rememberUid(value);
  }

  protected closeSettings(event: Event): void {
    if (event.target === event.currentTarget) this.settingsOpen.set(false);
  }
}
