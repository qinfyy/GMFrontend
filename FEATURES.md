# FEATURES

## GM 命令执行（核心能力）

- **能力**：通过图形界面调用 BH2 私服 `GET /api/gm` 全部 10 条命令。
- **集成点**：`src/app/core/gm-api.service.ts`；服务器地址与 ApiKey 在右上角「服务器设置」抽屉配置，持久化于 localStorage。
- **用法**：dev 模式 `yarn start`（自动代理到 localhost:21000）；生产构建后填服务器完整地址（如 `http://127.0.0.1:21000`）。
- **验证**：help / give / setlevel / role 已对真实服务器实测成功；404/400 错误路径正确展示中文提示。
- **注意**：ApiKey 非空时以 `Authorization: Bearer` 头发送；生产跨域直连需服务器允许 CORS 或自行反向代理。

## 功能页

| 路由 | 命令 | 说明 |
|------|------|------|
| /console | 任意 | 自由命令 + 动态参数行 + datalist 补全 |
| /give | give | 类型 Tab × Handbook 选择器 + 数量 + 装备/养成参数 |
| /giveall | giveall | 类别批量补齐；all/material/currency 二次确认 |
| /role | role | role-develop 分区选择器（显示养成上限）+ 养成/装备参数 |
| /player | setlevel | 等级设置 |
| /story | storyrange / kyusyoclear / kyusystory / dlcstory / dlcunlock | 剧情/九霄/DLC 推进；dlcunlock 二次确认 |
| /help | help | 实时服务端命令定义 + Handbook 分区浏览（搜索/复制 GM 模板） |

- **数据源**：`public/handbook/Handbook.txt`（由服务器启动时生成；更新时从 `Sv/Handbook.txt` 重新复制）。
- **注意**：Handbook 加载失败时选择器页降级，控制台仍可用。

## 设计体系（LunarCoreToolsWeb 风格）

- **能力**：白底 + Arco 蓝主色（#165DFF）+ 14px sans-serif；表单采用「右对齐 label + 弹性 input」的 commuse 模式。
- **集成点**：`src/styles.css`（CSS Token 全集）；系统字体栈（Avenir / Helvetica / Arial / PingFang SC / Microsoft YaHei）。
- **变更**：早期曾使用 anthropic-style-cn-main，已在 2026-08-27 卸载，资产目录与外部字体依赖已删除。
