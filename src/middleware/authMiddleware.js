import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { verifyToken } from '../utils/jwt.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const requireAuth = asyncHandler(async (req, _res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError('Authentication required', 401);
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    throw new AppError('Authentication required', 401);
  }

  let decoded;
  try {
    decoded = verifyToken(token);
  } catch {
    throw new AppError('Invalid or expired authentication token', 401);
  }

  const user = await User.findById(decoded.sub);
  if (!user) {
    throw new AppError('User account no longer exists', 401);
  }

  req.user = user;
  next();
});
