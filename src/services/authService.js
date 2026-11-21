import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { signToken } from '../utils/jwt.js';

const SALT_ROUNDS = 10;

export const registerUser = async ({ name, email, password }) => {
  const existing = await User.findOne({ email });
  if (existing) {
    throw new AppError('An account with this email already exists', 409, [
      { field: 'email', message: 'Email is already registered' },
    ]);
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await User.create({ name, email, passwordHash });
  const token = signToken({ sub: user._id.toString() });

  return {
    user: user.toJSON(),
    token,
  };
};

export const loginUser = async ({ email, password }) => {
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user) {
    throw new AppError('Invalid email or password', 401);
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    throw new AppError('Invalid email or password', 401);
  }

  const token = signToken({ sub: user._id.toString() });

  return {
    user: user.toJSON(),
    token,
  };
};

export const updateUserProfile = async (userId, { name, currentPassword, newPassword }) => {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (name) {
    user.name = name;
  }

  if (newPassword) {
    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      throw new AppError('Current password is incorrect', 400, [
        { field: 'currentPassword', message: 'Current password is incorrect' },
      ]);
    }
    user.passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  }

  await user.save();
  return user.toJSON();
};
