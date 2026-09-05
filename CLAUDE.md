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

无单元测试（`ng test` 存在但项目未写测试）；验证方式是 build + dev server 路由探测 + curl 打真实服务器。

## 架构

```
src/app/
├── app.ts / app.routes.ts    # 骨架（Header 主题切换 + 设置抽屉 + 侧导航）；8 页懒加载路由
├── core/
│   ├── gm-api.service.ts     # GET /api/gm 封装：Bearer 鉴权、错误归一化为 GmApiError（中文提示）
│   ├── settings.store.ts     # localStorage：baseUrl / apiKey / recentUids
│   ├── handbook.service.ts   # 解析 public/Handbook.txt（见下方格式说明）
│   └── theme.service.ts      # 明亮/黑暗/跟随系统，写 <html data-theme>
├── shared/
│   ├── command-bar.ts        # 实时 GET 预览（黑框横滑）+ 危险操作二次确认
│   ├── result-panel.ts       # 成功 Before/After 对比 / 失败错误面板
│   ├── entry-picker.ts       # Handbook 条目搜索选择器
│   │                         #   输入：section / typeFilter / filterOf / extraOf / toggleable
│   │                         #   选中值是 entry.id 字符串，model() 双向绑定
│   └── page-executor.ts      # 各页共用的执行状态机（run/sending/result/error）
└── pages/                    # console / give / giveall / role / player / story / account / help
```

数据流：页面表单 → `pageExecutor().run(params)` → `GmApiService.execute()` → ResultPanel 展示。

## 上游协议（GM API）

- 唯一端点 `GET /api/gm?cmd=<命令>&uid=<UID>&<参数>=<值>`，**全部参数走查询串**
- 响应是 **camelCase JSON**（`uid/command/before/after/amount/syncDelivered/help`）——不要写成 PascalCase
- 鉴权：ApiKey 非空时 `Authorization: Bearer <key>` 头
- 命令集 12 条（2026-09-05 同步）：`give / giveall / role / setlevel / storyrange / newstorycompleted(nsc) / ktc / kl / kul / ka / account / help`
- 权威定义在 `D:\Il2Cpp\bh2\Sv\GameMaster\*.cs` 的 `GameMasterCommandRegistry.Commands`，或直接 `curl "http://localhost:4200/api/gm?cmd=help"`

## Handbook.txt 格式（parser 支持三种行）

文件在 `public/Handbook.txt`（8675 行，17 个分区），fetch 路径就是 `Handbook.txt`（无子目录）。

1. **括号分区头**：`[currency]`；裸标题 + 下划线行（`崩坏学园篇章节目录` + `------`）也识别为分区头
2. **tab 分隔行**（传统分区）：`currency <TAB> hcoin <TAB> 水晶 <TAB> alias=239 <TAB> GM=...`
   → 第 1 列 type、第 2 列 id、第 3 列起 name/attrs
3. **单空格分隔行**（传承篇/新生篇）：`第一章 L1-1 8351 type=1 GM=...`
   → 首列以「第」开头时：id=tokens[2]、name=`第X章 关卡名`、type='level'

解析后 `HandbookEntry = { section, type, id, name, attrs }`；`attrs.GM` 是完整命令模板。

## 关键陷阱（已踩过，勿重复）

- **ngModel 不能绑 signal**：`[(ngModel)]="query"` 会把 signal 覆写成字符串，静默失效。用 `[value]="query()" (input)="query.set($event)"` 或 `[ngModel]="query()" (ngModelChange)="..."`
- **实时 preview 模式**：多数页用 `revision = signal(0)` + `bump()`，每个 input 加 `(ngModelChange)="bump()"`，entry-picker 加 `(valueChange)="bump()"`；`preview = computed()` 内读 `this.revision()` 建立依赖。role/player 页 preview 是普通方法则不需要
- **不要手动缓存 `handbook.section()`**：加载是异步的，提前缓存会留下空 Map（已踩过导致搜索全空）。一律用 `computed` 派生
- **KNOWN_SECTIONS 必须与 Handbook.txt 分区名逐字匹配**（含全角括号）；上游改分区名就要同步
- help 页表格是**虚拟滚动**：固定行高 34px + spacer 占位 + translateY 定位，只渲染可见窗口 ± 10 overscan。改动行高要同步改 `ROW_H` 与 CSS 里的 `height: 34px`
- 端口 4200 被占：`netstat -ano | grep :4200` 查 PID，`cmd //c "taskkill /F /PID <pid>"` 杀（Bash 下直接 taskkill /F 会被路径转义坑）

## 同步上游的工作流

当 `D:\Il2Cpp\bh2\Sv\GameMaster\*.cs` 或 Handbook 变动：
1. `cp /d/Il2Cpp/bh2/Sv/Handbook.txt public/Handbook.txt`
2. 核对 `GameMasterService.cs` 的命令注册表 → 更新 `pages/story` 或新页面、`console.page.ts` 的静态命令清单、`help.page.ts` 的 KNOWN_SECTIONS
3. `yarn build` 验证 + curl 测错误路径（如 `cmd=nsc` 缺参应返回 400 中文提示）

## 约定

- UI：白底 + Arco 蓝 #165DFF + 14px 系统字体栈；表单用 commuse 模式（右对齐 label 120–160px + 弹性 input），样式见 `src/styles.css` 的 CSS Token
- 危险操作（giveall all/material/currency、ktc all、account delete）用 `--color-error` + command-bar 二次确认
- 代码 4 空格缩进（.prettierrc 已锁）
- 全部中文交互与文档
- 提交：author 为 `Cyt <qinfyy233@gmail.com>`，末尾加 `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`；commit message 简洁（用户明确要求不要写太复杂）；因频繁 amend，push 常需 `git push -f`
