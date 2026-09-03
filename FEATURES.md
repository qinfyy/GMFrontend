# FEATURES

## GM 命令执行（核心能力）

- **能力**：通过图形界面调用 BH2 私服 `GET /api/gm` 全部 11 条命令。
- **集成点**：`src/app/core/gm-api.service.ts`；服务器地址与 ApiKey 在右上角「服务器设置」抽屉配置，持久化于 localStorage。
- **用法**：dev 模式 `yarn start`（自动代理到 localhost:21000）；生产构建后填服务器完整地址。
- **验证**：help / give / setlevel / role / storyrange / ktc / kl / kul / ka / account 端到端测试通过。
- **注意**：ApiKey 非空时以 `Authorization: Bearer` 头发送；生产跨域直连需服务器允许 CORS 或自行反向代理。

## 命令清单（与上游 GameMasterCommandRegistry 对齐，2026-09 同步）

| 命令 | 别名 | 说明 | 路由 |
|------|------|------|------|
| give | g, item | 单件发放 | /give |
| giveall | ga | 按类别批量补齐 | /giveall |
| role | rolev2, setrole | 改写角色养成属性 | /role |
| setlevel | level | 玩家等级 | /player |
| storyrange | story | 普通剧情资源依赖图推进 | /story |
| kyusyoTaskCompleted | ktc | 九霄任务推进 + 发奖 | /story |
| kyusyoLevel | kl | 九霄等级 | /story |
| kyusyoUnlockLevel | kul | 九霄出击关卡解锁 | /story |
| kyusyoAchievement | ka | 九霄成就（探索）发奖 | /story |
| account | — | SDK 账号 CRUD + 强制登录 | /account |
| help | h | 命令说明 | /help |

## 功能页

- **/console** 自由命令 + 动态参数行 + datalist 补全（运行时拉服务端命令清单）
- **/give** 类型 Tab × Handbook 选择器 + 数量 + 装备/养成参数
- **/giveall** 类别批量补齐；all/material/currency 二次确认
- **/role** role-develop 分区选择器（显示养成上限）+ 养成/装备参数
- **/player** 等级设置
- **/story** 5 个 tab：storyrange / ktc / kl / kul / ka；ktc id=all 二次确认
- **/account** 4 个 tab：create / settings / delete / forcelogin；delete 二次确认
- **/help** 实时服务端命令定义 + Handbook 分区浏览（搜索/复制 GM 模板）

## 数据源

- `public/handbook/Handbook.txt`（87080 行，2026-09-03 同步自 `D:\Il2Cpp\bh2\Sv\Handbook.txt`）。
- 分区名变化：`九霄故事` → `九霄故事（逐火之蛾主玩法）`；`逐火之蛾 DLC 故事` → `ZeroDLC 故事`；新增 `九霄任务目录 / kyusyoUnlockLevel 九霄关卡目录 / kyusyoAchievement 九霄成就目录 / ZeroDLC 内容目录`。
- 加载失败时选择器页降级，控制台仍可用。

## 设计体系（LunarCoreToolsWeb 风格）

- 白底 + Arco 蓝主色（#165DFF）+ 14px sans-serif；表单「右对齐 label + 弹性 input」的 commuse 模式。
- 集成点：`src/styles.css`（CSS Token 全集）；系统字体栈（Avenir / Helvetica / Arial / PingFang SC / Microsoft YaHei）。
