import express from 'express';
import { getArticles, getSuggestedArticles, seedArticles } from '../controllers/articleController.js';

const router = express.Router();

router.get('/', getArticles);
router.get('/suggestions', getSuggestedArticles);
router.post('/seed', seedArticles);

export default router;

