import mongoose from 'mongoose';
import { Expense } from '../models/Expense.js';
import { AppError } from '../utils/AppError.js';
import {
  parseEndOfDayUTC,
  parseStartOfDayUTC,
  roundMoney,
} from '../utils/dateUtils.js';

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const ensureValidId = (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError('Invalid expense ID', 400);
  }
};

export const createExpense = async (userId, payload) => {
  const expenseDate = parseStartOfDayUTC(payload.expenseDate);
  if (!expenseDate) {
    throw new AppError('Invalid expense date', 400);
  }

  const expense = await Expense.create({
    userId,
    title: payload.title,
    amount: roundMoney(payload.amount),
    category: payload.category,
    paymentMethod: payload.paymentMethod,
    expenseDate,
    note: payload.note || '',
  });

  return expense;
};

export const listExpenses = async (userId, query) => {
  const {
    search,
    date,
    startDate,
    endDate,
    category,
    paymentMethod,
    page = 1,
    limit = 10,
    sortBy = 'expenseDate',
    order = 'desc',
  } = query;

  const filter = { userId };

  if (search) {
    const regex = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ title: regex }, { note: regex }];
  }

  if (category) {
    filter.category = category;
  }

  if (paymentMethod) {
    filter.paymentMethod = paymentMethod;
  }

  if (date) {
    filter.expenseDate = {
      $gte: parseStartOfDayUTC(date),
      $lte: parseEndOfDayUTC(date),
    };
  } else if (startDate || endDate) {
    filter.expenseDate = {};
    if (startDate) {
      filter.expenseDate.$gte = parseStartOfDayUTC(startDate);
    }
    if (endDate) {
      filter.expenseDate.$lte = parseEndOfDayUTC(endDate);
    }
    if (startDate && endDate && filter.expenseDate.$gte > filter.expenseDate.$lte) {
      throw new AppError('startDate cannot be later than endDate', 400);
    }
  }

  const sortDirection = order === 'asc' ? 1 : -1;
  const sortObj = { [sortBy]: sortDirection, createdAt: -1 };
  const skip = (page - 1) * limit;

  const [items, totalItems] = await Promise.all([
    Expense.find(filter).sort(sortObj).skip(skip).limit(limit).lean(),
    Expense.countDocuments(filter),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalItems / limit));

  return {
    items,
    pagination: {
      page,
      limit,
      totalItems,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
};

export const getExpenseById = async (userId, expenseId) => {
  ensureValidId(expenseId);
  const expense = await Expense.findOne({ _id: expenseId, userId });
  if (!expense) {
    throw new AppError('Expense not found', 404);
  }
  return expense;
};

export const updateExpense = async (userId, expenseId, payload) => {
  ensureValidId(expenseId);

  const updates = {};
  if (payload.title !== undefined) updates.title = payload.title;
  if (payload.amount !== undefined) updates.amount = roundMoney(payload.amount);
  if (payload.category !== undefined) updates.category = payload.category;
  if (payload.paymentMethod !== undefined) updates.paymentMethod = payload.paymentMethod;
  if (payload.note !== undefined) updates.note = payload.note;
  if (payload.expenseDate !== undefined) {
    const parsedDate = parseStartOfDayUTC(payload.expenseDate);
    if (!parsedDate) {
      throw new AppError('Invalid expense date', 400);
    }
    updates.expenseDate = parsedDate;
  }

  const expense = await Expense.findOneAndUpdate(
    { _id: expenseId, userId },
    { $set: updates },
    { new: true, runValidators: true }
  );

  if (!expense) {
    throw new AppError('Expense not found', 404);
  }

  return expense;
};

export const deleteExpense = async (userId, expenseId) => {
  ensureValidId(expenseId);
  const expense = await Expense.findOneAndDelete({ _id: expenseId, userId });
  if (!expense) {
    throw new AppError('Expense not found', 404);
  }
  return expense;
};
