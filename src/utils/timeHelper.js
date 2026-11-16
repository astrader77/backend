import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const TIMEZONE = process.env.TIMEZONE || 'Asia/Karachi';

// Returns dayjs instance in Asia/Karachi timezone
export const getNowPKT = () => {
  return dayjs().tz(TIMEZONE);
};

// Formats as YYYY-MM-DD in Asia/Karachi
export const getCurrentBusinessDate = () => {
  return getNowPKT().format('YYYY-MM-DD');
};

// Helper to convert time strings like "07:00 AM" or "19:00" to minutes from midnight
export const parseTimeToMinutes = (timeStr, defaultMinutes) => {
  if (!timeStr) return defaultMinutes;
  try {
    const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
    if (!match) return defaultMinutes;
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const period = match[3] ? match[3].toUpperCase() : null;

    if (period === 'PM' && hours < 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;

    return hours * 60 + minutes;
  } catch (e) {
    return defaultMinutes;
  }
};

// Checks if current time is within business hours based on custom opening/closing settings
export const isWithinBusinessHours = (openingTimeStr = '07:00 AM', closingTimeStr = '07:00 PM') => {
  const now = getNowPKT();
  const hour = now.hour();
  const minute = now.minute();
  const totalMinutes = hour * 60 + minute;

  const openingMinutes = parseTimeToMinutes(openingTimeStr, 7 * 60); // Default 7:00 AM
  const closingMinutes = parseTimeToMinutes(closingTimeStr, 19 * 60); // Default 7:00 PM

  return totalMinutes >= openingMinutes && totalMinutes < closingMinutes;
};

// Returns standard format for display in PKT
export const formatPKT = (date, format = 'YYYY-MM-DD hh:mm A') => {
  if (!date) return '-';
  return dayjs(date).tz(TIMEZONE).format(format);
};

// Returns start and end of business day in UTC Date objects for querying
export const getBusinessDayRange = (dateStr) => {
  // dateStr in 'YYYY-MM-DD'
  const start = dayjs.tz(`${dateStr} 00:00:00`, TIMEZONE).toDate();
  const end = dayjs.tz(`${dateStr} 23:59:59`, TIMEZONE).toDate();
  return { start, end };
};

export { dayjs };

