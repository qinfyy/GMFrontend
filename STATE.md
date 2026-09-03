# STATE.md

## 当前状态

GMFrontend 与上游 BH2 私服 GM 模块 2026-09 对齐：11 条命令、5 个剧情/九霄子命令、独立的账号管理页、Handbook.txt 87080 行。已对真实服务器端到端验证。

## 架构

- **技术栈**：Angular 22 standalone（无 NgModules、无组件库）、yarn 1.22、TypeScript 6。
- **数据流**：页面表单 → `pageExecutor()` 状态机 → `GmApiService.execute()`（GET /api/gm + Bearer 头）→ ResultPanel 展示 before/after 与 syncDelivered。
- **目录**：`src/app/core`（api/settings/handbook）、`src/app/shared`（command-bar / result-panel / entry-picker / page-executor）、`src/app/pages`（8 页懒加载：console/give/giveall/role/player/story/account/help）。
- **样式**：`src/styles.css`（CSS Token 全集 + Reset），系统字体栈，无外部字体依赖。

## 关键决策与证据

1. 服务端 JSON 为 camelCase —— 以真实 `cmd=help` 响应核对后统一接口类型。
2. CORS 不改服务器：dev 用 proxy.conf.json → localhost:21000；生产直连需 CORS 或反代。
3. Handbook.txt 作为选择器数据源（8.7 万行），失败降级不阻塞。
4. 2026-09-03 同步上游命令集：移除旧 4 条剧情/九霄命令；新增 4 条 ktc/kl/kul/ka + account；StoryPage 全面重写，dlc 相关下线。
5. 2026-08-27 切换设计：卸载 anthropic-style-cn-main，改为 LunarCoreToolsWeb 风格。

## 风险

- 生产跨域部署依赖服务器侧配置（未实现）。
- 大分区列表为截断渲染（200 条/页），未做虚拟滚动。

## 下一步（可选）

- 服务器 Handbook 更新后重新复制到 `public/handbook/`。
- `yarn build` 产物在 `dist/gmfrontend/browser`，纯静态可托管。
