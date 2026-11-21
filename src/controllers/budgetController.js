import * as budgetService from '../services/budgetService.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getCurrentBudget = asyncHandler(async (req, res) => {
  const data = await budgetService.getCurrentBudget(req.user._id, req.query);
  return sendSuccess(res, {
    statusCode: 200,
    message: 'Budget overview retrieved',
    data,
  });
});

export const createBudget = asyncHandler(async (req, res) => {
  const data = await budgetService.createBudget(req.user._id, req.body);
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Budget created successfully',
    data,
  });
});

export const updateBudget = asyncHandler(async (req, res) => {
  const data = await budgetService.updateBudget(req.user._id, req.params.id, req.body);
  return sendSuccess(res, {
    statusCode: 200,
    message: 'Budget updated successfully',
    data,
  });
});

export const deleteBudget = asyncHandler(async (req, res) => {
  await budgetService.deleteBudget(req.user._id, req.params.id);
  return sendSuccess(res, {
    statusCode: 200,
    message: 'Budget deleted successfully',
    data: null,
  });
});
