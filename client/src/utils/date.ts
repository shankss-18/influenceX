/**
 * Formats an ISO date string to readable IST date & time
 */
export function formatDateTimeIST(dateString: string | Date): string {
  if (!dateString) return 'N/A';
  const d = new Date(dateString);
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Formats an ISO date string to readable IST date only
 */
export function formatDateIST(dateString: string | Date): string {
  if (!dateString) return 'N/A';
  const d = new Date(dateString);
  return d.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Converts a Date or ISO string to format suitable for <input type="datetime-local"> in local timezone
 */
export function toDatetimeLocalValue(dateInput?: string | Date): string {
  const d = dateInput ? new Date(dateInput) : new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Formats a time string or Date into 12-hour IST format (e.g., '10:00 AM', '01:30 PM')
 */
export function formatTime12hIST(timeOrDate?: string | Date): string {
  if (!timeOrDate) return 'N/A';
  if (typeof timeOrDate === 'string' && /^\d{1,2}:\d{2}\s*(AM|PM)$/i.test(timeOrDate.trim())) {
    return timeOrDate.trim().toUpperCase();
  }
  const d = new Date(timeOrDate);
  if (isNaN(d.getTime())) return String(timeOrDate);
  return d.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Combines a date string ('YYYY-MM-DD') and a 12-hour time string ('06:00 PM') into an ISO string
 */
export function combineDateAnd12hTime(dateStr: string, time12h: string): string {
  if (!dateStr) return new Date().toISOString();
  
  const match = time12h.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  let hours = 10;
  let minutes = 0;

  if (match) {
    let rawHours = parseInt(match[1], 10);
    minutes = parseInt(match[2], 10);
    const period = match[3].toUpperCase();

    if (period === 'PM' && rawHours < 12) rawHours += 12;
    if (period === 'AM' && rawHours === 12) rawHours = 0;
    hours = rawHours;
  }

  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d, hours, minutes, 0, 0);
  return dt.toISOString();
}

/**
 * Splits a Date or ISO timestamp into a date ('YYYY-MM-DD') and 12-hour time parts
 */
export function splitDateAnd12hTime(dateInput?: string | Date): {
  date: string;
  time12h: string;
  hour: string;
  minute: string;
  period: 'AM' | 'PM';
} {
  const d = dateInput ? new Date(dateInput) : new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const date = `${year}-${month}-${day}`;

  let rawH = d.getHours();
  const min = pad(d.getMinutes());
  const period: 'AM' | 'PM' = rawH >= 12 ? 'PM' : 'AM';
  
  let h12 = rawH % 12;
  if (h12 === 0) h12 = 12;
  const hour = pad(h12);
  const time12h = `${hour}:${min} ${period}`;

  return { date, time12h, hour, minute: min, period };
}
