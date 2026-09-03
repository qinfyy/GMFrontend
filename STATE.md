# STATE.md

## 当前状态

GMFrontend 完成：Angular 22 纯前端 GM 管理界面，对接 `D:\Il2Cpp\bh2\Sv` 的 `/api/gm`，已对真实服务器端到端验证通过。CSS 已切换为 LunarCoreToolsWeb 风格（白底 + Arco 蓝 + 14px sans-serif + commuse 横排表单）。

## 架构

- **技术栈**：Angular 22 standalone（无 NgModules、无组件库）、yarn 1.22、TypeScript 6。
- **数据流**：页面表单 → `pageExecutor()` 状态机 → `GmApiService.execute()`（GET /api/gm + Bearer 头）→ ResultPanel 展示 before/after 与 syncDelivered。
- **目录**：`src/app/core`（api/settings/handbook 三服务）、`src/app/shared`（command-bar / result-panel / entry-picker / page-executor）、`src/app/pages`（7 页懒加载）。
- **样式**：`src/styles.css`（CSS Token 全集 + Reset），全部使用系统字体栈，无外部字体依赖。

## 关键决策与证据

1. 服务端 JSON 为 camelCase —— 以真实 `cmd=help` 响应核对后统一接口类型。
2. CORS 不改服务器：dev 用 proxy.conf.json → localhost:21000；生产直连需 CORS 或反代。
3. Handbook.txt 作为选择器数据源（8.6 万行），失败降级不阻塞。
4. 2026-08-27 切换设计：卸载 anthropic-style-cn-main，改为 LunarCoreToolsWeb 风格（白底 / 蓝主色 / commuse 横排表单）。

## 风险

- 生产跨域部署依赖服务器侧配置（未实现）。
- 大分区列表为截断渲染（200 条/页），未做虚拟滚动。

## 下一步（可选）

- 服务器 Handbook 更新后同步 `public/handbook/Handbook.txt`。
- 如需部署：`yarn build` 产物在 `dist/gmfrontend/browser`，纯静态可托管。
