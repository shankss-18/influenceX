import { dayjs, DEFAULT_TIMEZONE } from '../config/timezone';
import { IEvent } from '../models/Event';
import { getCurrentISTDate } from './timezone';

export type WindowStatus = 'NOT_STARTED' | 'OPEN' | 'CLOSED';

export interface EventWindowStatuses {
  serverTime: Date;
  serverTimeIST: string;
  registration: {
    status: WindowStatus;
    start: Date;
    startIST: string;
    end: Date;
    endIST: string;
    isOpen: boolean;
  };
  attendance: {
    status: WindowStatus;
    start: Date;
    startIST: string;
    end: Date;
    endIST: string;
    isOpen: boolean;
  };
  credit: {
    status: WindowStatus;
    start: Date;
    startIST: string;
    end: Date;
    endIST: string;
    isOpen: boolean;
  };
}

/**
 * Checks if a given timestamp `now` falls strictly within [start, end] window.
 * Evaluation is Asia/Kolkata timezone aware.
 */
export function isWithinWindow(
  now: Date | string | number | dayjs.Dayjs,
  start: Date | string | number | dayjs.Dayjs,
  end: Date | string | number | dayjs.Dayjs
): boolean {
  const current = dayjs(now).tz(DEFAULT_TIMEZONE);
  const startTime = dayjs(start).tz(DEFAULT_TIMEZONE);
  const endTime = dayjs(end).tz(DEFAULT_TIMEZONE);

  return (current.isAfter(startTime) || current.isSame(startTime)) &&
         (current.isBefore(endTime) || current.isSame(endTime));
}

/**
 * Returns the state of a time window relative to `now`.
 */
export function getWindowStatus(
  now: Date | string | number | dayjs.Dayjs,
  start: Date | string | number | dayjs.Dayjs,
  end: Date | string | number | dayjs.Dayjs
): WindowStatus {
  const current = dayjs(now).tz(DEFAULT_TIMEZONE);
  const startTime = dayjs(start).tz(DEFAULT_TIMEZONE);
  const endTime = dayjs(end).tz(DEFAULT_TIMEZONE);

  if (current.isBefore(startTime)) {
    return 'NOT_STARTED';
  }
  if (current.isAfter(endTime)) {
    return 'CLOSED';
  }
  return 'OPEN';
}

/**
 * Calculates comprehensive window statuses for an Event based on authoritative server time.
 */
export function getEventWindowStatuses(
  event: IEvent,
  now: Date = getCurrentISTDate()
): EventWindowStatuses {
  const formatIST = (d: Date) => dayjs(d).tz(DEFAULT_TIMEZONE).format('YYYY-MM-DD HH:mm:ss');

  const regStatus = getWindowStatus(now, event.registrationStart, event.registrationEnd);
  const attStatus = getWindowStatus(now, event.attendanceWindowStart, event.attendanceWindowEnd);
  const credStatus = getWindowStatus(now, event.creditWindowStart, event.creditWindowEnd);

  return {
    serverTime: now,
    serverTimeIST: formatIST(now),
    registration: {
      status: regStatus,
      start: event.registrationStart,
      startIST: formatIST(event.registrationStart),
      end: event.registrationEnd,
      endIST: formatIST(event.registrationEnd),
      isOpen: regStatus === 'OPEN',
    },
    attendance: {
      status: attStatus,
      start: event.attendanceWindowStart,
      startIST: formatIST(event.attendanceWindowStart),
      end: event.attendanceWindowEnd,
      endIST: formatIST(event.attendanceWindowEnd),
      isOpen: attStatus === 'OPEN',
    },
    credit: {
      status: credStatus,
      start: event.creditWindowStart,
      startIST: formatIST(event.creditWindowStart),
      end: event.creditWindowEnd,
      endIST: formatIST(event.creditWindowEnd),
      isOpen: credStatus === 'OPEN',
    },
  };
}
