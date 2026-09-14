# STATE.md

## 当前状态

GMFrontend 已同步上游 BH2 私服 2026-09-14 的 GM 更新：**命令集 12 → 14 条**（新增 `kick`、`ban`），新增「玩家管理」页；Handbook 的 GM 模板已全部改为命令行写法，旧的 `cmd&uid=..&k=v` 查询串被上游彻底移除，前端的兼容层同步删除。`yarn build` 通过，并对运行中的真实服务器做了端到端验证。

## 架构

- **技术栈**：Angular 22 standalone（无 NgModules、无组件库）、yarn 1.22、TypeScript 6。构建需 Node ≥ 22.22.3。
- **数据流**：页面 `preview()` 拼命令行 → `pageExecutor().run()` → `GmApiService.execute(content)`（GET + Bearer）→ ResultPanel 渲染 messages。
- **目录**：`src/app/core`（command-line/api/settings/handbook/theme）、`src/app/shared`（command-bar / result-panel / entry-picker / page-executor）、`src/app/pages`（9 页懒加载）。
- **样式**：`src/styles.css`（CSS Token 全集 + Reset），系统字体栈，无外部字体依赖。

## 关键决策与证据

1. **命令行而非查询串**：上游提交 `60016bc refactor(gm): 重构 GM 系统为 LunarCore 风格命令行与前缀修饰符传参`。前端新增 `core/command-line.ts` 统一拼装，页面只声明参数。
2. **单入口拼装**：每页只有一个 `preview(): string`，`send()` 复用它，杜绝「预览与实际执行不一致」。
3. **响应外壳只认当前版**：`{success, errorDescription, messages}` —— 成功时 `errorDescription` 为 null，失败时为中文文案或短码并配 HTTP 400/401/404/500。上游重构期间出现过的 `result` 包裹 / `retcode` / `error` 等写法已按要求移除兼容分支。
4. **help 文本解析**：`/help` 不返回结构化数组，改为解析人类可读文本；列表模式曾把多行打包进一条 message，解析前先按换行摊平。实测 14 条命令、别名、用法、notes 全部正确。
5. **Handbook 模板只按命令行解析**：上游 2026-09-14（提交 `0d37a8d docs(gm): Handbook 的 GM 列改用聊天命令写法`）把所有遗留查询串改成了 `/cmd …`，因此 `parseGmTemplate` 的 `&` 分支、`POSITIONAL_KEYS`、`MODIFIER_PREFIX`、`normalizeGmTemplate` 全部删除。
6. **`Args` / `PositionalArgs` 双份参数表**（上游提交 `9a511f0`）：`Args` 保留数值型修饰符，`PositionalArgs` 不保留。`/ban` 的 `t`/`r` 靠 `Args` 存活；同时意味着 kick 正文与 ban 理由里不能出现修饰符形态的片段，前端加了发送前校验。
7. 2026-09-03 同步上游命令集：移除旧 4 条剧情/九霄命令；新增 ktc/kl/kul/ka + account。
8. 2026-08-27 切换设计：卸载 anthropic-style-cn-main，改为 LunarCoreToolsWeb 风格。

## 验证记录（2026-09-14）

对**运行中**的真实服务器（`localhost:21000`，`Sv.dll` 20:22 构建）实测：

- `/help` → `{success:true, errorDescription:null, messages:[41 条]}`，解析出 **14 条命令**，与 `GameMasterCommandRegistry.Commands` 逐条一致（含新增 `kick` / `ban`）
- 非破坏性命令验证（全部打在不存在的 UID `999999999` 上）：
  - `/kick rc 测试消息 @999999999`、`/kick kr @999999999`、`/kick @999999999` → 400「目标玩家 999999999 不存在或不在线」（`RequireTargetOnline` 生效）
  - `/ban unban @999999999`、`/ban t202609152026 r外挂 @999999999`、`/ban t2026 @999999999` → 404 `player_not_found`（证明 `t`/`r` 被正确解析）
  - `/ban r外挂 测试 @999999999` → 400「未识别的参数: 测试。用法: /ban unban [@uid] 或 /ban [t结束时间] [r封禁理由] [@uid]」（证明理由不能含空格，前端已拦）
  - `/setlevel lv80 @999999999`、`/kl lv5 @999999999` → 404 `player_not_found`（修饰符写法可用）
- **Handbook 离线解析校验**（esbuild 打包 `handbook.service.ts` + stub `@angular/core` 后跑 node）：
  - 17 个分区合计 8450 条，带 `GM=` 的 1421 条**全部以 `/` 开头、无 tab 污染**
  - 传承篇 86 / 新生篇 251 条的 `name` 干净（修掉了 GM 含空格导致的 name 污染），`GM` 完整
  - 崩坏学园篇 18 章 / 490 关，关卡→章节联动过滤 0 孤儿
- `yarn build` 通过（仅剩 2 条既有的 CSS budget 警告）

## 风险

- **上游协议仍在变动**：2026-09-13 一天内改过 4 次（命令注册表 → 响应外壳两版 → `/help` 缩进），09-14 又加了 2 条命令并重写 Handbook 模板。客户端只认当前版外壳，上游再改字段需同步 `GmResponse` 与 `toGmError`。
- 生产跨域部署依赖服务器侧配置（服务器已带 `Access-Control-Allow-Origin: *`，直连可行）。
- 大分区列表为截断渲染（200 条/页），未做虚拟滚动（help 页除外）。

## 下一步（可选）

- 服务器 Handbook 更新后重新复制到 `public/Handbook.txt`。
- `yarn build` 产物在 `dist/gmfrontend/browser`，纯静态可托管。
