# STATE.md

## 当前状态

GMFrontend 已适配上游 BH2 私服 2026-09-13 的 GM 协议大重构：接口从「结构化查询参数」改为 **LunarCore 风格命令行**（`GET /api/gm?content=<命令行>`），响应从 `before/after` 结构化对象改为逐条 `messages`。12 条命令、8 个功能页全部改造完成，`yarn build` 通过，并对真实服务器做了端到端验证。

## 架构

- **技术栈**：Angular 22 standalone（无 NgModules、无组件库）、yarn 1.22、TypeScript 6。构建需 Node ≥ 22.22.3。
- **数据流**：页面 `preview()` 拼命令行 → `pageExecutor().run()` → `GmApiService.execute(content)`（GET + Bearer）→ ResultPanel 渲染 messages。
- **目录**：`src/app/core`（command-line/api/settings/handbook/theme）、`src/app/shared`（command-bar / result-panel / entry-picker / page-executor）、`src/app/pages`（8 页懒加载）。
- **样式**：`src/styles.css`（CSS Token 全集 + Reset），系统字体栈，无外部字体依赖。

## 关键决策与证据

1. **命令行而非查询串**：上游提交 `60016bc refactor(gm): 重构 GM 系统为 LunarCore 风格命令行与前缀修饰符传参`。前端新增 `core/command-line.ts` 统一拼装，页面只声明参数。
2. **单入口拼装**：每页只有一个 `preview(): string`，`send()` 复用它，杜绝「预览与实际执行不一致」。
3. **响应外壳只认当前版**：`{success, errorDescription, messages}` —— 成功时 `errorDescription` 为 null，失败时为中文文案或短码并配 HTTP 400/401/404/500。上游重构期间出现过的 `result` 包裹 / `retcode` / `error` 等写法已按要求移除兼容分支。
4. **help 文本解析**：`/help` 不再返回结构化数组，改为解析人类可读文本；列表模式会把多行打包进一条 message，解析前先按换行摊平。实测 12 条命令、别名、用法、notes 全部正确。
5. **Handbook 模板归一化**：上游生成器新旧格式混用，`normalizeGmTemplate` 把 `give&uid=<UID>&type=..&id=..&amount=..` 这类旧模板转成 `/give currency hcoin x<数量> @<UID>`。
6. 2026-09-03 同步上游命令集：移除旧 4 条剧情/九霄命令；新增 ktc/kl/kul/ka + account。
7. 2026-08-27 切换设计：卸载 anthropic-style-cn-main，改为 LunarCoreToolsWeb 风格。

## 验证记录（2026-09-13）

对真实服务器（`Sv.exe`，19:47 构建）实测：
- 成功外壳 `{success:true, errorDescription:null, messages:[37 条]}`，顶层只有 `success / errorDescription / messages`
- `/help` 解析出 12 条命令，label/别名与上游注册表逐条一致
- `/help ktc` → 1 条命令、2 条用法、5 条 notes
- 失败外壳 `{success:false, errorDescription:"…", messages:[]}`：`/account` → 400「缺少参数: operate」；`/nosuchcmd` → 400「未知 GM 命令」；`/give hcoin x100 @999999999` → 404 `player_not_found`；`/setlevel abc @1` → 400「缺少等级参数」
- `/help` 的缩进于 19:46 被上游去掉，解析器统一用 `^\s*` + 先按换行摊平，新旧格式都兼容

## 风险

- **上游协议仍在变动**：同一天内改过 4 次（命令注册表 → 响应外壳两版 → `/help` 缩进）。客户端目前只认当前版外壳，上游再改字段就需要同步改 `GmResponse` 与 `toGmError`。
- 生产跨域部署依赖服务器侧配置（服务器已带 `Access-Control-Allow-Origin: *`，直连可行）。
- 大分区列表为截断渲染（200 条/页），未做虚拟滚动（help 页除外）。

## 下一步（可选）

- 服务器 Handbook 更新后重新复制到 `public/Handbook.txt`。
- `yarn build` 产物在 `dist/gmfrontend/browser`，纯静态可托管。
