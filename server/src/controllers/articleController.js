import mongoose from 'mongoose';
import Article, { DEFAULT_ARTICLES } from '../models/Article.js';
import { findSuggestedArticles } from '../utils/intelligentEngine.js';

const STAFF_ROLES = ['SUPPORT_MANAGER', 'ADMIN', 'SUPPORT_AGENT'];

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

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

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: `Invalid article ID format: '${id}'. Must be a valid 24-character hexadecimal ObjectId.`,
      });
    }

    // Atomically increment viewCount and retrieve document
    const article = await Article.findByIdAndUpdate(
      id,
      { $inc: { viewCount: 1 } },
      { new: true }
    );

    if (!article) {
      return res.status(404).json({
        success: false,
        message: `Knowledge article with ID '${id}' was not found.`,
      });
    }

    // Restrict unpublished articles to staff
    const isStaff = req.user && STAFF_ROLES.includes(req.user.role);
    const isPublished = !article.status || article.status === 'PUBLISHED';
    if (!isPublished && !isStaff) {
      return res.status(403).json({
        success: false,
        message: `This article is not publicly available.`,
      });
    }

    // Check if authenticated user has existing feedback record on this article
    let userFeedback = null;
    if (req.user && Array.isArray(article.feedback)) {
      const userVote = article.feedback.find(
        (f) => f.user && f.user.toString() === req.user._id.toString()
      );
      if (userVote) {
        userFeedback = userVote.helpful ? 'helpful' : 'not_helpful';
      }
    }

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
      userFeedback,
      relatedArticles,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Submit helpful / not helpful feedback for an article
 * Authenticated per user: prevents count inflation and allows vote changes
 */
export const submitArticleFeedback = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: `Invalid article ID format: '${id}'. Must be a valid 24-character hexadecimal ObjectId.`,
      });
    }

    // Accept either { helpful: boolean } or legacy { isHelpful: boolean }
    const rawHelpful =
      req.body.helpful !== undefined ? req.body.helpful : req.body.isHelpful;

    if (
      typeof rawHelpful !== 'boolean' &&
      rawHelpful !== 'true' &&
      rawHelpful !== 'false'
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Request body must contain 'helpful': boolean (true for helpful, false for not helpful).",
      });
    }

    const isHelpful = rawHelpful === true || rawHelpful === 'true';

    // Must be authenticated
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required to submit feedback.',
      });
    }

    const article = await Article.findById(id);
    if (!article) {
      return res.status(404).json({
        success: false,
        message: `Knowledge article with ID '${id}' was not found.`,
      });
    }

    // Check user accessibility: non-staff cannot submit feedback on unpublished drafts
    const isStaff = req.user && STAFF_ROLES.includes(req.user.role);
    const isPublished = !article.status || article.status === 'PUBLISHED';
    if (!isPublished && !isStaff) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not have permission to rate unpublished articles.',
      });
    }

    if (!Array.isArray(article.feedback)) {
      article.feedback = [];
    }

    // Check for existing feedback record by this user
    const existingIndex = article.feedback.findIndex(
      (f) => f.user && f.user.toString() === req.user._id.toString()
    );

    let voteAction = 'new';
    if (existingIndex > -1) {
      if (article.feedback[existingIndex].helpful === isHelpful) {
        voteAction = 'unchanged';
      } else {
        voteAction = 'updated';
        article.feedback[existingIndex].helpful = isHelpful;
        article.feedback[existingIndex].createdAt = new Date();
      }
    } else {
      article.feedback.push({
        user: req.user._id,
        helpful: isHelpful,
        createdAt: new Date(),
      });
    }

    // Recalculate persistent counts
    article.helpfulCount = article.feedback.filter((f) => f.helpful === true).length;
    article.notHelpfulCount = article.feedback.filter((f) => f.helpful === false).length;

    await article.save();

    return res.status(200).json({
      success: true,
      helpfulCount: article.helpfulCount,
      notHelpfulCount: article.notHelpfulCount,
      userFeedback: isHelpful ? 'helpful' : 'not_helpful',
      action: voteAction,
      message:
        voteAction === 'unchanged'
          ? 'Your feedback was already recorded.'
          : voteAction === 'updated'
          ? 'Your feedback has been updated.'
          : 'Thank you for rating this article!',
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

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: `Invalid article ID format: '${id}'. Must be a valid 24-character hexadecimal ObjectId.`,
      });
    }

    const { title, category, content, keywords, status } = req.body;

    const article = await Article.findById(id);
    if (!article) {
      return res.status(404).json({
        success: false,
        message: `Knowledge article with ID '${id}' was not found.`,
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

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: `Invalid article ID format: '${id}'. Must be a valid 24-character hexadecimal ObjectId.`,
      });
    }

    const article = await Article.findByIdAndDelete(id);

    if (!article) {
      return res.status(404).json({
        success: false,
        message: `Knowledge article with ID '${id}' was not found.`,
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
