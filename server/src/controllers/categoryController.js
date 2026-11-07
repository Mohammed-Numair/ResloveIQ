import Category, { DEFAULT_CATEGORIES } from '../models/Category.js';

/**
 * Seed categories if not already present
 */
export const seedCategories = async () => {
  try {
    for (const cat of DEFAULT_CATEGORIES) {
      const exists = await Category.findOne({ slug: cat.slug });
      if (!exists) {
        await Category.create(cat);
      }
    }
  } catch (error) {
    console.warn('Auto-seeding categories skipped:', error.message);
  }
};

/**
 * @desc    Get all active categories with troubleshooting guides & policy types
 * @route   GET /api/categories
 * @access  Public / Private
 */
export const getCategories = async (req, res, next) => {
  try {
    const categories = await Category.find({ isActive: true }).sort({ name: 1 });
    return res.status(200).json({
      success: true,
      count: categories.length,
      categories,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get category by slug
 * @route   GET /api/categories/:slug
 * @access  Public / Private
 */
export const getCategoryBySlug = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const category = await Category.findOne({ slug: slug.toUpperCase(), isActive: true });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found.',
      });
    }

    return res.status(200).json({
      success: true,
      category,
    });
  } catch (error) {
    next(error);
  }
};

