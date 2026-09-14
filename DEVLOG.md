# DEVLOG

## 2026-09-14 20:40

- **动作**：同步上游 GM 新增的 `kick` / `ban` 命令，并跟进 Handbook GM 模板全面改为命令行写法。
- **变更**：
  - 新增 `src/app/pages/moderation/moderation.page.ts`：踢下线（`/kick` 5 种模式 + 自定义正文）+ 封禁/解封（`/ban`，结束时间用 datetime-local 选后转 `yyyyMMddHHmm`）
  - 路由新增 `/moderation`，侧导航加「玩家管理」
  - `core/handbook.service.ts`：**删除旧查询串兼容层**（`parseGmTemplate` 的 `&` 分支、`POSITIONAL_KEYS`、`MODIFIER_PREFIX`、`normalizeGmTemplate`），GM 模板只按命令行解析
  - 修掉一个真实 bug：传承篇/新生篇的单空格行里 `GM=` 值含空格，被无脑切列后既截断了 GM、又把尾部 token 追加进 `name`（形如「第一章 L1-1 8351 [@uid]」）。新增 `parseAttrs` 用 `/(?:^|\s)GM=(.*)$/` 整段取出
  - help 页不再依赖 `normalizeGmTemplate`，直接复制模板原文；console 命令速查补 `kick`/`ban`；story 页 kul 提示改为 Type∈{1,2,3,4}
  - 同步 `public/Handbook.txt`（8696 行）；更新 CLAUDE.md / STATE.md / FEATURES.md
- **上游变化**：命令集 12 → 14 条（`OtherCommands.Kick` / `OtherCommands.Ban`，均 `RequireTarget`，kick 另加 `RequireTargetOnline`）；`CommandContext` 拆出 `Args` 与 `PositionalArgs`（提交 `9a511f0`）；Handbook 生成器把 GM 列全改成聊天命令写法（提交 `0d37a8d`）。
- **验证**：`yarn build` 通过；对运行中的服务器实测 `/help` 解析出 14 条命令；`/kick` 三种写法均返回 400「目标玩家 … 不存在或不在线」，`/ban t… r外挂` 返回 404 player_not_found（证明 t/r 被正确解析），`/ban r外挂 测试` 返回 400「未识别的参数: 测试」；Handbook 离线解析 8450 条、1421 条 GM 全部以 `/` 开头、传承篇/新生篇 name 无污染、崩坏学园篇 18 章 490 关联动 0 孤儿。
- **动机**：用户提示上游更新了 GM 新功能且 Handbook 已把旧查询参数模板完全改掉，要求按新格式适配、不再兼容旧版。

## 2026-09-13 19:55

- **动作**：跟进上游 `/help` 格式调整 + 命令栏交互调整。
- **变更**：
  - `command-bar` 预览框去掉 `GET` 前缀，右侧按钮由「复制 URL」改为「复制命令」（直接复制命令行本身，便于粘进控制台或游戏内聊天框）；移除随之失效的 `GmApiService.urlFor`
  - 重新同步 `public/Handbook.txt`（上游 19:48 重新生成，8679 行）
  - 更新 CLAUDE.md 的 help 解析说明
- **上游变化**：`OtherCommands.ExecuteHelp` 去掉用法与 notes 的缩进（`      /usage` → `/usage`、`  注:` → `注:`）；`GameMasterService` 把 `GmCommandResJson.Success` 改名为 `Ok`（命令注册表仍 12 条）。
- **验证**：`yarn build` 通过；对运行中的服务器实测 `/help` 解析出 12 条命令、别名与用法条数全对，`/help ktc` 得 2 用法 + 5 notes，失败外壳 `{success:false,errorDescription,messages:[]}` 正确。解析器统一用 `^\s*`，缩进有无都不受影响。

## 2026-09-13 19:10

- **动作**：适配上游 BH2 私服 GM 协议大重构（查询参数 → LunarCore 风格命令行）。
- **变更**：
  - 新增 `src/app/core/command-line.ts`：`cmdLine/arg/mod/xAmount/flag` 命令行构造助手
  - 重写 `core/gm-api.service.ts`：`execute(content)` 走 `?content=` 查询参数；响应归一化为 `messages[]`；`/help` 改为文本解析（`parseHelpText`，先按换行摊平再逐行识别）；三种响应外壳容错
  - `shared/`：page-executor 改为 `run(() => string)` 并抽取 `@uid` 记忆；command-bar 预览命令行 + 复制请求 URL；result-panel 逐条渲染 messages
  - 8 个页面全部改为构造命令行：位置参数 + `x数量/lv/r/s/p/i/t/pt/bl/ml` 前缀修饰符 + `-flag` + `@uid`
  - console 页改为自由命令行输入 + 服务端 `/help` 命令速查（点击填入）
  - role 页新增 `-max` 一键拉满；story 页 `trigger` 语义改为 `-notrigger`；give/giveall 的 partner/skin 去掉数量（服务端只接受单份）
  - `core/handbook.service.ts`：新增 `parseGmTemplate` / `normalizeGmTemplate`，兼容上游新旧混用的 GM 模板
  - 同步 `public/Handbook.txt`（8679 行）；更新 CLAUDE.md / STATE.md / FEATURES.md
- **验证**：`yarn build` 通过（需系统 Node 24，受管 Node 22.22.2 被 Angular CLI 拒绝）；对真实服务器实测成功外壳与 4 条错误路径，`/help` 解析出 12 条命令且 label/别名/用法/notes 全对。
- **动机**：上游提交 `60016bc refactor(gm): 重构 GM 系统为 LunarCore 风格命令行与前缀修饰符传参`，旧的结构化参数接口全部下线。

## 2026-09-03 16:00

- **动作**：同步上游 BH2 私服 GM 模块 2026-09 大改（11 条命令，剧情/九霄/账号三分）。
- **变更**：
  - 同步 `public/handbook/Handbook.txt`（87080 行，原 86665 行）
  - 命令清单：移除 `kyusyoclear / kyusystory / dlcstory / dlcunlock`；新增 `kyusyoTaskCompleted(ktc) / kyusyoLevel(kl) / kyusyoUnlockLevel(kul) / kyusyoAchievement(ka) / account`
  - StoryPage 完全重写：5 个 tab（storyrange/ktc/kl/kul/ka），ktc id=all 走二次确认
  - 新增 AccountPage：4 个 tab（create/settings/delete/forcelogin），delete 二次确认
  - 路由新增 `/account`；侧导航加「账号管理」
  - help 页 KNOWN_SECTIONS 同步：分区改名 + 新增 4 个分区
- **验证**：`yarn build` 通过；9 条路由全部 200；`cmd=help` 列出 11 条；ktc/kl/kul/ka/storyrange 错误路径均返回 404 player_not_found；account 缺 operate 返回 400 含中文提示。
- **动机**：上游 `Sv/GameMaster/GameMasterService.cs` 命令注册表 2026-09-01 改动大，旧命令全部下线。

## 2026-08-27 14:20

- **动作**：卸载 anthropic-style-cn-main 依赖，CSS 切换为 LunarCoreToolsWeb 风格。
- **变更**：
  - 删除 `src/assets/base.css`、`src/assets/fonts/` 整目录
  - 重写 `src/styles.css` 为中性 CSS Token 体系（Arco 蓝 #165DFF、白底、系统字体栈）
  - app 骨架改为白底 Header 57px + 蓝激活色侧导航
  - 全部 7 个功能页表单改为「右对齐 label + 弹性 input」的 commuse 模式（label 120-160px 右对齐 + padding-right 10px）
  - shared 组件（command-bar / result-panel / entry-picker）颜色与字号同步调整
- **验证**：`yarn build` 通过，无 TS 错误。
- **动机**：用户要求按 LunarCoreToolsWeb 的视觉规范设计页面（白底 + 蓝主色 + 14px 字体），不再沿用 anthropic 风格的米色 + 橙色。

## 2026-08-25 23:45

- **动作**：在 `D:\Il2Cpp\GMFrontend` 创建 Angular 22 纯前端 GM 管理项目。
- **验证**：`yarn build` 通过；dev server 全部 7 条路由 200；对真实服务器执行 `cmd=help` / `give` / `setlevel` / `role` 均成功。
