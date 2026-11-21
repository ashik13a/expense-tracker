import * as expenseService from '../services/expenseService.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const createExpense = asyncHandler(async (req, res) => {
  const expense = await expenseService.createExpense(req.user._id, req.body);
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Expense created successfully',
    data: expense,
  });
});

export const listExpenses = asyncHandler(async (req, res) => {
  const result = await expenseService.listExpenses(req.user._id, req.query);
  return sendSuccess(res, {
    statusCode: 200,
    message: 'Expenses retrieved successfully',
    data: result,
  });
});

export const getExpenseById = asyncHandler(async (req, res) => {
  const expense = await expenseService.getExpenseById(req.user._id, req.params.id);
  return sendSuccess(res, {
    statusCode: 200,
    message: 'Expense retrieved successfully',
    data: expense,
  });
});

export const updateExpense = asyncHandler(async (req, res) => {
  const expense = await expenseService.updateExpense(req.user._id, req.params.id, req.body);
  return sendSuccess(res, {
    statusCode: 200,
    message: 'Expense updated successfully',
    data: expense,
  });
});

export const deleteExpense = asyncHandler(async (req, res) => {
  await expenseService.deleteExpense(req.user._id, req.params.id);
  return sendSuccess(res, {
    statusCode: 200,
    message: 'Expense deleted successfully',
    data: null,
  });
});
