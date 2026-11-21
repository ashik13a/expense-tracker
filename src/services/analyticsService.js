import mongoose from 'mongoose';
import { Expense } from '../models/Expense.js';
import { AppError } from '../utils/AppError.js';
import {
  formatDateUTC,
  getMonthRangeUTC,
  getWeekRangeUTC,
  parseEndOfDayUTC,
  parseStartOfDayUTC,
  roundMoney,
} from '../utils/dateUtils.js';

const toObjectId = (id) =>
  id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(id);

/**
 * Resolve date range for analytics period queries.
 */
const resolvePeriodRange = ({ period = 'monthly', date, startDate, endDate }) => {
  const anchor = date ? parseStartOfDayUTC(date) : parseStartOfDayUTC(new Date());

  if (period === 'custom') {
    if (!startDate || !endDate) {
      throw new AppError('startDate and endDate are required for custom period', 400);
    }
    const start = parseStartOfDayUTC(startDate);
    const end = parseEndOfDayUTC(endDate);
    if (start > end) {
      throw new AppError('startDate cannot be later than endDate', 400);
    }
    return { start, end };
  }

  if (period === 'daily') {
    if (startDate || endDate) {
      const start = parseStartOfDayUTC(startDate || endDate);
      const end = parseEndOfDayUTC(endDate || startDate);
      if (start > end) throw new AppError('startDate cannot be later than endDate', 400);
      return { start, end };
    }
    // Last 14 days ending on anchor date for daily trend/breakdown context, or exact day if date specified
    if (date) {
      return { start: parseStartOfDayUTC(date), end: parseEndOfDayUTC(date) };
    }
    const start = new Date(anchor);
    start.setUTCDate(start.getUTCDate() - 13);
    const end = parseEndOfDayUTC(anchor);
    return { start, end };
  }

  if (period === 'weekly') {
    if (startDate && endDate) {
      const start = parseStartOfDayUTC(startDate);
      const end = parseEndOfDayUTC(endDate);
      if (start > end) throw new AppError('startDate cannot be later than endDate', 400);
      return { start, end };
    }
    return getWeekRangeUTC(anchor);
  }

  // Default: monthly (current calendar month of anchor)
  if (startDate && endDate) {
    const start = parseStartOfDayUTC(startDate);
    const end = parseEndOfDayUTC(endDate);
    if (start > end) throw new AppError('startDate cannot be later than endDate', 400);
    return { start, end };
  }
  return getMonthRangeUTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1);
};

export const getAnalyticsSummary = async (userId, { date } = {}) => {
  const uid = toObjectId(userId);
  const anchor = date ? parseStartOfDayUTC(date) : parseStartOfDayUTC(new Date());

  const todayStart = parseStartOfDayUTC(anchor);
  const todayEnd = parseEndOfDayUTC(anchor);
  const weekRange = getWeekRangeUTC(anchor);
  const monthRange = getMonthRangeUTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1);

  const [result] = await Expense.aggregate([
    { $match: { userId: uid } },
    {
      $facet: {
        today: [
          { $match: { expenseDate: { $gte: todayStart, $lte: todayEnd } } },
          { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
        ],
        week: [
          { $match: { expenseDate: { $gte: weekRange.start, $lte: weekRange.end } } },
          { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
        ],
        month: [
          { $match: { expenseDate: { $gte: monthRange.start, $lte: monthRange.end } } },
          { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
        ],
        overall: [
          { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
        ],
        topCategoryMonth: [
          { $match: { expenseDate: { $gte: monthRange.start, $lte: monthRange.end } } },
          {
            $group: {
              _id: '$category',
              total: { $sum: '$amount' },
              count: { $sum: 1 },
            },
          },
          { $sort: { total: -1 } },
          { $limit: 1 },
        ],
      },
    },
  ]);

  const todayTotal = roundMoney(result?.today?.[0]?.total || 0);
  const weekTotal = roundMoney(result?.week?.[0]?.total || 0);
  const monthTotal = roundMoney(result?.month?.[0]?.total || 0);
  const monthTransactions = result?.month?.[0]?.count || 0;
  const totalTransactions = result?.overall?.[0]?.count || 0;

  const topCat = result?.topCategoryMonth?.[0] || null;
  const highestCategory = topCat
    ? {
        category: topCat._id,
        total: roundMoney(topCat.total),
        count: topCat.count,
        percentage: monthTotal > 0 ? roundMoney((topCat.total / monthTotal) * 100) : 0,
      }
    : null;

  return {
    todayTotal,
    weekTotal,
    monthTotal,
    monthTransactions,
    totalTransactions,
    highestCategory,
    ranges: {
      today: formatDateUTC(todayStart),
      weekStart: formatDateUTC(weekRange.start),
      weekEnd: formatDateUTC(weekRange.end),
      month: anchor.getUTCMonth() + 1,
      year: anchor.getUTCFullYear(),
    },
  };
};

export const getCategoryBreakdown = async (userId, query) => {
  const uid = toObjectId(userId);
  const { start, end } = resolvePeriodRange(query);

  const match = {
    userId: uid,
    expenseDate: { $gte: start, $lte: end },
  };
  if (query.category) match.category = query.category;
  if (query.paymentMethod) match.paymentMethod = query.paymentMethod;

  const rows = await Expense.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$category',
        total: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
    { $sort: { total: -1 } },
  ]);

  const totalAmount = roundMoney(rows.reduce((sum, row) => sum + row.total, 0));
  const categories = rows.map((row) => ({
    category: row._id,
    total: roundMoney(row.total),
    count: row.count,
    percentage: totalAmount > 0 ? roundMoney((row.total / totalAmount) * 100) : 0,
  }));

  return {
    period: query.period || 'monthly',
    startDate: formatDateUTC(start),
    endDate: formatDateUTC(end),
    totalAmount,
    categories,
  };
};

export const getSpendingTrend = async (userId, query) => {
  const uid = toObjectId(userId);
  const period = query.period || 'monthly';
  const anchor = query.date ? parseStartOfDayUTC(query.date) : parseStartOfDayUTC(new Date());

  let start;
  let end;
  let groupFormat;

  if (period === 'custom') {
    if (!query.startDate || !query.endDate) {
      throw new AppError('startDate and endDate are required for custom period', 400);
    }
    start = parseStartOfDayUTC(query.startDate);
    end = parseEndOfDayUTC(query.endDate);
    if (start > end) {
      throw new AppError('startDate cannot be later than endDate', 400);
    }
    const spanDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    groupFormat = spanDays > 90 ? '%Y-%m' : '%Y-%m-%d';
  } else if (period === 'daily') {
    if (query.startDate && query.endDate) {
      start = parseStartOfDayUTC(query.startDate);
      end = parseEndOfDayUTC(query.endDate);
    } else {
      end = parseEndOfDayUTC(anchor);
      start = new Date(anchor);
      start.setUTCDate(start.getUTCDate() - 13);
    }
    groupFormat = '%Y-%m-%d';
  } else if (period === 'weekly') {
    if (query.startDate && query.endDate) {
      start = parseStartOfDayUTC(query.startDate);
      end = parseEndOfDayUTC(query.endDate);
    } else {
      // Current week Mon -> Sun, grouped by day for readable weekly trend
      const range = getWeekRangeUTC(anchor);
      start = range.start;
      end = range.end;
    }
    groupFormat = '%Y-%m-%d';
  } else {
    // monthly: last 6 months ending at anchor month, grouped by YYYY-MM
    if (query.startDate && query.endDate) {
      start = parseStartOfDayUTC(query.startDate);
      end = parseEndOfDayUTC(query.endDate);
      groupFormat = '%Y-%m-%d';
    } else {
      const endRange = getMonthRangeUTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1);
      end = endRange.end;
      start = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() - 5, 1, 0, 0, 0, 0));
      groupFormat = '%Y-%m';
    }
  }

  const match = {
    userId: uid,
    expenseDate: { $gte: start, $lte: end },
  };
  if (query.category) match.category = query.category;
  if (query.paymentMethod) match.paymentMethod = query.paymentMethod;

  const rows = await Expense.aggregate([
    { $match: match },
    {
      $group: {
        _id: { $dateToString: { format: groupFormat, date: '$expenseDate' } },
        total: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const points = rows.map((row) => ({
    label: row._id,
    total: roundMoney(row.total),
    count: row.count,
  }));

  const totalAmount = roundMoney(points.reduce((sum, p) => sum + p.total, 0));

  return {
    period,
    groupBy: groupFormat === '%Y-%m' ? 'month' : 'day',
    startDate: formatDateUTC(start),
    endDate: formatDateUTC(end),
    totalAmount,
    points,
  };
};
