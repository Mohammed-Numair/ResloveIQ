import User, { USER_ROLES } from '../models/User.js';

/**
 * @desc    Get all users (Admin & Manager)
 * @route   GET /api/users
 * @access  Private (MANAGER, ADMIN)
 */
export const getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find({}).select('-password').sort({ createdAt: -1 });
    return res.status(200).json({
      success: true,
      count: users.length,
      users,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all support staff for assignment dropdowns
 * @route   GET /api/users/agents
 * @access  Private (AGENT, MANAGER, ADMIN)
 */
export const getSupportAgents = async (req, res, next) => {
  try {
    const agents = await User.find({
      role: { $in: [USER_ROLES.SUPPORT_AGENT, USER_ROLES.SUPPORT_MANAGER, USER_ROLES.ADMIN] },
    })
      .select('_id name email role')
      .sort({ name: 1 });

    return res.status(200).json({
      success: true,
      count: agents.length,
      agents,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create new staff account (Admin only)
 * @route   POST /api/users/staff
 * @access  Private (ADMIN)
 */
export const createStaffUser = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, password, and staff role.',
      });
    }

    if (![USER_ROLES.SUPPORT_AGENT, USER_ROLES.SUPPORT_MANAGER, USER_ROLES.ADMIN].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid staff role. Allowed: SUPPORT_AGENT, SUPPORT_MANAGER, ADMIN',
      });
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'A user with this email already exists.',
      });
    }

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role,
    });

    return res.status(201).json({
      success: true,
      message: `Staff member ${name} (${role}) created successfully.`,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update user role (Admin only)
 * @route   PUT /api/users/:id/role
 * @access  Private (ADMIN)
 */
export const updateUserRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!Object.values(USER_ROLES).includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role specified.',
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    user.role = role;
    await user.save();

    return res.status(200).json({
      success: true,
      message: `User ${user.name} role updated to ${role}.`,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

