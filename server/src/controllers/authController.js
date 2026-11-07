import mongoose from 'mongoose';
import User, { USER_ROLES } from '../models/User.js';
import generateToken from '../utils/generateToken.js';
import { seedDemoAccounts, DEMO_ACCOUNTS } from '../utils/seedData.js';

/**
 * Check if the MongoDB connection is alive
 */
const isDbConnected = () => {
  return mongoose.connection.readyState === 1;
};

/**
 * @desc    Seed demo accounts for evaluation
 * @route   POST /api/auth/seed
 * @access  Public
 */
export const seedAccounts = async (req, res, next) => {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({
        success: false,
        message: 'Database connection unavailable.',
      });
    }

    const results = await seedDemoAccounts();
    return res.status(200).json({
      success: true,
      message: 'Demo accounts verified/seeded successfully.',
      results,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get list of demo credentials for UI test assistance
 * @route   GET /api/auth/demo-accounts
 * @access  Public
 */
export const getDemoAccountsList = (req, res) => {
  const accounts = DEMO_ACCOUNTS.map((a) => ({
    name: a.name,
    email: a.email,
    role: a.role,
  }));
  return res.status(200).json({
    success: true,
    accounts,
  });
};

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 */
export const registerUser = async (req, res, next) => {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({
        success: false,
        message: 'Database is currently not connected. Please verify your MongoDB Atlas connection in server/.env.',
      });
    }

    const { name, email, password, role } = req.body;

    // Field presence validation
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: name, email, and password.',
      });
    }

    // Email format validation
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.',
      });
    }

    // Password length validation
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.',
      });
    }

    // Security Rule: Public registration always forces CUSTOMER role.
    // Staff roles (ADMIN, SUPPORT_MANAGER, SUPPORT_AGENT) can only be created by Admins or seed data.
    const assignedRole = USER_ROLES.CUSTOMER;

    // Check if user already exists
    const userExists = await User.findOne({ email: email.toLowerCase().trim() });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'A user with this email address already exists.',
      });
    }

    // Create new user (password is automatically hashed by Mongoose pre-save hook)
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role: assignedRole,
    });

    const token = generateToken(user._id);

    return res.status(201).json({
      success: true,
      message: 'User registered successfully.',
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Authenticate user & get token (Login)
 * @route   POST /api/auth/login
 * @access  Public
 */
export const loginUser = async (req, res, next) => {
  try {
    if (!isDbConnected()) {
      return res.status(503).json({
        success: false,
        message: 'Database is currently not connected. Please verify your MongoDB Atlas connection in server/.env.',
      });
    }

    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password.',
      });
    }

    // Find user by email and explicitly select password field
    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // Verify password match using bcrypt
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const token = generateToken(user._id);

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get current logged in user's profile
 * @route   GET /api/auth/me
 * @access  Private (Requires JWT token)
 */
export const getUserProfile = async (req, res) => {
  return res.status(200).json({
    success: true,
    user: {
      _id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      createdAt: req.user.createdAt,
      updatedAt: req.user.updatedAt,
    },
  });
};

