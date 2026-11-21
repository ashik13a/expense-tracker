const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parse a YYYY-MM-DD string or Date into UTC start-of-day Date.
 */
export const parseStartOfDayUTC = (input) => {
  if (!input) return null;
  if (typeof input === 'string' && DATE_ONLY_REGEX.test(input)) {
    const [year, month, day] = input.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  }
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
};

/**
 * Parse a YYYY-MM-DD string or Date into UTC end-of-day Date (23:59:59.999).
 */
export const parseEndOfDayUTC = (input) => {
  const start = parseStartOfDayUTC(input);
  if (!start) return null;
  return new Date(
    Date.UTC(
      start.getUTCFullYear(),
      start.getUTCMonth(),
      start.getUTCDate(),
      23,
      59,
      59,
      999
    )
  );
};

/**
 * Return UTC Monday 00:00:00.000 -> Sunday 23:59:59.999 for the given anchor date.
 */
export const getWeekRangeUTC = (anchorDate = new Date()) => {
  const start = parseStartOfDayUTC(anchorDate);
  const dayOfWeek = start.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const weekStart = new Date(start);
  weekStart.setUTCDate(start.getUTCDate() + diffToMonday);

  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
  weekEnd.setUTCHours(23, 59, 59, 999);

  return { start: weekStart, end: weekEnd };
};

/**
 * Return UTC start and end of calendar month (month: 1..12).
 */
export const getMonthRangeUTC = (year, month) => {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return { start, end };
};

/**
 * Format a Date to YYYY-MM-DD in UTC.
 */
export const formatDateUTC = (date) => {
  const d = new Date(date);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const roundMoney = (value) => {
  return Math.round((Number(value) || 0) * 100) / 100;
};
