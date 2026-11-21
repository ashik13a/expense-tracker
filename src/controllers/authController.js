import * as authService from '../services/authService.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const register = asyncHandler(async (req, res) => {
  const data = await authService.registerUser(req.body);
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Account created successfully',
    data,
  });
});

export const login = asyncHandler(async (req, res) => {
  const data = await authService.loginUser(req.body);
  return sendSuccess(res, {
    statusCode: 200,
    message: 'Logged in successfully',
    data,
  });
});

export const logout = asyncHandler(async (_req, res) => {
  return sendSuccess(res, {
    statusCode: 200,
    message: 'Logged out successfully',
    data: null,
  });
});

export const getMe = asyncHandler(async (req, res) => {
  return sendSuccess(res, {
    statusCode: 200,
    message: 'User profile retrieved',
    data: { user: req.user },
  });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const user = await authService.updateUserProfile(req.user._id, req.body);
  return sendSuccess(res, {
    statusCode: 200,
    message: 'Profile updated successfully',
    data: { user },
  });
});
