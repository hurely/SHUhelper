/**
 * 使用人类的格式创建一个日期对象
 * @param year 年份
 * @param month 月份
 * @param day 日期
 * JS's Date is a piece of sh*t, month has to minus 1 but others doesn't
 */
export function createDate(year: number, month: number, day: number) {
    return new Date(year, month - 1, day);
}

/**
 * 判断两个日期是否是同一天
 * @return 是同一天返回true，否则返回false
 */
export function isSameDate(date1: Date, date2: Date): boolean {
    return date1.getDate() === date2.getDate() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getFullYear() === date2.getFullYear();
}