# MEMORY.md — GMFrontend 项目长期约定

## 项目性质

BH2 私服 GM 控制台，Angular 22 纯前端，对接 `D:\Il2Cpp\bh2\Sv` 的 `GET /api/gm`。不修改服务器代码。

## 上游协议（2026-09-17 起）

- 唯一端点 `GET /api/gm?content=<整条 GM 命令行>`；位置参数 + 修饰符 + `-flag` + `@uid` 空格分隔
- 15 条命令：give / giveall / role / setlevel / kick / ban / **windy** / storycompleted(sc) / newstorycompleted(nsc) / kyusyoTaskCompleted(ktc) / kyusyoLevel(kl) / kyusyoUnlockLevel(kul) / kyusyoAchievement(ka) / account / help
- 物品类别：currency / material / weapon / costume / badge / **emblem** / **petchip** / role / potential / skin / partner（giveall 另有 all = 6 类装备 + 开放看板）
- 响应：成功 `{success:true, errorDescription:null, messages[]}`；失败 `{success:false, errorDescription, messages:[]}` + HTTP 400/401/404/500
- **只认当前版外壳，不做多版本容错**（用户明确要求）；上游再改字段只需动 `GmResponse` 与 `toGmError`
- 服务端 token 分 `Args`（保留数值型修饰符）与 `PositionalArgs`（不保留）→ 正文/理由里不能出现 `x1`/`lv80`/`r5`/`t99`/`-x`/`@…` 片段
- Handbook 的 GM 列已全部是命令行写法，**不要**再引入旧查询串兼容层
- Handbook 分区名由服务端按装备 TypeId 动态生成 → **help 页分区必须动态枚举**（`HandbookService.sectionNames()`），不要写死白名单

## 代码约定

- 每页只写一个 `preview(): string`，`send()` 复用；保证预览与执行一致
- 表单派生值用普通方法，不用无 signal 依赖的 `computed`（只算一次就缓存）
- 页面/组件类成员一律 `protected`；4 空格缩进
- 全部中文交互与文档
- 危险操作走 command-bar 的 `[danger]` 二次确认

## 环境约定

- 构建必须用系统 Node 24：`export PATH="/c/Program Files/nodejs:$PATH"`（受管 Node 22.22.2 被 Angular CLI 拒绝）
- 本机有 `http_proxy`：打 localhost 必须加 `--noproxy '*'`，否则拿到代理的错误页；探测服务端也可等日志出现 `Application started`
- Sv.exe 启动约 25 秒；后台进程随回合结束被回收，验证步骤要写在同一条命令里
- `Sv/Handbook.txt` 是启动时生成的，**可能被上游删掉**；缺失时启动一次服务端即重建，然后 `cp` 到 `public/`
- 离线验证 `handbook.service.ts`：用项目自带 esbuild 打包 + `--alias:@angular/core=./stub-core.js` 空实现 + stub `globalThis.fetch`，不需要起浏览器

## 用户偏好

- 交付要快、要直接；不耐烦长流程
- 不要探讨/质疑上游行为，按指示改就对了
- commit message 简洁，author `Cyt <qinfyy233@gmail.com>`
- **`.workbuddy-ai/` 随项目一起提交**（用户明确同意）：不要往 `.gitignore` 里加忽略规则，`memory/*.md` 保持被跟踪
- 注意：本项目里 `CLAUDE.md` / `MEMORY.md` 等文档偶尔会被外部进程还原掉部分编辑；改完重要文档后建议复核一次
