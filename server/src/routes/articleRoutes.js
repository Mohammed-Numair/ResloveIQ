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

// Single article detail and feedback
router.get('/:id', optionalProtect, getArticleById);
router.post('/:id/feedback', submitArticleFeedback);

// Manager and Admin article authoring & management
router.post('/', protect, authorize('SUPPORT_MANAGER', 'ADMIN'), createArticle);
router.put('/:id', protect, authorize('SUPPORT_MANAGER', 'ADMIN'), updateArticle);
router.delete('/:id', protect, authorize('SUPPORT_MANAGER', 'ADMIN'), deleteArticle);

export default router;
