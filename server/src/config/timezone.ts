import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

// Extend dayjs with UTC and Timezone plugins
dayjs.extend(utc);
dayjs.extend(timezone);

// Set default timezone to Asia/Kolkata
export const DEFAULT_TIMEZONE = 'Asia/Kolkata';
dayjs.tz.setDefault(DEFAULT_TIMEZONE);

export { dayjs };
