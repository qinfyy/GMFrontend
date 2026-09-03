# START.md

- **激活模式**：Strict Engineering Mode
- **当前目标**：GM 管理前端（Angular + yarn + anthropic-style-cn-main）—— **已完成**
- **工作流版本**：WF-001（计划文件：`C:\Users\c\.claude\plans\gm-d-il2cpp-bh2-sv-gamemaster-d-il2cpp-abstract-stream.md`）
- **状态机位置**：PERSIST（文档已更新，任务闭环）

## 项目速览

- Angular 22 standalone / yarn / 无组件库；对接 `D:\Il2Cpp\bh2\Sv` 的 `GET /api/gm`
- dev：`yarn start`（http://localhost:4200，/api/gm 代理到 localhost:21000）
- build：`yarn build` → `dist/gmfrontend/browser`（纯静态）
- 详细架构与决策见 `STATE.md`；功能清单见 `FEATURES.md`；变更记录见 `DEVLOG.md`

## 已验证事实

- 全部 7 条路由 200；help/give/setlevel/role 对真实服务器执行成功；404/400 错误路径正确
