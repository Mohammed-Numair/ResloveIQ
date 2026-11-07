import mongoose from 'mongoose';
import Ticket, { TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATUSES } from '../models/Ticket.js';
import User, { USER_ROLES } from '../models/User.js';
import { analyzeTicket } from '../utils/intelligentEngine.js';

/**
 * Filter internal notes out of messages for customer role
 */
const sanitizeTicketForRole = (ticket, userRole) => {
  const ticketObj = ticket.toObject ? ticket.toObject() : { ...ticket };
  if (userRole === USER_ROLES.CUSTOMER && ticketObj.messages) {
    ticketObj.messages = ticketObj.messages.filter((m) => !m.isInternal);
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
    const { title, description, category, priority } = req.body;

    if (!title || !description) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both title and description for the ticket.',
      });
    }

    // Run Intelligent Engine Analysis (Phase 5)
    const aiMetadata = await analyzeTicket(title, description);

    // Use requested priority or AI suggested priority if not specified
    const assignedPriority = priority && Object.values(TICKET_PRIORITIES).includes(priority)
      ? priority
      : aiMetadata.suggestedPriority || TICKET_PRIORITIES.MEDIUM;

    const assignedCategory = category && Object.values(TICKET_CATEGORIES).includes(category)
      ? category
      : aiMetadata.suggestedCategory || TICKET_CATEGORIES.GENERAL;

    const ticket = await Ticket.create({
      title: title.trim(),
      description: description.trim(),
      category: assignedCategory,
      priority: assignedPriority,
      customer: req.user._id,
      aiMetadata,
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
      .populate('messages.sender', 'name email role');

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
      ticket: sanitizeTicketForRole(ticket, req.user.role),
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

    ticket.activityLog.push({
      action: 'STATUS_CHANGED',
      performedBy: req.user.name,
      details: `Status updated from ${oldStatus} to ${status}.`,
      timestamp: new Date(),
    });

    await ticket.save();

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
    if (targetAgentId) {
      const agent = await User.findById(targetAgentId);
      if (!agent || agent.role === USER_ROLES.CUSTOMER) {
        return res.status(400).json({
          success: false,
          message: 'Selected user is not an authorized support staff member.',
        });
      }
      ticket.assignedTo = agent._id;
      agentName = agent.name;
    } else {
      ticket.assignedTo = null;
    }

    ticket.activityLog.push({
      action: 'AGENT_ASSIGNED',
      performedBy: req.user.name,
      details: `Ticket assigned to ${agentName}.`,
      timestamp: new Date(),
    });

    // Auto-advance to IN_PROGRESS if currently OPEN
    if (ticket.status === TICKET_STATUSES.OPEN && targetAgentId) {
      ticket.status = TICKET_STATUSES.IN_PROGRESS;
    }

    await ticket.save();

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
    const { message, isInternal } = req.body;

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
    const canPostInternal = [USER_ROLES.SUPPORT_AGENT, USER_ROLES.SUPPORT_MANAGER, USER_ROLES.ADMIN].includes(req.user.role);
    const internalNote = canPostInternal && Boolean(isInternal);

    ticket.messages.push({
      sender: req.user._id,
      senderName: req.user.name,
      senderRole: req.user.role,
      message: message.trim(),
      isInternal: internalNote,
      createdAt: new Date(),
    });

    ticket.activityLog.push({
      action: internalNote ? 'INTERNAL_NOTE_ADDED' : 'REPLY_POSTED',
      performedBy: req.user.name,
      details: internalNote ? 'Added private internal note for staff.' : 'Sent public reply.',
      timestamp: new Date(),
    });

    await ticket.save();

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
          resolutionRate: totalTickets > 0 ? Math.round(((resolvedTickets + closedTickets) / totalTickets) * 100) : 0,
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

    const header = ['Ticket ID', 'Title', 'Status', 'Priority', 'Category', 'Customer Name', 'Customer Email', 'Assigned Agent', 'SLA Breached', 'Created Date'];
    const rows = tickets.map((t) => [
      t.ticketId,
      `"${t.title.replace(/"/g, '""')}"`,
      t.status,
      t.priority,
      t.category,
      t.customer ? `"${t.customer.name}"` : 'N/A',
      t.customer ? t.customer.email : 'N/A',
      t.assignedTo ? `"${t.assignedTo.name}"` : 'Unassigned',
      t.isSlaBreached ? 'YES' : 'NO',
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

