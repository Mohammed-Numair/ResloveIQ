import Article, { DEFAULT_ARTICLES } from '../models/Article.js';
import { findSuggestedArticles } from '../utils/intelligentEngine.js';

export const getArticles = async (req, res, next) => {
  try {
    const { category, search } = req.query;
    let query = {};
    if (category) query.category = category;
    if (search) {
      query.$or = [
        { title: new RegExp(search, 'i') },
        { content: new RegExp(search, 'i') },
        { keywords: new RegExp(search, 'i') },
      ];
    }
    const articles = await Article.find(query).sort({ viewCount: -1 });
    return res.status(200).json({ success: true, count: articles.length, articles });
  } catch (error) {
    next(error);
  }
};

export const getSuggestedArticles = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || !q.trim()) {
      return res.status(200).json({ success: true, suggestions: [] });
    }
    const suggestions = await findSuggestedArticles(q);
    return res.status(200).json({ success: true, suggestions });
  } catch (error) {
    next(error);
  }
};

export const seedArticles = async (req, res, next) => {
  try {
    for (const art of DEFAULT_ARTICLES) {
      const exists = await Article.findOne({ title: art.title });
      if (!exists) {
        await Article.create(art);
      }
    }
    return res.status(200).json({ success: true, message: 'Default articles verified/seeded.' });
  } catch (error) {
    next(error);
  }
};

