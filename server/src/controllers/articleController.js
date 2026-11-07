import Article, { DEFAULT_ARTICLES } from '../models/Article.js';
import { findSuggestedArticles } from '../utils/intelligentEngine.js';

const STAFF_ROLES = ['SUPPORT_MANAGER', 'ADMIN', 'SUPPORT_AGENT'];

/**
 * Fetch knowledge articles with search, category and status filtering
 * Public/Customers only see PUBLISHED articles. Staff can see all statuses.
 */
export const getArticles = async (req, res, next) => {
  try {
    const { category, search, status } = req.query;
    const filterClauses = [];

    // Role-based visibility
    const isStaff = req.user && STAFF_ROLES.includes(req.user.role);
    if (!isStaff) {
      filterClauses.push({
        $or: [
          { status: 'PUBLISHED' },
          { status: { $exists: false } },
          { status: null },
        ],
      });
    } else if (status && status !== 'ALL') {
      if (status === 'PUBLISHED') {
        filterClauses.push({
          $or: [
            { status: 'PUBLISHED' },
            { status: { $exists: false } },
            { status: null },
          ],
        });
      } else {
        filterClauses.push({ status });
      }
    }

    // Category filter
    if (category && category !== 'ALL') {
      filterClauses.push({ category });
    }

    // Search query
    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      filterClauses.push({
        $or: [
          { title: regex },
          { content: regex },
          { keywords: regex },
        ],
      });
    }

    const query = filterClauses.length > 0 ? { $and: filterClauses } : {};
    const articles = await Article.find(query).sort({ viewCount: -1, createdAt: -1 });
    return res.status(200).json({ success: true, count: articles.length, articles });
  } catch (error) {
    next(error);
  }
};

/**
 * Get article detail by ID with viewCount increment and related articles
 */
export const getArticleById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const article = await Article.findById(id);

    if (!article) {
      return res.status(404).json({
        success: false,
        message: 'Knowledge article not found.',
      });
    }

    // Restrict unpublished articles to staff
    const isStaff = req.user && STAFF_ROLES.includes(req.user.role);
    const isPublished = !article.status || article.status === 'PUBLISHED';
    if (!isPublished && !isStaff) {
      return res.status(403).json({
        success: false,
        message: 'This article is not publicly available.',
      });
    }

    // Increment viewCount atomically
    article.viewCount = (article.viewCount || 0) + 1;
    await article.save();

    // Find related articles within the same category
    const relatedArticles = await Article.find({
      _id: { $ne: article._id },
      category: article.category,
      $or: [
        { status: 'PUBLISHED' },
        { status: { $exists: false } },
        { status: null },
      ],
    })
      .select('title category viewCount helpfulCount notHelpfulCount updatedAt keywords')
      .limit(3);

    return res.status(200).json({
      success: true,
      article,
      relatedArticles,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Submit helpful / not helpful feedback for an article
 */
export const submitArticleFeedback = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isHelpful } = req.body;

    const incField =
      isHelpful === true || isHelpful === 'true' || isHelpful === 'helpful'
        ? { helpfulCount: 1 }
        : { notHelpfulCount: 1 };

    const article = await Article.findByIdAndUpdate(
      id,
      { $inc: incField },
      { new: true }
    );

    if (!article) {
      return res.status(404).json({
        success: false,
        message: 'Knowledge article not found.',
      });
    }

    return res.status(200).json({
      success: true,
      helpfulCount: article.helpfulCount,
      notHelpfulCount: article.notHelpfulCount,
      message: 'Thank you for your feedback!',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new knowledge base article (Support Manager & Admin)
 */
export const createArticle = async (req, res, next) => {
  try {
    const { title, category, content, keywords, status } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Article title is required.' });
    }
    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Article content is required.' });
    }
    if (!category) {
      return res.status(400).json({ success: false, message: 'Article category is required.' });
    }

    let parsedKeywords = [];
    if (Array.isArray(keywords)) {
      parsedKeywords = keywords.map((k) => String(k).trim()).filter(Boolean);
    } else if (typeof keywords === 'string') {
      parsedKeywords = keywords.split(',').map((k) => k.trim()).filter(Boolean);
    }

    const newArticle = await Article.create({
      title: title.trim(),
      category,
      content: content.trim(),
      keywords: parsedKeywords,
      status: status || 'PUBLISHED',
      authorName: req.user?.name || 'ResolveIQ Staff',
      createdBy: req.user?._id,
    });

    return res.status(201).json({
      success: true,
      message: 'Knowledge article created successfully.',
      article: newArticle,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update an existing knowledge base article (Support Manager & Admin)
 */
export const updateArticle = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, category, content, keywords, status } = req.body;

    const article = await Article.findById(id);
    if (!article) {
      return res.status(404).json({
        success: false,
        message: 'Knowledge article not found.',
      });
    }

    if (title !== undefined) article.title = title.trim();
    if (category !== undefined) article.category = category;
    if (content !== undefined) article.content = content.trim();
    if (status !== undefined) article.status = status;

    if (keywords !== undefined) {
      if (Array.isArray(keywords)) {
        article.keywords = keywords.map((k) => String(k).trim()).filter(Boolean);
      } else if (typeof keywords === 'string') {
        article.keywords = keywords.split(',').map((k) => k.trim()).filter(Boolean);
      }
    }

    await article.save();

    return res.status(200).json({
      success: true,
      message: 'Knowledge article updated successfully.',
      article,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a knowledge base article (Support Manager & Admin)
 */
export const deleteArticle = async (req, res, next) => {
  try {
    const { id } = req.params;
    const article = await Article.findByIdAndDelete(id);

    if (!article) {
      return res.status(404).json({
        success: false,
        message: 'Knowledge article not found.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Knowledge article deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get suggested articles for live ticket composer
 */
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

/**
 * Seed or refresh default articles
 */
export const seedArticles = async (req, res, next) => {
  try {
    await Article.updateMany(
      { status: { $exists: false } },
      { $set: { status: 'PUBLISHED' } }
    );
    for (const art of DEFAULT_ARTICLES) {
      const exists = await Article.findOne({ title: art.title });
      if (!exists) {
        await Article.create(art);
      } else if (!exists.status) {
        exists.status = 'PUBLISHED';
        await exists.save();
      }
    }
    return res.status(200).json({ success: true, message: 'Default articles verified/seeded.' });
  } catch (error) {
    next(error);
  }
};
