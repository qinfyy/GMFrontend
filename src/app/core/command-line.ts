/**
 * GM 命令行的构造工具。
 *
 * 上游 2026-09 把 GM 接口从「结构化查询参数」重构为命令行风格：
 * 端点唯一入参 content 就是整条命令，形如
 *
 *   /give weapon 1001 x2 lv80 r5 @10001
 *
 * 位置参数、通用修饰符（x数量 / lv / r / s / p / i / t / pt / bl / ml）、
 * -flag 与 @uid 全部以空格分隔拼在同一条命令里，由服务端 CommandContext 分词解析。
 * 因此前端的职责从「拼查询串」变成「拼命令行」。
 *
 * 这里把拼装收敛到一处，页面只声明自己有哪些参数。
 */

/** 命令行片段：null / undefined / 空串会被丢弃 */
export type CmdPart = string | number | null | undefined;

function isBlank(part: CmdPart): boolean {
    return part === null || part === undefined || String(part).trim() === '';
}

/** 解析为不小于 min 的整数；空值、非数字、越界都返回 null */
function toInt(part: CmdPart, min: number): number | null {
    if (isBlank(part)) return null;
    const value = Math.floor(Number(String(part).trim()));
    return Number.isFinite(value) && value >= min ? value : null;
}

/**
 * 拼一条命令。
 *
 * @param label 命令名或别名，不带前缀斜杠
 * @param parts 位置参数与修饰符片段，按给定顺序拼接，空片段自动丢弃
 * @param uid   目标玩家 UID；非空时以 @uid 追加在末尾
 */
export function cmdLine(label: string, parts: CmdPart[], uid?: CmdPart): string {
    const tokens = parts.filter(part => !isBlank(part)).map(part => String(part).trim());
    const head = `/${label}`;
    const body = tokens.length > 0 ? `${head} ${tokens.join(' ')}` : head;
    return isBlank(uid) ? body : `${body} @${String(uid).trim()}`;
}

/** x<数量> 修饰符；服务端要求正整数，0 与非法值返回 null（省略即按 1 处理） */
export function xAmount(value: CmdPart): string | null {
    const amount = toInt(value, 1);
    return amount === null ? null : `x${amount}`;
}

/**
 * 带前缀的数值修饰符：mod('lv', 80) → 'lv80'。
 * 覆盖 lv/r/s/sk/p/i/t/pt/bl/ml 这些服务端前缀；无值时返回 null 便于被 cmdLine 丢弃。
 */
export function mod(prefix: string, value: CmdPart): string | null {
    const number = toInt(value, 0);
    return number === null ? null : `${prefix}${number}`;
}

/** 布尔开关：enabled 为 true 时输出 -<name>，否则丢弃 */
export function flag(name: string, enabled: boolean): string | null {
    return enabled ? `-${name}` : null;
}

/**
 * 位置参数：非空即原样输出。
 * 用于命令自身的位置参数（give 的 type/id、setlevel 的等级、storycompleted 的终点关卡等）。
 */
export function arg(value: CmdPart): string | null {
    return isBlank(value) ? null : String(value).trim();
}
