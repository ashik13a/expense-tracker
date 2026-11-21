import * as analyticsService from '../services/analyticsService.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getSummary = asyncHandler(async (req, res) => {
  const data = await analyticsService.getAnalyticsSummary(req.user._id, req.query);
  return sendSuccess(res, {
    statusCode: 200,
    message: 'Analytics summary retrieved',
    data,
  });
});

export const getCategoryBreakdown = asyncHandler(async (req, res) => {
  const data = await analyticsService.getCategoryBreakdown(req.user._id, req.query);
  return sendSuccess(res, {
    statusCode: 200,
    message: 'Category breakdown retrieved',
    data,
  });
});

export const getTrend = asyncHandler(async (req, res) => {
  const data = await analyticsService.getSpendingTrend(req.user._id, req.query);
  return sendSuccess(res, {
    statusCode: 200,
    message: 'Spending trend retrieved',
    data,
  });
});
