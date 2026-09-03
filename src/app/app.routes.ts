import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'console' },
  {
    path: 'console',
    loadComponent: () => import('./pages/console/console.page').then(m => m.ConsolePage),
    title: '控制台 - BH2 GM',
  },
  {
    path: 'give',
    loadComponent: () => import('./pages/give/give.page').then(m => m.GivePage),
    title: '单件发放 - BH2 GM',
  },
  {
    path: 'giveall',
    loadComponent: () => import('./pages/giveall/giveall.page').then(m => m.GiveAllPage),
    title: '批量补齐 - BH2 GM',
  },
  {
    path: 'role',
    loadComponent: () => import('./pages/role/role.page').then(m => m.RolePage),
    title: '角色养成 - BH2 GM',
  },
  {
    path: 'player',
    loadComponent: () => import('./pages/player/player.page').then(m => m.PlayerPage),
    title: '玩家设置 - BH2 GM',
  },
  {
    path: 'story',
    loadComponent: () => import('./pages/story/story.page').then(m => m.StoryPage),
    title: '剧情推进 - BH2 GM',
  },
  {
    path: 'help',
    loadComponent: () => import('./pages/help/help.page').then(m => m.HelpPage),
    title: '命令手册 - BH2 GM',
  },
  { path: '**', redirectTo: 'console' },
];
