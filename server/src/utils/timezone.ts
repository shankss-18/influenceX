import { dayjs, DEFAULT_TIMEZONE } from '../config/timezone';

export { dayjs, DEFAULT_TIMEZONE };

/**
 * Returns current Date in Asia/Kolkata timezone
 */
export function getCurrentISTDate(): Date {
  return dayjs().tz(DEFAULT_TIMEZONE).toDate();
}

/**
 * Returns current ISO string in Asia/Kolkata timezone
 */
export function getCurrentISTString(): string {
  return dayjs().tz(DEFAULT_TIMEZONE).format('YYYY-MM-DD HH:mm:ss ZZ');
}

/**
 * Format any date object into Asia/Kolkata formatted string
 */
export function formatToIST(date: Date | string | number, formatStr: string = 'YYYY-MM-DD HH:mm:ss'): string {
  return dayjs(date).tz(DEFAULT_TIMEZONE).format(formatStr);
}

/**
 * Checks if a given timestamp falls within window start and end
 */
export function isWithinWindow(now: Date, start: Date, end: Date): boolean {
  const n = new Date(now).getTime();
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  return n >= s && n <= e;
}
