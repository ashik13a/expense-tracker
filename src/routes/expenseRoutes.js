import { Router } from 'express';
import * as expenseController from '../controllers/expenseController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import {
  createExpenseSchema,
  listExpensesQuerySchema,
  updateExpenseSchema,
} from '../utils/validators.js';

const router = Router();

router.use(requireAuth);

router
  .route('/')
  .get(validate(listExpensesQuerySchema, 'query'), expenseController.listExpenses)
  .post(validate(createExpenseSchema), expenseController.createExpense);

router
  .route('/:id')
  .get(expenseController.getExpenseById)
  .patch(validate(updateExpenseSchema), expenseController.updateExpense)
  .delete(expenseController.deleteExpense);

export default router;
