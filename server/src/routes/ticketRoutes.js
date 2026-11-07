import express from 'express';
import {
  createTicket,
  getTickets,
  getTicketById,
  updateTicketStatus,
  assignTicket,
  addTicketMessage,
  rateTicket,
  reopenTicket,
  escalateTicket,
  lookupTicketByCallPin,
  setViewerPresence,
  getTicketAnalytics,
  exportTicketsCSV,
} from '../controllers/ticketController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { USER_ROLES } from '../models/User.js';

const router = express.Router();

// Specific routes before param :id
router.get(
  '/analytics/overview',
  protect,
  authorize(USER_ROLES.SUPPORT_MANAGER, USER_ROLES.ADMIN),
  getTicketAnalytics
);

router.get(
  '/export/csv',
  protect,
  authorize(USER_ROLES.SUPPORT_MANAGER, USER_ROLES.ADMIN),
  exportTicketsCSV
);

// Telephony IVR lookup by Call PIN (can be called by customer or automated phone interface)
router.get('/lookup/pin/:pin', lookupTicketByCallPin);

// General ticket list and creation
router.route('/')
  .post(protect, createTicket)
  .get(protect, getTickets);

// Single ticket operations
router.route('/:id')
  .get(protect, getTicketById);

router.put(
  '/:id/status',
  protect,
  authorize(USER_ROLES.SUPPORT_AGENT, USER_ROLES.SUPPORT_MANAGER, USER_ROLES.ADMIN),
  updateTicketStatus
);

router.put(
  '/:id/assign',
  protect,
  authorize(USER_ROLES.SUPPORT_AGENT, USER_ROLES.SUPPORT_MANAGER, USER_ROLES.ADMIN),
  assignTicket
);

router.post(
  '/:id/messages',
  protect,
  addTicketMessage
);

router.put(
  '/:id/rate',
  protect,
  rateTicket
);

router.put(
  '/:id/reopen',
  protect,
  reopenTicket
);

router.put(
  '/:id/escalate',
  protect,
  authorize(USER_ROLES.SUPPORT_AGENT, USER_ROLES.SUPPORT_MANAGER, USER_ROLES.ADMIN),
  escalateTicket
);

router.post(
  '/:id/viewing',
  protect,
  setViewerPresence
);

export default router;
