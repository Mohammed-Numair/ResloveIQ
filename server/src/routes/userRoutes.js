import express from 'express';
import {
  getAllUsers,
  getSupportAgents,
  createStaffUser,
  updateUserRole,
} from '../controllers/userController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { USER_ROLES } from '../models/User.js';

const router = express.Router();

router.get('/agents', protect, getSupportAgents);
router.get('/', protect, authorize(USER_ROLES.SUPPORT_MANAGER, USER_ROLES.ADMIN), getAllUsers);
router.post('/staff', protect, authorize(USER_ROLES.ADMIN), createStaffUser);
router.put('/:id/role', protect, authorize(USER_ROLES.ADMIN), updateUserRole);

export default router;

