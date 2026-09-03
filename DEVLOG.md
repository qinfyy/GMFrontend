# DEVLOG

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
