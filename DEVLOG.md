# DEVLOG

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
