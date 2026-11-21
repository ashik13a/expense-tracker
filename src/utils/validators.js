import { z } from 'zod';
import {
  ANALYTICS_PERIODS,
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  SORT_FIELDS,
} from '../config/constants.js';

const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
  .refine((val) => !Number.isNaN(Date.parse(`${val}T00:00:00.000Z`)), 'Invalid calendar date');

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(80, 'Name cannot exceed 80 characters'),
  email: z.string().trim().toLowerCase().email('Please provide a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password cannot exceed 128 characters')
    .regex(/[A-Za-z]/, 'Password must contain at least one letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Please provide a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const updateProfileSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Name must be at least 2 characters')
      .max(80, 'Name cannot exceed 80 characters')
      .optional(),
    currentPassword: z.string().min(1, 'Current password is required').optional(),
    newPassword: z
      .string()
      .min(8, 'New password must be at least 8 characters')
      .max(128, 'New password cannot exceed 128 characters')
      .regex(/[A-Za-z]/, 'New password must contain at least one letter')
      .regex(/[0-9]/, 'New password must contain at least one number')
      .optional(),
  })
  .refine(
    (data) => {
      if (data.newPassword && !data.currentPassword) return false;
      return true;
    },
    {
      message: 'Current password is required to set a new password',
      path: ['currentPassword'],
    }
  );

export const createExpenseSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Title cannot be empty')
    .max(120, 'Title cannot exceed 120 characters'),
  amount: z.coerce
    .number({ invalid_type_error: 'Amount must be a valid number' })
    .positive('Amount must be greater than 0')
    .max(1000000000, 'Amount is too large'),
  category: z.enum(EXPENSE_CATEGORIES, {
    errorMap: () => ({ message: 'Please select a valid category' }),
  }),
  paymentMethod: z
    .enum(PAYMENT_METHODS, {
      errorMap: () => ({ message: 'Please select a valid payment method' }),
    })
    .default('Cash'),
  expenseDate: z
    .string()
    .min(1, 'Expense date is required')
    .refine((val) => !Number.isNaN(Date.parse(val)), 'Invalid expense date'),
  note: z.string().trim().max(500, 'Note cannot exceed 500 characters').optional().default(''),
});

export const updateExpenseSchema = createExpenseSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

export const listExpensesQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  date: dateStringSchema.optional(),
  startDate: dateStringSchema.optional(),
  endDate: dateStringSchema.optional(),
  category: z.enum(EXPENSE_CATEGORIES).optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  sortBy: z.enum(SORT_FIELDS).default('expenseDate'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const analyticsSummaryQuerySchema = z.object({
  date: dateStringSchema.optional(),
});

export const analyticsQuerySchema = z.object({
  period: z.enum(ANALYTICS_PERIODS).default('monthly'),
  date: dateStringSchema.optional(),
  startDate: dateStringSchema.optional(),
  endDate: dateStringSchema.optional(),
  category: z.enum(EXPENSE_CATEGORIES).optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
});

export const createBudgetSchema = z.object({
  month: z.coerce.number().int().min(1, 'Month must be 1–12').max(12, 'Month must be 1–12'),
  year: z.coerce
    .number()
    .int()
    .min(2000, 'Year must be 2000 or later')
    .max(2100, 'Year must be 2100 or earlier'),
  amount: z.coerce
    .number({ invalid_type_error: 'Budget amount must be a valid number' })
    .min(0, 'Budget amount cannot be negative')
    .max(1000000000, 'Budget amount is too large'),
});

export const updateBudgetSchema = z.object({
  amount: z.coerce
    .number({ invalid_type_error: 'Budget amount must be a valid number' })
    .min(0, 'Budget amount cannot be negative')
    .max(1000000000, 'Budget amount is too large'),
});

export const currentBudgetQuerySchema = z.object({
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});
