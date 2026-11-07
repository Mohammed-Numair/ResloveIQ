import mongoose from 'mongoose';

export const TICKET_CATEGORIES = {
  TECHNICAL: 'TECHNICAL',
  PAYMENTS_UPI: 'PAYMENTS_UPI',
  BILLING: 'BILLING',
  ACCOUNT: 'ACCOUNT',
  GENERAL: 'GENERAL',
};

export const TICKET_PRIORITIES = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
};

export const TICKET_STATUSES = {
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  PENDING_CUSTOMER: 'PENDING_CUSTOMER',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
};

// SLA Target Hours by Priority
export const SLA_HOURS_MAP = {
  [TICKET_PRIORITIES.URGENT]: 4,
  [TICKET_PRIORITIES.HIGH]: 12,
  [TICKET_PRIORITIES.MEDIUM]: 24,
  [TICKET_PRIORITIES.LOW]: 48,
};

const attachmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    url: { type: String, required: true }, // Base64 data URI or public asset URL
    fileType: { type: String, default: 'image/png' },
    size: { type: Number, default: 0 },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    senderName: {
      type: String,
      required: true,
    },
    senderRole: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: [true, 'Message text is required'],
      trim: true,
    },
    isInternal: {
      type: Boolean,
      default: false, // Private internal note visible ONLY to staff
    },
    attachments: [attachmentSchema],
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const activityLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
    },
    performedBy: {
      type: String,
      required: true,
    },
    details: {
      type: String,
      default: '',
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const activeViewerSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userName: String,
    userRole: String,
    lastSeen: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ticketSchema = new mongoose.Schema(
  {
    ticketId: {
      type: String,
      unique: true,
      index: true,
    },
    callPin: {
      type: String, // 6-digit PIN for Phone / Voice IVR Simulation
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Please provide a ticket title'],
      trim: true,
      maxlength: [120, 'Title cannot exceed 120 characters'],
    },
    description: {
      type: String,
      required: [true, 'Please provide a detailed description'],
      trim: true,
    },
    category: {
      type: String,
      enum: Object.values(TICKET_CATEGORIES),
      default: TICKET_CATEGORIES.GENERAL,
    },
    categoryRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
    },
    priority: {
      type: String,
      enum: Object.values(TICKET_PRIORITIES),
      default: TICKET_PRIORITIES.MEDIUM,
    },
    status: {
      type: String,
      enum: Object.values(TICKET_STATUSES),
      default: TICKET_STATUSES.OPEN,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    attachments: [attachmentSchema],
    slaHours: {
      type: Number,
      default: 24,
    },
    slaDeadline: {
      type: Date,
    },
    isSlaBreached: {
      type: Boolean,
      default: false,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    // Escalation details
    escalated: {
      isEscalated: { type: Boolean, default: false },
      escalatedAt: { type: Date, default: null },
      escalationReason: { type: String, default: '' },
      escalatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    },
    // Customer Satisfaction (CSAT) Rating
    satisfactionRating: {
      score: { type: Number, min: 1, max: 5, default: null },
      comment: { type: String, default: '' },
      submittedAt: { type: Date, default: null },
    },
    // Reopen Tracking
    reopened: {
      isReopened: { type: Boolean, default: false },
      reopenedAt: { type: Date, default: null },
      reopenCount: { type: Number, default: 0 },
      reopenReason: { type: String, default: '' },
    },
    // Active Ticket Collision Awareness (who is looking at this ticket)
    activeViewers: [activeViewerSchema],
    // Intelligent Helpdesk Metadata (Phase 5)
    aiMetadata: {
      sentiment: {
        type: String,
        enum: ['FRUSTRATED', 'URGENT', 'NEUTRAL', 'POSITIVE'],
        default: 'NEUTRAL',
      },
      summary: {
        type: String,
        default: '',
      },
      suggestedCategory: {
        type: String,
        default: '',
      },
      suggestedPriority: {
        type: String,
        default: '',
      },
      suggestedReply: {
        type: String,
        default: '',
      },
      keyTopics: {
        type: [String],
        default: [],
      },
      isSensitive: {
        type: Boolean,
        default: false,
      },
      source: {
        type: String,
        enum: ['GEMINI_AI', 'INTELLIGENT_ENGINE_FALLBACK'],
        default: 'INTELLIGENT_ENGINE_FALLBACK',
      },
    },
    messages: [messageSchema],
    activityLog: [activityLogSchema],
  },
  {
    timestamps: true,
  }
);

// Auto-generate unique ticketId (e.g. TIK-84729), Call PIN (6 digits), & calculate SLA deadline before initial save
ticketSchema.pre('save', function (next) {
  if (this.isNew) {
    if (!this.ticketId) {
      const randomSuffix = Math.floor(10000 + Math.random() * 90000);
      this.ticketId = `TIK-${randomSuffix}`;
    }

    if (!this.callPin) {
      // Generate 6-digit random Call PIN
      this.callPin = Math.floor(100000 + Math.random() * 900000).toString();
    }

    const slaHours = SLA_HOURS_MAP[this.priority] || 24;
    this.slaHours = slaHours;
    this.slaDeadline = new Date(Date.now() + slaHours * 60 * 60 * 1000);

    // Initial activity log entry
    this.activityLog.push({
      action: 'TICKET_CREATED',
      performedBy: 'System',
      details: `Ticket created with ${this.priority} priority, Call PIN: ${this.callPin}, and ${slaHours}h SLA target.`,
      timestamp: new Date(),
    });
  }
  next();
});

const Ticket = mongoose.model('Ticket', ticketSchema);

export default Ticket;
