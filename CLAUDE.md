# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目定位

**BH2 GM 控制台**——Angular 22 纯前端管理界面，对接 `D:\Il2Cpp\bh2\Sv` 私服的 `GET /api/gm` HTTP 端点，让服务器管理员用图形界面执行 GM 命令。

纯前端项目，不修改服务器代码，无组件库依赖（除 Angular 自身）。

## 常用命令

| 命令 | 用途 |
|------|------|
| `yarn start` | dev server（http://localhost:4200），`/api/gm` 经 proxy.conf.json 代理到 `http://localhost:21000` |
| `yarn build` | 生产构建到 `dist/gmfrontend/browser`（纯静态） |

**Node 版本**：Angular CLI 22 要求 Node ≥ 22.22.3 / ≥ 24.15.0。本机受管 Node 22.22.2 会被拒绝，构建前先 `export PATH="/c/Program Files/nodejs:$PATH"`（系统 Node 24）。

无单元测试（`ng test` 存在但项目未写测试）；验证方式是 build + dev server 路由探测 + curl 打真实服务器。

## 架构

```
src/app/
├── app.ts / app.routes.ts    # 骨架（Header 主题切换 + 设置抽屉 + 侧导航）；8 页懒加载路由
├── core/
│   ├── command-line.ts       # 命令行构造助手：cmdLine/arg/mod/xAmount/flag
│   ├── gm-api.service.ts     # GET /api/gm 封装：content 传参、Bearer 鉴权、help 文本解析
│   ├── settings.store.ts     # localStorage：baseUrl / apiKey / recentUids
│   ├── handbook.service.ts   # 解析 public/Handbook.txt + GM 模板归一化
│   └── theme.service.ts      # 明亮/黑暗/跟随系统，写 <html data-theme>
├── shared/
│   ├── command-bar.ts        # 命令行实时预览（黑框横滑）+ 一键复制命令 + 危险操作二次确认
│   ├── result-panel.ts       # 成功逐条渲染 messages / 失败错误面板
│   ├── entry-picker.ts       # Handbook 条目搜索选择器
│   │                         #   输入：section / typeFilter / filterOf / extraOf / toggleable
│   │                         #   选中值是 entry.id 字符串，model() 双向绑定
│   └── page-executor.ts      # 各页共用的执行状态机（run/build 命令行 + @uid 记忆）
└── pages/                    # console / give / giveall / role / player / story / account / help
```

数据流：页面表单 → `preview()` 拼命令行 → `pageExecutor().run(() => preview())` → `GmApiService.execute(content)` → ResultPanel 展示 messages。

**约定**：每个页面只写一个 `preview(): string`，`send()` 直接 `exec.run(() => this.preview())`，保证「预览的就是执行的」，避免两份拼装逻辑漂移。表单用普通方法而非 `computed`（Angular 默认变更检测会在事件后重算模板表达式），只有真的依赖 signal 时才用 `computed`。

**命名约定**：`player` 页 = `setlevel`（改等级），`moderation` 页 = `kick` + `ban`（踢人与封禁），两者不要混。

## 上游协议（GM API）

- 唯一端点 `GET /api/gm?content=<整条 GM 命令行>`，命令行形如 `/give weapon 1001 x2 lv80 r5 @10001`
- **位置参数 + 通用修饰符 + `-flag` + `@uid` 全部空格分隔**，前缀斜杠可省略；服务端 `CommandContext` 负责分词
- 鉴权：ApiKey 非空时 `Authorization: Bearer <key>` 头（也支持 `access_token` 查询参数）
- 命令集 14 条（2026-09-14 同步）：`give / giveall / role / setlevel / kick / ban / storycompleted(sc) / newstorycompleted(nsc) / kyusyoTaskCompleted(ktc) / kyusyoLevel(kl) / kyusyoUnlockLevel(kul) / kyusyoAchievement(ka) / account / help`
- 权威定义在 `D:\Il2Cpp\bh2\Sv\GameMaster\*.cs` 的 `GameMasterCommandRegistry.Commands`，或直接 `curl "http://localhost:21000/api/gm?content=%2Fhelp"`

### 修饰符一览（服务端 CommandContext.TryParseModifier）

`x<数量>`（或 `*数量`）、`lv<等级>`、`r<星级>`、`s<技能>`（= `sk`）、`p<升格>`、`i<亲密度>`、`t<圣痕>`、`pt<限解度>`、`bl<基础等级>`、`ml<精通等级>`、`-flag`、`@uid`。

### 响应外壳（当前版本）

```
成功：{ "success": true,  "errorDescription": null,        "messages": ["…"] }
失败：{ "success": false, "errorDescription": "文案或短码", "messages": [] }   HTTP 400/401/404/500
```

客户端**只认这一版**，不做多版本兼容。失败时 `errorDescription` 是短码就查 `ERROR_CODES` 表翻译成中文，是中文原文就直接作为提示展示（已知短码才单独作为 `code` 显示在徽标旁）。

- 失败时 HTTP 状态 400/401/404/500；短码有 `player_not_found` / `numeric_overflow` / `internal_error` / `invalid_token` / `unauthorized` / `invalid_request`
- **注意**：`help` 返回的是人类可读文本（不是结构化数组），由 `parseHelpText` 解析。格式随上游改过：19:46 起用法与 notes 不再缩进（`      /usage` → `/usage`、`  注:` → `注:`），且不再把多行打包进单条 message。解析器统一用 `^\s*` 且先按换行摊平，新旧两种格式都能吃

## Handbook.txt 格式（parser 支持两种数据行）

文件在 `public/Handbook.txt`（8696 行，17 个分区），fetch 路径就是 `Handbook.txt`（无子目录）。

1. **括号分区头**：`[currency]`；裸标题 + 下划线行（`崩坏学园篇章节目录` + `------`）也识别为分区头
2. **tab 分隔行**（传统分区）：`currency <TAB> hcoin <TAB> 水晶 <TAB> alias=239 <TAB> GM=...`
   → 第 1 列 type、第 2 列 id、第 3 列起 name/attrs（`GM=` 总是最后一列）
3. **单空格分隔行**（传承篇/新生篇）：`第一章 L1-1 8351 type=1 GM=/storycompleted 8351 [@uid]`
   → 正则 `^(第\S+)\s+(\S+)\s+(\d+)\s+(.*)$`：id=第 3 组、name=`第X章 关卡名`、type='level'

解析后 `HandbookEntry = { section, type, id, name, attrs }`。

**GM 模板**：2026-09-14 起上游已把全部模板改成命令行写法（`/cmd <位置参数> [x数量] [lv..] [-flag] [@uid]`），旧的 `cmd&uid=..&k=v` 查询串已彻底移除，因此 `handbook.service` 只按命令行解析（`parseGmTemplate`），**不再保留旧格式兼容层**。

**空格分隔行的 `GM=` 必须整段切出来**：`GM=` 的值本身含空格且总是行尾字段，若按空格无脑切列，值会被切碎并污染 `name`（曾导致「第一章 L1-1 8351 [@uid]」这种脏 name）。`parseAttrs` 先用 `/(?:^|\s)GM=(.*)$/` 单独取出。

## 关键陷阱（已踩过，勿重复）

- **响应外壳只认当前版**：`{success, errorDescription, messages}`。上游重构期间试过 `result` 包裹、`retcode`、`error` 等写法，已按要求全部移除兼容分支——上游若再改字段，直接改 `GmResponse` 接口与 `toGmError`
- **help 格式改过两次**：列表模式曾把「命令行 + 多条用法」打包进一条 message（内部 `\r\n`），后来又去掉了缩进。解析前先按换行摊平、所有正则带 `^\s*`，两版都能吃——改格式时先看 `OtherCommands.ExecuteHelp`
- **ngModel 不能绑 signal**：`[(ngModel)]="query"` 会把 signal 覆写成字符串，静默失效。用 `[value]="query()" (input)="query.set($event)"` 或 `[ngModel]="query()" (ngModelChange)="..."`
- **无依赖的 `computed` 永不更新**：`computed(() => this.plainField > 0)` 没有 signal 依赖，只算一次就缓存。表单派生值用普通方法
- **不要手动缓存 `handbook.section()`**：加载是异步的，提前缓存会留下空 Map（已踩过导致搜索全空）。一律用 `computed` 派生
- **KNOWN_SECTIONS 必须与 Handbook.txt 分区名逐字匹配**（含全角括号）；上游改分区名就要同步
- **help 页表格是虚拟滚动**：固定行高 34px + spacer 占位 + translateY 定位，只渲染可见窗口 ± 10 overscan。改动行高要同步改 `ROW_H` 与 CSS 里的 `height: 34px`
- **`account create` 按位置解析**：命令行模式无法表达「只给手机号创建」，用户名必须占位（上游限制）
- **端口 4200 被占**：`netstat -ano | grep :4200` 查 PID，`cmd //c "taskkill /F /PID <pid>"` 杀（Bash 下直接 taskkill /F 会被路径转义坑）

## 同步上游的工作流

当 `D:\Il2Cpp\bh2\Sv\GameMaster\*.cs` 或 Handbook 变动：
1. `cp /d/Il2Cpp/bh2/Sv/Handbook.txt public/Handbook.txt`
2. 核对 `GameMasterCommandRegistry.Commands` → 更新对应页面、`console.page.ts` 的静态命令清单、`help.page.ts` 的 KNOWN_SECTIONS
3. `yarn build` 验证 + curl 测错误路径（如 `content=/kyusyoTaskCompleted` 缺参应返回 400 中文提示）

### 起真实服务器做端到端验证

```bash
cd /d/Il2Cpp/bh2/Sv && ./bin/Debug/net10.0/Sv.exe > /tmp/sv.log 2>&1 &
# 就绪判断必须用日志标记或 curl -f：本机有 http_proxy，服务端没起来时代理会回 200 的错误页
until grep -q "Application started" /tmp/sv.log; do sleep 2; done
curl -sf --get --data-urlencode "content=/help" "http://localhost:21000/api/gm"
kill %1
```

启动约 25 秒（要加载 88 张资源表并重新生成 Handbook.txt）。

## 约定

- UI：白底 + Arco 蓝 #165DFF + 14px 系统字体栈；表单用 commuse 模式（右对齐 label 120–160px + 弹性 input），样式见 `src/styles.css` 的 CSS Token
- 危险操作（giveall all/material/currency、ktc all、nsc 整章、account delete）用 `--color-error` + command-bar 二次确认
- 代码 4 空格缩进（.prettierrc 已锁）
- 全部中文交互与文档
