# MEMORY.md — GMFrontend 项目长期约定

## 项目性质

BH2 私服 GM 控制台，Angular 22 纯前端，对接 `D:\Il2Cpp\bh2\Sv` 的 `GET /api/gm`。不修改服务器代码。

## 上游协议（2026-09-13 起）

- 唯一端点 `GET /api/gm?content=<整条 GM 命令行>`；位置参数 + 修饰符 + `-flag` + `@uid` 空格分隔
- 12 条命令：give / giveall / role / setlevel / storycompleted(sc) / newstorycompleted(nsc) / kyusyoTaskCompleted(ktc) / kyusyoLevel(kl) / kyusyoUnlockLevel(kul) / kyusyoAchievement(ka) / account / help
- 响应：成功 `{success:true, errorDescription:null, messages[]}`；失败 `{success:false, errorDescription, messages:[]}` + HTTP 400/401/404/500
- **上游外壳变动频繁**（同日改过两次），客户端保持多版本容错

## 代码约定

- 每页只写一个 `preview(): string`，`send()` 复用；保证预览与执行一致
- 表单派生值用普通方法，不用无 signal 依赖的 `computed`（只算一次就缓存）
- 页面/组件类成员一律 `protected`；4 空格缩进
- 全部中文交互与文档

## 环境约定

- 构建必须用系统 Node 24：`export PATH="/c/Program Files/nodejs:$PATH"`（受管 Node 22.22.2 被 Angular CLI 拒绝）
- 本机有 `http_proxy`：探测本地服务要用 `curl -f` 或等日志出现 `Application started`
- Sv.exe 启动约 25 秒；后台进程随回合结束被回收，验证步骤要写在同一条命令里

## 用户偏好

- 交付要快、要直接；不耐烦长流程
- commit message 简洁，author `Cyt <qinfyy233@gmail.com>`
