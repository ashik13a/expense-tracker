import mongoose from 'mongoose';
import { Budget } from '../models/Budget.js';
import { Expense } from '../models/Expense.js';
import { AppError } from '../utils/AppError.js';
import { getMonthRangeUTC, roundMoney } from '../utils/dateUtils.js';

const toObjectId = (id) =>
  id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(id);

const ensureValidId = (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError('Invalid budget ID', 400);
  }
};

const computeMonthlySpent = async (userId, year, month) => {
  const { start, end } = getMonthRangeUTC(year, month);
  const [agg] = await Expense.aggregate([
    {
      $match: {
        userId: toObjectId(userId),
        expenseDate: { $gte: start, $lte: end },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
  ]);
  return {
    spent: roundMoney(agg?.total || 0),
    transactionCount: agg?.count || 0,
  };
};

const formatBudgetMetrics = (budgetDoc, spent, transactionCount, month, year) => {
  if (!budgetDoc) {
    return {
      hasBudget: false,
      budget: null,
      month,
      year,
      amount: 0,
      spent,
      remaining: null,
      usagePercentage: 0,
      status: 'none',
      transactionCount,
    };
  }

  const budgetAmount = roundMoney(budgetDoc.amount);
  const remaining = roundMoney(budgetAmount - spent);

  let usagePercentage = 0;
  let status = 'on_track';

  if (budgetAmount === 0) {
    usagePercentage = spent > 0 ? 100 : 0;
    status = spent > 0 ? 'exceeded' : 'on_track';
  } else {
    usagePercentage = roundMoney((spent / budgetAmount) * 100);
    if (spent > budgetAmount) {
      status = 'exceeded';
    } else if (usagePercentage >= 80) {
      status = 'warning';
    } else {
      status = 'on_track';
    }
  }

  return {
    hasBudget: true,
    budget: budgetDoc,
    month: budgetDoc.month,
    year: budgetDoc.year,
    amount: budgetAmount,
    spent,
    remaining,
    usagePercentage,
    status,
    transactionCount,
  };
};

export const getCurrentBudget = async (userId, { month, year } = {}) => {
  const now = new Date();
  const targetMonth = month || now.getUTCMonth() + 1;
  const targetYear = year || now.getUTCFullYear();

  const [budgetDoc, { spent, transactionCount }] = await Promise.all([
    Budget.findOne({ userId, month: targetMonth, year: targetYear }),
    computeMonthlySpent(userId, targetYear, targetMonth),
  ]);

  return formatBudgetMetrics(budgetDoc, spent, transactionCount, targetMonth, targetYear);
};

export const createBudget = async (userId, { month, year, amount }) => {
  const existing = await Budget.findOne({ userId, month, year });
  if (existing) {
    throw new AppError(`A budget for ${month}/${year} already exists`, 409);
  }

  const budgetDoc = await Budget.create({
    userId,
    month,
    year,
    amount: roundMoney(amount),
  });

  const { spent, transactionCount } = await computeMonthlySpent(userId, year, month);
  return formatBudgetMetrics(budgetDoc, spent, transactionCount, month, year);
};

export const updateBudget = async (userId, budgetId, { amount }) => {
  ensureValidId(budgetId);

  const budgetDoc = await Budget.findOneAndUpdate(
    { _id: budgetId, userId },
    { $set: { amount: roundMoney(amount) } },
    { new: true, runValidators: true }
  );

  if (!budgetDoc) {
    throw new AppError('Budget not found', 404);
  }

  const { spent, transactionCount } = await computeMonthlySpent(
    userId,
    budgetDoc.year,
    budgetDoc.month
  );
  return formatBudgetMetrics(budgetDoc, spent, transactionCount, budgetDoc.month, budgetDoc.year);
};

export const deleteBudget = async (userId, budgetId) => {
  ensureValidId(budgetId);
  const budgetDoc = await Budget.findOneAndDelete({ _id: budgetId, userId });
  if (!budgetDoc) {
    throw new AppError('Budget not found', 404);
  }
  return budgetDoc;
};
