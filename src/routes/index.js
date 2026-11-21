import { Router } from 'express';
import mongoose from 'mongoose';
import authRoutes from './authRoutes.js';
import expenseRoutes from './expenseRoutes.js';
import analyticsRoutes from './analyticsRoutes.js';
import budgetRoutes from './budgetRoutes.js';
import { sendSuccess } from '../utils/apiResponse.js';

const router = Router();

router.get('/health', (_req, res) => {
  return sendSuccess(res, {
    message: 'API is healthy',
    data: {
      status: 'ok',
      dbState: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
    },
  });
});

router.use('/auth', authRoutes);
router.use('/expenses', expenseRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/budgets', budgetRoutes);

export default router;
