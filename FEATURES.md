# FEATURES

## GM 命令执行（核心能力）

- **能力**：通过图形界面执行 BH2 私服全部 15 条 GM 命令。
- **集成点**：`src/app/core/gm-api.service.ts`；服务器地址与 ApiKey 在右上角「服务器设置」抽屉配置，持久化于 localStorage。
- **用法**：dev 模式 `yarn start`（自动代理到 localhost:21000）；生产构建后填服务器完整地址。
- **验证**：help / 各命令错误路径端到端测试通过（2026-09-17 对运行中的真实服务器实测）。
- **注意**：ApiKey 非空时以 `Authorization: Bearer` 头发送；服务器已返回 `Access-Control-Allow-Origin: *`，直连可行。

## 上游协议（2026-09-17 同步）

- **请求**：`GET /api/gm?content=<整条 GM 命令行>`，如 `content=/give weapon 1001 x2 lv80 r5 @10001`
- **命令行语法**：位置参数 + 修饰符 + `-flag` + `@uid`，全部空格分隔，前缀斜杠可省略
- **修饰符**：`x数量` `lv等级` `r星级` `s技能`（= `sk`）`p升格` `i亲密度` `t圣痕` `pt限解度` `bl基础等级` `ml精通等级`
- **响应**：成功 `{success:true, errorDescription:null, messages:[…]}`；失败 `{success:false, errorDescription:"…", messages:[]}` + HTTP 400/401/404/500
- **容错**：只认当前版外壳 `{success, errorDescription, messages}`，不做多版本兼容
- **参数表**：服务端把 token 分为 `Args`（保留数值型修饰符）与 `PositionalArgs`（不保留）；按位取参的命令一律用后者

## 命令清单（与上游 GameMasterCommandRegistry 对齐，2026-09-17 同步）

| 命令 | 别名 | 说明 | 路由 |
|------|------|------|------|
| give | g, item | 单件发放 | /give |
| giveall | ga | 按类别批量补齐 | /giveall |
| role | rolev2, setrole | 改写角色养成属性（支持 `-max`） | /role |
| setlevel | level | 玩家等级 | /player |
| kick | — | 踢出在线玩家（5 种模式） | /moderation |
| ban | — | 封禁 / 解封账号（离线可操作） | /moderation |
| windy | — | 向在线客户端下发 Lua 脚本（windseed 热更） | /windy |
| storycompleted | sc | 普通剧情资源依赖图推进 | /story |
| newstorycompleted | nsc | 崩坏学园篇整章/指定关卡完成 | /story |
| kyusyoTaskCompleted | ktc | 九霄任务推进 + 发奖 | /story |
| kyusyoLevel | kl | 九霄等级 | /story |
| kyusyoUnlockLevel | kul | 九霄出击关卡解锁 | /story |
| kyusyoAchievement | ka | 九霄成就（探索）发奖 | /story |
| account | — | SDK 账号 CRUD + 强制登录 | /account |
| help | h | 命令说明 | /help |

## 物品类别（give / giveall 的 type）

| type | 含义 | x数量 | 装备参数 | 分区 |
|------|------|-------|---------|------|
| currency | 货币（hcoin / bhcoin / scoin / 数字 CoinType） | ✅ | ❌ | [currency] |
| material | 背包堆叠材料 | ✅ | ❌ | [material] |
| weapon / costume / badge / role | 武器 / 服装 / 徽章 / 标准角色 | ✅ | ✅ | 同名分区 |
| emblem | 萌章（EmblemData，ID 5001-5999） | ✅ | ✅ | [emblem] |
| petchip | 使魔碎片（PetChipData，ID 8001-8999） | ✅ | ✅ | [petchip] |
| potential | RoleV2 限解道具（仅 give） | ✅ | ❌ | [potential] |
| skin | 角色皮肤（单份，幂等） | ❌ | ❌ | [skin] |
| partner | 开放看板（唯一收藏） | ❌ | ❌ | [partner] |
| all | 仅 giveall：6 类装备 + 开放看板 | ❌ | ✅ | — |

`badge`（背包徽章装备，PassiveSkillDataV3）与 `emblem`（学生证萌章，EmblemData）是两套系统，ID 不要互推。

## 功能页

- **/console** 自由命令行输入 + 服务端 `/help` 命令速查（点击用法填入）+ 已识别命令的用法提示
- **/give** 11 个类型 Tab × Handbook 选择器 + `x数量` + `lv/r/s/p/i/t/pt/bl/ml` 参数（skin/partner 不接受数量）
- **/giveall** 11 个类别批量补齐；all/material/currency 二次确认；material/currency 强制填数量
- **/role** role-develop 分区选择器 + 养成/装备参数 + `-max` 一键拉满
- **/player** 等级设置（`/setlevel`）
- **/moderation** 踢下线（`/kick` 5 种模式 + 自定义正文）+ 封禁/解封（`/ban`，结束时间用 datetime-local 选，自动转 `yyyyMMddHHmm`）；两者均二次确认，并对「正文/理由含修饰符形态片段或空格」做发送前校验
- **/windy** 脚本热更：填目标 uid + 服务器脚本路径（带 `login.lua` / `PopWin.lua` 提示），二次确认；目标必须在线
- **/story** 6 个 tab：sc / nsc / ktc / kl / kul / ka；ktc all 与 nsc 整章模式二次确认
- **/account** 4 个 tab：create / settings / delete / forcelogin；delete 二次确认
- **/help** 实时服务端命令定义（展开时按需拉 notes）+ Handbook 分区浏览（搜索/复制 GM 命令）

## 数据源

- `public/Handbook.txt`（9340 行，2026-09-17 同步自 `D:\Il2Cpp\bh2\Sv\Handbook.txt`）。
- **19 个分区**（侧栏动态枚举「有数据行的分区」，不硬编码）：currency / weapon / costume / badge / role / emblem / petchip / material / potential / role-develop / skin / partner / 九霄任务目录 / 九霄关卡目录 / 九霄成就目录 / ZeroDLC 内容目录 / 传承篇 / 新生篇 / 崩坏学园篇章节目录。
- 装备分区由服务端按装备 TypeId 动态生成，上游新增装备类型会自动多出分区，前端无需改代码。
- GM 模板已全部是命令行写法（上游 2026-09-14 起），可直接复制执行；旧的查询串兼容层已移除。
- 加载失败时选择器页降级，控制台仍可用。

## 设计体系（LunarCoreToolsWeb 风格）

- 白底 + Arco 蓝主色（#165DFF）+ 14px sans-serif；表单「右对齐 label + 弹性 input」的 commuse 模式。
- 集成点：`src/styles.css`（CSS Token 全集）；系统字体栈（Avenir / Helvetica / Arial / PingFang SC / Microsoft YaHei）。
