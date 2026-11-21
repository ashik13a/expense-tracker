import { Router } from 'express';
import * as analyticsController from '../controllers/analyticsController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { analyticsQuerySchema, analyticsSummaryQuerySchema } from '../utils/validators.js';

const router = Router();

router.use(requireAuth);

router.get(
  '/summary',
  validate(analyticsSummaryQuerySchema, 'query'),
  analyticsController.getSummary
);
router.get(
  '/category',
  validate(analyticsQuerySchema, 'query'),
  analyticsController.getCategoryBreakdown
);
router.get('/trend', validate(analyticsQuerySchema, 'query'), analyticsController.getTrend);

export default router;
