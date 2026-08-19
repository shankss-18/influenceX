import { Router } from 'express';
import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/category.controller';
import { requireAuth } from '../middleware/requireAuth';
import { requireRole } from '../middleware/requireRole';

const router = Router();

// Public / Authenticated read
router.get('/', listCategories);

// Admin-only management
router.post('/', requireAuth, requireRole('ADMIN'), createCategory);
router.patch('/:id', requireAuth, requireRole('ADMIN'), updateCategory);
router.delete('/:id', requireAuth, requireRole('ADMIN'), deleteCategory);

export default router;
