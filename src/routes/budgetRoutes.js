import { Router } from 'express';
import * as budgetController from '../controllers/budgetController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import {
  createBudgetSchema,
  currentBudgetQuerySchema,
  updateBudgetSchema,
} from '../utils/validators.js';

const router = Router();

router.use(requireAuth);

router.get(
  '/current',
  validate(currentBudgetQuerySchema, 'query'),
  budgetController.getCurrentBudget
);
router.post('/', validate(createBudgetSchema), budgetController.createBudget);
router.patch('/:id', validate(updateBudgetSchema), budgetController.updateBudget);
router.delete('/:id', budgetController.deleteBudget);

export default router;
