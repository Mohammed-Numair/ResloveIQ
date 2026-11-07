import express from 'express';
import {
  getArticles,
  getArticleById,
  submitArticleFeedback,
  createArticle,
  updateArticle,
  deleteArticle,
  getSuggestedArticles,
  seedArticles,
} from '../controllers/articleController.js';
import { protect, authorize, optionalProtect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Specific routes before parametric :id
router.get('/suggestions', getSuggestedArticles);
router.post('/seed', seedArticles);

// List articles with optional auth to detect staff roles
router.get('/', optionalProtect, getArticles);

// Manager and Admin article creation
router.post('/', protect, authorize('SUPPORT_MANAGER', 'ADMIN'), createArticle);

// Article feedback routes (declared before single :id route)
// Supports /:id/feedback, /feedback/:id and /feedback for maximum routing compatibility
router.post('/:id/feedback', protect, submitArticleFeedback);
router.post('/feedback/:id', protect, submitArticleFeedback);
router.post('/feedback', protect, submitArticleFeedback);

// Single article detail and management by :id
router.get('/:id', optionalProtect, getArticleById);
router.put('/:id', protect, authorize('SUPPORT_MANAGER', 'ADMIN'), updateArticle);
router.delete('/:id', protect, authorize('SUPPORT_MANAGER', 'ADMIN'), deleteArticle);

export default router;
