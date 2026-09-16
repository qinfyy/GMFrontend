# STATE.md

## 当前状态

GMFrontend 已同步上游 BH2 私服 2026-09-17 的 GM 更新：**命令集 14 → 15 条**（新增 `windy` 脚本热更），**物品类别新增 `emblem`（萌章）与 `petchip`（使魔碎片）**，新增「脚本热更」页；Handbook 分区 17 → 19 个，且把 help 页的分区白名单改成动态枚举（上游按装备 TypeId 生成分区，以后加类型不会再漏）。`yarn build` 通过，并对运行中的真实服务器做了端到端验证。

## 架构

- **技术栈**：Angular 22 standalone（无 NgModules、无组件库）、yarn 1.22、TypeScript 6。构建需 Node ≥ 22.22.3。
- **数据流**：页面 `preview()` 拼命令行 → `pageExecutor().run()` → `GmApiService.execute(content)`（GET + Bearer）→ ResultPanel 渲染 messages。
- **目录**：`src/app/core`（command-line/api/settings/handbook/theme）、`src/app/shared`（command-bar / result-panel / entry-picker / page-executor）、`src/app/pages`（10 页懒加载）。
- **样式**：`src/styles.css`（CSS Token 全集 + Reset），系统字体栈，无外部字体依赖。

## 关键决策与证据

1. **命令行而非查询串**：上游提交 `60016bc refactor(gm): 重构 GM 系统为 LunarCore 风格命令行与前缀修饰符传参`。前端新增 `core/command-line.ts` 统一拼装，页面只声明参数。
2. **单入口拼装**：每页只有一个 `preview(): string`，`send()` 复用它，杜绝「预览与实际执行不一致」。
3. **响应外壳只认当前版**：`{success, errorDescription, messages}` —— 成功时 `errorDescription` 为 null，失败时为中文文案或短码并配 HTTP 400/401/404/500。上游重构期间出现过的 `result` 包裹 / `retcode` / `error` 等写法已按要求移除兼容分支。
4. **help 文本解析**：`/help` 不返回结构化数组，改为解析人类可读文本；列表模式曾把多行打包进一条 message，解析前先按换行摊平。实测 15 条命令、别名、用法、notes 全部正确。
5. **Handbook 模板只按命令行解析**：上游 2026-09-14（提交 `0d37a8d docs(gm): Handbook 的 GM 列改用聊天命令写法`）把所有遗留查询串改成了 `/cmd …`，因此 `parseGmTemplate` 的 `&` 分支、`POSITIONAL_KEYS`、`MODIFIER_PREFIX`、`normalizeGmTemplate` 全部删除。
6. **`Args` / `PositionalArgs` 双份参数表**（上游提交 `9a511f0`）：`Args` 保留数值型修饰符，`PositionalArgs` 不保留。`/ban` 的 `t`/`r` 靠 `Args` 存活；同时意味着 kick 正文与 ban 理由里不能出现修饰符形态的片段，前端加了发送前校验。
7. **分区名改为动态枚举**（2026-09-17）：上游的装备分区由 `EquipmentTableBase` 按 TypeId 分组生成（1=weapon、2=costume、3=badge、5=role、6=emblem、9=petchip），硬编码白名单必然过期——这次就漏了 `emblem` / `petchip`。改为 `HandbookService.sectionNames()` 枚举「有数据行的分区」；实测纯说明区（`命令` / `类型说明` / `剧情关卡目录`）没有任何 tab 数据行，天然被排除，不会混进侧栏。
8. 2026-09-03 同步上游命令集：移除旧 4 条剧情/九霄命令；新增 ktc/kl/kul/ka + account。
9. 2026-08-27 切换设计：卸载 anthropic-style-cn-main，改为 LunarCoreToolsWeb 风格。

## 验证记录（2026-09-17）

对**运行中**的真实服务器（`localhost:21000`，`Sv.dll` 01:17 构建）实测：

- `/help` → `{success:true, errorDescription:null, messages:[43 条]}`，解析出 **15 条命令**，与 `GameMasterCommandRegistry.Commands` 逐条一致（含新增 `windy`）
- `/help windy` → 1 条命令、1 条用法、1 条 notes（「查找顺序：ServerData/windseed → ServerData → 服务器运行目录 → 绝对路径。」）
- 非破坏性命令验证（全部打在不存在的 UID `999999999` 上）：
  - `/windy login.lua @999999999` → 400「目标玩家 999999999 不存在或不在线」（`RequireTargetOnline` 生效）；`/windy`（无 uid）→ 400「必须指定目标玩家」
  - `/give emblem 5001 x2 @999999999`、`/give petchip 8001 x5 @999999999`、`/give emblem 5001 x2 lv80 r5 @999999999` → 404 `player_not_found`（新类型与装备参数被正确解析）
  - `/giveall emblem @999999999`、`/giveall petchip @999999999`、`/giveall all @999999999` → 404 `player_not_found`
  - `/give nosuchtype 1 @999999999` → 400「无法识别物品 ID: nosuchtype，请显式指定类型」（类型校验生效）
  - 回归：`/give badge 2001 x2`、`/give currency hcoin x100`、`/setlevel lv80` → 404 `player_not_found`
- **Handbook 离线解析校验**（esbuild 打包 `handbook.service.ts` + stub `@angular/core` 后跑 node）：
  - `sectionNames()` 返回 **19 个分区**，纯说明区 3 个全部排除
  - 19 个分区合计 9082 条；带 `GM=` 的 1421 条**全部以 `/` 开头、无 tab 污染**；`name` 污染 0 条
  - 新分区：emblem 511 条、petchip 121 条；`giveall all` 覆盖的 6 类装备合计 5318 条
  - 传承篇 86 / 新生篇 251 的 `name` 干净；崩坏学园篇 18 章 490 关联动 0 孤儿
- `yarn build` 通过；10 条路由全部 200

## 历史验证记录（2026-09-14）

- `/help` → 14 条命令（含 `kick` / `ban`）；`/kick` 三种写法均 400「目标玩家 … 不存在或不在线」；`/ban t202609152026 r外挂` → 404（证明 `t`/`r` 解析正确）；`/ban r外挂 测试` → 400「未识别的参数: 测试」
- Handbook 17 分区 8450 条；传承篇/新生篇的 name 污染 bug 已修（`GM=` 值含空格被切碎）

## 风险

- **上游协议仍在变动**：09-13 一天内改过 4 次，09-14 加 2 条命令并重写 Handbook 模板，09-17 又加 `windy` + 2 个物品类别 + 2 个分区。客户端只认当前版外壳，上游再改字段需同步 `GmResponse` 与 `toGmError`。
- **Handbook.txt 可能被删掉重建**：它是 `Sv.exe` 启动时由 `GameMasterHandbookGenerator.Generate(contentRootPath)` 写到 `Sv/Handbook.txt` 的（09-17 就出现过文件消失，启动一次服务端即恢复）。前端 `public/Handbook.txt` 是手工同步的副本，上游重建后需要重新 `cp`。
- 生产跨域部署依赖服务器侧配置（服务器已带 `Access-Control-Allow-Origin: *`，直连可行）。
- 大分区列表为截断渲染（200 条/页），未做虚拟滚动（help 页除外）。

## 下一步（可选）

- 服务器 Handbook 更新后重新复制到 `public/Handbook.txt`。
- `yarn build` 产物在 `dist/gmfrontend/browser`，纯静态可托管。
