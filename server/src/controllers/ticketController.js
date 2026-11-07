import mongoose from 'mongoose';
import Ticket, { TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATUSES } from '../models/Ticket.js';
import User, { USER_ROLES } from '../models/User.js';
import TicketMessage from '../models/TicketMessage.js';
import Assignment, { ASSIGNMENT_STATUSES } from '../models/Assignment.js';
import Activity from '../models/Activity.js';
import { analyzeTicket } from '../utils/intelligentEngine.js';

/**
 * Sanitize ticket based on user role:
 * - Customers never see internal notes (isInternal: true)
 * - Customers must NEVER see internal ticket collision alerts, staff presence information, or internal collaboration metadata
 * - Staff members only receive collision alerts for other active staff viewers (< 2 minutes old)
 */
const sanitizeTicketForRole = (ticket, userRole, currentUserId = null) => {
  const ticketObj = ticket.toObject ? ticket.toObject() : { ...ticket };
  if (userRole === USER_ROLES.CUSTOMER) {
    if (ticketObj.messages) {
      ticketObj.messages = ticketObj.messages.filter((m) => !m.isInternal);
    }
    ticketObj.activeViewers = [];
  } else {
    if (ticketObj.activeViewers) {
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
      ticketObj.activeViewers = ticketObj.activeViewers.filter((v) => {
        const isFresh = new Date(v.lastSeen) > twoMinutesAgo;
        const isOther = currentUserId ? v.userId?.toString() !== currentUserId.toString() : true;
        const isStaff = [USER_ROLES.SUPPORT_AGENT, USER_ROLES.SUPPORT_MANAGER, USER_ROLES.ADMIN].includes(v.userRole);
        return isFresh && isOther && isStaff;
      });
    }
  }
  return ticketObj;
};

/**
 * Update SLA breached flags based on current time
 */
const updateSlaBreachStatus = async (tickets) => {
  const now = new Date();
  const updates = [];
  for (const t of tickets) {
    if (
      !t.isSlaBreached &&
      t.status !== TICKET_STATUSES.RESOLVED &&
      t.status !== TICKET_STATUSES.CLOSED &&
      t.slaDeadline &&
      now > new Date(t.slaDeadline)
    ) {
      t.isSlaBreached = true;
      updates.push(Ticket.updateOne({ _id: t._id }, { isSlaBreached: true }));
    }
  }
  if (updates.length > 0) {
    await Promise.all(updates);
  }
};

/**
 * @desc    Create a new support ticket
 * @route   POST /api/tickets
 * @access  Private (All authenticated users)
 */
export const createTicket = async (req, res, next) => {
  try {
    const { title, description, category, priority, attachments } = req.body;

    if (!title || !description) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both title and description for the ticket.',
      });
    }

    // Run Intelligent Engine Analysis
    const aiMetadata = await analyzeTicket(title, description);

    // Use requested priority or AI suggested priority if not specified
    const assignedPriority =
      priority && Object.values(TICKET_PRIORITIES).includes(priority)
        ? priority
        : aiMetadata.suggestedPriority || TICKET_PRIORITIES.MEDIUM;

    const assignedCategory =
      category && Object.values(TICKET_CATEGORIES).includes(category)
        ? category
        : aiMetadata.suggestedCategory || TICKET_CATEGORIES.GENERAL;

    const ticket = await Ticket.create({
      title: title.trim(),
      description: description.trim(),
      category: assignedCategory,
      priority: assignedPriority,
      customer: req.user._id,
      attachments: Array.isArray(attachments) ? attachments : [],
      aiMetadata,
    });

    // Populate dedicated Activity model
    await Activity.create({
      ticket: ticket._id,
      ticketId: ticket.ticketId,
      action: 'TICKET_CREATED',
      performedBy: req.user._id,
      performedByName: req.user.name,
      performedByRole: req.user.role,
      details: `Ticket created with ${assignedPriority} priority and assigned Call PIN ${ticket.callPin}.`,
      metadata: { priority: assignedPriority, category: assignedCategory },
    });

    const populatedTicket = await Ticket.findById(ticket._id)
      .populate('customer', 'name email role')
      .populate('assignedTo', 'name email role');

    return res.status(201).json({
      success: true,
      message: 'Support ticket submitted successfully.',
      ticket: sanitizeTicketForRole(populatedTicket, req.user.role),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get tickets with role-based filtering and search
 * @route   GET /api/tickets
 * @access  Private
 */
export const getTickets = async (req, res, next) => {
  try {
    const { status, priority, category, search, myQueue } = req.query;
    let query = {};

    // Role-based visibility scoping
    if (req.user.role === USER_ROLES.CUSTOMER) {
      query.customer = req.user._id;
    } else if (req.user.role === USER_ROLES.SUPPORT_AGENT && myQueue === 'true') {
      query.assignedTo = req.user._id;
    }

    // Query Filters
    if (status && Object.values(TICKET_STATUSES).includes(status)) {
      query.status = status;
    }
    if (priority && Object.values(TICKET_PRIORITIES).includes(priority)) {
      query.priority = priority;
    }
    if (category && Object.values(TICKET_CATEGORIES).includes(category)) {
      query.category = category;
    }
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { ticketId: searchRegex },
        { title: searchRegex },
        { description: searchRegex },
        { callPin: searchRegex },
      ];
    }

    const tickets = await Ticket.find(query)
      .populate('customer', 'name email role')
      .populate('assignedTo', 'name email role')
      .sort({ createdAt: -1 });

    await updateSlaBreachStatus(tickets);

    const sanitized = tickets.map((t) => sanitizeTicketForRole(t, req.user.role));

    return res.status(200).json({
      success: true,
      count: sanitized.length,
      tickets: sanitized,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get ticket by ID
 * @route   GET /api/tickets/:id
 * @access  Private
 */
export const getTicketById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const ticket = await Ticket.findById(id)
      .populate('customer', 'name email role')
      .populate('assignedTo', 'name email role')
      .populate('messages.sender', 'name email role')
      .populate('escalated.escalatedBy', 'name email role');

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found.',
      });
    }

    // Permission check: Customers can only view their own tickets
    if (
      req.user.role === USER_ROLES.CUSTOMER &&
      ticket.customer._id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not have permission to view this ticket.',
      });
    }

    return res.status(200).json({
      success: true,
      ticket: sanitizeTicketForRole(ticket, req.user.role, req.user._id),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update ticket status (Staff only)
 * @route   PUT /api/tickets/:id/status
 * @access  Private (AGENT, MANAGER, ADMIN)
 */
export const updateTicketStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !Object.values(TICKET_STATUSES).includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Allowed values: ${Object.values(TICKET_STATUSES).join(', ')}`,
      });
    }

    const ticket = await Ticket.findById(id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found.' });
    }

    const oldStatus = ticket.status;
    ticket.status = status;
    if (status === TICKET_STATUSES.RESOLVED || status === TICKET_STATUSES.CLOSED) {
      ticket.resolvedAt = new Date();
    } else {
      ticket.resolvedAt = null;
    }

    const details = `Status updated from ${oldStatus} to ${status}.`;
    ticket.activityLog.push({
      action: 'STATUS_CHANGED',
      performedBy: req.user.name,
      details,
      timestamp: new Date(),
    });

    await ticket.save();

    // Populate dedicated Activity model
    await Activity.create({
      ticket: ticket._id,
      ticketId: ticket.ticketId,
      action: 'STATUS_CHANGED',
      performedBy: req.user._id,
      performedByName: req.user.name,
      performedByRole: req.user.role,
      details,
      metadata: { oldStatus, newStatus: status },
    });

    const updated = await Ticket.findById(ticket._id)
      .populate('customer', 'name email role')
      .populate('assignedTo', 'name email role');

    return res.status(200).json({
      success: true,
      message: `Ticket status updated to ${status}.`,
      ticket: sanitizeTicketForRole(updated, req.user.role),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Assign ticket to an agent
 * @route   PUT /api/tickets/:id/assign
 * @access  Private (AGENT, MANAGER, ADMIN)
 */
export const assignTicket = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { agentId } = req.body;

    const ticket = await Ticket.findById(id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found.' });
    }

    // Support Agents can only self-assign
    let targetAgentId = agentId;
    if (req.user.role === USER_ROLES.SUPPORT_AGENT) {
      targetAgentId = req.user._id;
    }

    let agentName = 'Unassigned';
    let targetAgent = null;

    if (targetAgentId) {
      targetAgent = await User.findById(targetAgentId);
      if (!targetAgent || targetAgent.role === USER_ROLES.CUSTOMER) {
        return res.status(400).json({
          success: false,
          message: 'Selected user is not an authorized support staff member.',
        });
      }
      ticket.assignedTo = targetAgent._id;
      agentName = targetAgent.name;
    } else {
      ticket.assignedTo = null;
    }

    const details = `Ticket assigned to ${agentName}.`;
    ticket.activityLog.push({
      action: 'AGENT_ASSIGNED',
      performedBy: req.user.name,
      details,
      timestamp: new Date(),
    });

    // Auto-advance to IN_PROGRESS if currently OPEN
    if (ticket.status === TICKET_STATUSES.OPEN && targetAgentId) {
      ticket.status = TICKET_STATUSES.IN_PROGRESS;
    }

    await ticket.save();

    // Update previous open assignments for this ticket
    await Assignment.updateMany(
      { ticket: ticket._id, status: ASSIGNMENT_STATUSES.ASSIGNED },
      { status: ASSIGNMENT_STATUSES.REASSIGNED, unassignedAt: new Date() }
    );

    // Create new dedicated Assignment record if an agent is selected
    if (targetAgentId) {
      await Assignment.create({
        ticket: ticket._id,
        ticketId: ticket.ticketId,
        agent: targetAgent._id,
        agentName: targetAgent.name,
        assignedBy: req.user._id,
        assignedByName: req.user.name,
        status: ASSIGNMENT_STATUSES.ASSIGNED,
        notes: `Assigned via ${req.user.role}`,
      });
    }

    // Populate dedicated Activity model
    await Activity.create({
      ticket: ticket._id,
      ticketId: ticket.ticketId,
      action: 'AGENT_ASSIGNED',
      performedBy: req.user._id,
      performedByName: req.user.name,
      performedByRole: req.user.role,
      details,
      metadata: { agentId: targetAgentId, agentName },
    });

    const updated = await Ticket.findById(ticket._id)
      .populate('customer', 'name email role')
      .populate('assignedTo', 'name email role');

    return res.status(200).json({
      success: true,
      message: `Ticket successfully assigned to ${agentName}.`,
      ticket: sanitizeTicketForRole(updated, req.user.role),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Add public reply or internal private note
 * @route   POST /api/tickets/:id/messages
 * @access  Private
 */
export const addTicketMessage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { message, isInternal, attachments } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message text cannot be empty.',
      });
    }

    const ticket = await Ticket.findById(id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found.' });
    }

    // Customer can only post to their own ticket
    if (
      req.user.role === USER_ROLES.CUSTOMER &&
      ticket.customer.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You cannot comment on this ticket.',
      });
    }

    // Security: Only staff can post internal notes
    const canPostInternal = [
      USER_ROLES.SUPPORT_AGENT,
      USER_ROLES.SUPPORT_MANAGER,
      USER_ROLES.ADMIN,
    ].includes(req.user.role);
    const internalNote = canPostInternal && Boolean(isInternal);

    const messageAttachments = Array.isArray(attachments) ? attachments : [];

    ticket.messages.push({
      sender: req.user._id,
      senderName: req.user.name,
      senderRole: req.user.role,
      message: message.trim(),
      isInternal: internalNote,
      attachments: messageAttachments,
      createdAt: new Date(),
    });

    const action = internalNote ? 'INTERNAL_NOTE_ADDED' : 'REPLY_POSTED';
    const details = internalNote ? 'Added private internal note for staff.' : 'Sent public reply.';

    ticket.activityLog.push({
      action,
      performedBy: req.user.name,
      details,
      timestamp: new Date(),
    });

    await ticket.save();

    // Populate dedicated TicketMessage model
    await TicketMessage.create({
      ticket: ticket._id,
      ticketId: ticket.ticketId,
      sender: req.user._id,
      senderName: req.user.name,
      senderRole: req.user.role,
      message: message.trim(),
      isInternal: internalNote,
      attachments: messageAttachments,
    });

    // Populate dedicated Activity model
    await Activity.create({
      ticket: ticket._id,
      ticketId: ticket.ticketId,
      action,
      performedBy: req.user._id,
      performedByName: req.user.name,
      performedByRole: req.user.role,
      details,
      metadata: { isInternal: internalNote },
    });

    const updated = await Ticket.findById(ticket._id)
      .populate('customer', 'name email role')
      .populate('assignedTo', 'name email role')
      .populate('messages.sender', 'name email role');

    return res.status(201).json({
      success: true,
      message: internalNote ? 'Internal note added.' : 'Reply posted successfully.',
      ticket: sanitizeTicketForRole(updated, req.user.role),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Submit customer satisfaction (CSAT) rating on resolved ticket
 * @route   PUT /api/tickets/:id/rate
 * @access  Private (CUSTOMER owner only)
 */
export const rateTicket = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { score, comment } = req.body;

    const numScore = Number(score);
    if (!numScore || numScore < 1 || numScore > 5) {
      return res.status(400).json({
        success: false,
        message: 'Satisfaction score must be a number between 1 and 5 stars.',
      });
    }

    const ticket = await Ticket.findById(id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found.' });
    }

    if (ticket.customer.toString() !== req.user._id.toString() && req.user.role !== USER_ROLES.ADMIN) {
      return res.status(403).json({
        success: false,
        message: 'Only the customer who opened this ticket can submit a satisfaction rating.',
      });
    }

    if (ticket.status !== TICKET_STATUSES.RESOLVED && ticket.status !== TICKET_STATUSES.CLOSED) {
      return res.status(400).json({
        success: false,
        message: 'Satisfaction ratings can only be submitted for resolved or closed tickets.',
      });
    }

    ticket.satisfactionRating = {
      score: numScore,
      comment: (comment || '').trim(),
      submittedAt: new Date(),
    };

    const details = `Customer submitted ${numScore}-star CSAT rating.`;
    ticket.activityLog.push({
      action: 'CSAT_RATING_SUBMITTED',
      performedBy: req.user.name,
      details,
      timestamp: new Date(),
    });

    await ticket.save();

    await Activity.create({
      ticket: ticket._id,
      ticketId: ticket.ticketId,
      action: 'CSAT_RATING_SUBMITTED',
      performedBy: req.user._id,
      performedByName: req.user.name,
      performedByRole: req.user.role,
      details,
      metadata: { score: numScore, comment },
    });

    return res.status(200).json({
      success: true,
      message: 'Thank you for your feedback! Your rating has been recorded.',
      satisfactionRating: ticket.satisfactionRating,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Reopen a resolved or closed ticket
 * @route   PUT /api/tickets/:id/reopen
 * @access  Private (CUSTOMER owner or Staff)
 */
export const reopenTicket = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const ticket = await Ticket.findById(id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found.' });
    }

    if (
      req.user.role === USER_ROLES.CUSTOMER &&
      ticket.customer.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You cannot reopen this ticket.',
      });
    }

    if (ticket.status !== TICKET_STATUSES.RESOLVED && ticket.status !== TICKET_STATUSES.CLOSED) {
      return res.status(400).json({
        success: false,
        message: 'Ticket is already open or in progress.',
      });
    }

    const reopenReasonText = (reason || 'Customer indicated issue persists').trim();

    ticket.status = TICKET_STATUSES.IN_PROGRESS;
    ticket.resolvedAt = null;
    ticket.reopened = {
      isReopened: true,
      reopenedAt: new Date(),
      reopenCount: (ticket.reopened?.reopenCount || 0) + 1,
      reopenReason: reopenReasonText,
    };

    const details = `Ticket reopened: ${reopenReasonText}`;
    ticket.activityLog.push({
      action: 'TICKET_REOPENED',
      performedBy: req.user.name,
      details,
      timestamp: new Date(),
    });

    await ticket.save();

    await Activity.create({
      ticket: ticket._id,
      ticketId: ticket.ticketId,
      action: 'TICKET_REOPENED',
      performedBy: req.user._id,
      performedByName: req.user.name,
      performedByRole: req.user.role,
      details,
      metadata: { reason: reopenReasonText, count: ticket.reopened.reopenCount },
    });

    const updated = await Ticket.findById(ticket._id)
      .populate('customer', 'name email role')
      .populate('assignedTo', 'name email role');

    return res.status(200).json({
      success: true,
      message: 'Ticket has been reopened and placed back into active queue.',
      ticket: sanitizeTicketForRole(updated, req.user.role),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Escalate a ticket to priority handling
 * @route   PUT /api/tickets/:id/escalate
 * @access  Private (AGENT, MANAGER, ADMIN)
 */
export const escalateTicket = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const ticket = await Ticket.findById(id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found.' });
    }

    const escalationReasonText = (reason || 'Escalated by support personnel').trim();

    ticket.escalated = {
      isEscalated: true,
      escalatedAt: new Date(),
      escalationReason: escalationReasonText,
      escalatedBy: req.user._id,
    };
    ticket.priority = TICKET_PRIORITIES.URGENT;

    const details = `Ticket escalated to URGENT: ${escalationReasonText}`;
    ticket.activityLog.push({
      action: 'TICKET_ESCALATED',
      performedBy: req.user.name,
      details,
      timestamp: new Date(),
    });

    await ticket.save();

    await Activity.create({
      ticket: ticket._id,
      ticketId: ticket.ticketId,
      action: 'TICKET_ESCALATED',
      performedBy: req.user._id,
      performedByName: req.user.name,
      performedByRole: req.user.role,
      details,
      metadata: { reason: escalationReasonText },
    });

    const updated = await Ticket.findById(ticket._id)
      .populate('customer', 'name email role')
      .populate('assignedTo', 'name email role');

    return res.status(200).json({
      success: true,
      message: 'Ticket has been escalated to URGENT priority.',
      ticket: sanitizeTicketForRole(updated, req.user.role),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Simulate Telephone / Voice IVR lookup by 6-digit Call PIN
 * @route   GET /api/tickets/lookup/pin/:pin
 * @access  Public / Private
 */
export const lookupTicketByCallPin = async (req, res, next) => {
  try {
    const { pin } = req.params;

    if (!pin || pin.trim().length !== 6) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid 6-digit Call PIN.',
      });
    }

    const ticket = await Ticket.findOne({ callPin: pin.trim() })
      .populate('customer', 'name')
      .populate('assignedTo', 'name');

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'No ticket found matching the provided 6-digit Call PIN.',
        spokenPrompt:
          'We could not locate an active ticket for that Call PIN. Please verify your 6-digit code or hold to speak with a representative.',
      });
    }

    const agentName = ticket.assignedTo ? ticket.assignedTo.name : 'an available representative';
    const spokenPrompt = `Welcome to ResolveIQ Automated Telephony. Ticket reference ${ticket.ticketId} for ${ticket.title} is currently ${ticket.status}. Priority is ${ticket.priority}. Assigned support specialist is ${agentName}. Target SLA resolution time is within ${ticket.slaHours} hours.`;

    return res.status(200).json({
      success: true,
      ticketId: ticket.ticketId,
      callPin: ticket.callPin,
      title: ticket.title,
      status: ticket.status,
      priority: ticket.priority,
      category: ticket.category,
      assignedTo: agentName,
      customerName: ticket.customer ? ticket.customer.name : 'Valued Customer',
      createdAt: ticket.createdAt,
      spokenPrompt,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Heartbeat for active viewer collision detection
 * @route   POST /api/tickets/:id/viewing
 * @access  Private (Staff & Customers)
 */
export const setViewerPresence = async (req, res, next) => {
  try {
    const { id } = req.params;
    const ticket = await Ticket.findById(id);

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found.' });
    }

    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    // Purge stale viewers (> 2 minutes) and existing entry for current user
    ticket.activeViewers = (ticket.activeViewers || []).filter(
      (v) => new Date(v.lastSeen) > twoMinutesAgo && v.userId.toString() !== req.user._id.toString()
    );

    // Record current user's active presence
    ticket.activeViewers.push({
      userId: req.user._id,
      userName: req.user.name,
      userRole: req.user.role,
      lastSeen: new Date(),
    });

    await ticket.save();

    // 1. Customers must NEVER see internal ticket collision alerts, staff presence information, or internal collaboration metadata
    if (req.user.role === USER_ROLES.CUSTOMER) {
      return res.status(200).json({
        success: true,
        activeViewers: [],
        staffColliding: false,
      });
    }

    // 2. For staff (SUPPORT_AGENT, SUPPORT_MANAGER, ADMIN):
    // Identify OTHER support staff members actively viewing the ticket
    const otherStaffViewers = ticket.activeViewers.filter(
      (v) =>
        v.userId.toString() !== req.user._id.toString() &&
        [USER_ROLES.SUPPORT_AGENT, USER_ROLES.SUPPORT_MANAGER, USER_ROLES.ADMIN].includes(v.userRole)
    );

    // 3. Clearly distinguish CUSTOMER viewers from SUPPORT_AGENT and SUPPORT_MANAGER viewers
    const activeCustomerViewers = ticket.activeViewers.filter(
      (v) =>
        v.userId.toString() !== req.user._id.toString() &&
        v.userRole === USER_ROLES.CUSTOMER
    );

    return res.status(200).json({
      success: true,
      activeViewers: otherStaffViewers,
      staffColliding: otherStaffViewers.length > 0,
      customerViewing: activeCustomerViewers.length > 0,
      customerViewers: activeCustomerViewers.map((c) => ({
        userId: c.userId,
        userName: c.userName,
        userRole: c.userRole,
        lastSeen: c.lastSeen,
      })),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get real MongoDB analytics for Manager and Admin
 * @route   GET /api/tickets/analytics/overview
 * @access  Private (MANAGER, ADMIN)
 */
export const getTicketAnalytics = async (req, res, next) => {
  try {
    const totalTickets = await Ticket.countDocuments();
    const openTickets = await Ticket.countDocuments({ status: TICKET_STATUSES.OPEN });
    const inProgressTickets = await Ticket.countDocuments({ status: TICKET_STATUSES.IN_PROGRESS });
    const resolvedTickets = await Ticket.countDocuments({ status: TICKET_STATUSES.RESOLVED });
    const closedTickets = await Ticket.countDocuments({ status: TICKET_STATUSES.CLOSED });
    const slaBreachedTickets = await Ticket.countDocuments({ isSlaBreached: true });
    const escalatedTickets = await Ticket.countDocuments({ 'escalated.isEscalated': true });

    // Category Distribution Aggregation
    const categoryStats = await Ticket.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]);

    // Priority Distribution Aggregation
    const priorityStats = await Ticket.aggregate([
      { $group: { _id: '$priority', count: { $sum: 1 } } },
    ]);

    // Sentiment Distribution Aggregation
    const sentimentStats = await Ticket.aggregate([
      { $group: { _id: '$aiMetadata.sentiment', count: { $sum: 1 } } },
    ]);

    // Average CSAT Rating
    const csatStats = await Ticket.aggregate([
      { $match: { 'satisfactionRating.score': { $ne: null } } },
      { $group: { _id: null, avgScore: { $avg: '$satisfactionRating.score' }, totalRatings: { $sum: 1 } } },
    ]);

    // Agent Workload Aggregation
    const agentWorkload = await Ticket.aggregate([
      { $match: { assignedTo: { $ne: null }, status: { $in: ['OPEN', 'IN_PROGRESS'] } } },
      { $group: { _id: '$assignedTo', activeTickets: { $sum: 1 } } },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'agentInfo',
        },
      },
      { $unwind: '$agentInfo' },
      {
        $project: {
          _id: 1,
          name: '$agentInfo.name',
          email: '$agentInfo.email',
          role: '$agentInfo.role',
          activeTickets: 1,
        },
      },
    ]);

    return res.status(200).json({
      success: true,
      analytics: {
        summary: {
          total: totalTickets,
          open: openTickets,
          inProgress: inProgressTickets,
          resolved: resolvedTickets,
          closed: closedTickets,
          slaBreached: slaBreachedTickets,
          escalated: escalatedTickets,
          avgCsat: csatStats.length > 0 ? Math.round(csatStats[0].avgScore * 10) / 10 : 0,
          totalRatings: csatStats.length > 0 ? csatStats[0].totalRatings : 0,
          resolutionRate:
            totalTickets > 0
              ? Math.round(((resolvedTickets + closedTickets) / totalTickets) * 100)
              : 0,
        },
        categories: categoryStats,
        priorities: priorityStats,
        sentiments: sentimentStats,
        agentWorkload,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Export tickets to CSV
 * @route   GET /api/tickets/export/csv
 * @access  Private (MANAGER, ADMIN)
 */
export const exportTicketsCSV = async (req, res, next) => {
  try {
    const tickets = await Ticket.find({})
      .populate('customer', 'name email')
      .populate('assignedTo', 'name email')
      .sort({ createdAt: -1 });

    const header = [
      'Ticket ID',
      'Call PIN',
      'Title',
      'Status',
      'Priority',
      'Category',
      'Customer Name',
      'Customer Email',
      'Assigned Agent',
      'SLA Breached',
      'CSAT Score',
      'Created Date',
    ];
    const rows = tickets.map((t) => [
      t.ticketId,
      t.callPin || 'N/A',
      `"${(t.title || '').replace(/"/g, '""')}"`,
      t.status,
      t.priority,
      t.category,
      t.customer ? `"${t.customer.name}"` : 'N/A',
      t.customer ? t.customer.email : 'N/A',
      t.assignedTo ? `"${t.assignedTo.name}"` : 'Unassigned',
      t.isSlaBreached ? 'YES' : 'NO',
      t.satisfactionRating?.score || 'Not Rated',
      new Date(t.createdAt).toISOString().split('T')[0],
    ]);

    const csvContent = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=resolveiq-tickets.csv');
    return res.status(200).send(csvContent);
  } catch (error) {
    next(error);
  }
};
