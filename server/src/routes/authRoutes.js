import express from 'express';
import {
  registerUser,
  loginUser,
  getUserProfile,
  seedAccounts,
  getDemoAccountsList,
} from '../controllers/authController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { USER_ROLES } from '../models/User.js';

const router = express.Router();

// Public routes
router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/seed', seedAccounts);
router.get('/demo-accounts', getDemoAccountsList);

// Protected routes (Requires valid JWT)
router.get('/me', protect, getUserProfile);

// RBAC Protected verification endpoints (for testing role permissions)
router.get(
  '/admin-only',
  protect,
  authorize(USER_ROLES.ADMIN),
  (req, res) => {
    res.json({
      success: true,
      message: 'Access granted: Admin privileged resource.',
      user: req.user,
    });
  }
);

router.get(
  '/staff-only',
  protect,
  authorize(USER_ROLES.ADMIN, USER_ROLES.SUPPORT_MANAGER, USER_ROLES.SUPPORT_AGENT),
  (req, res) => {
    res.json({
      success: true,
      message: 'Access granted: Support staff resource.',
      user: req.user,
    });
  }
);

export default router;

