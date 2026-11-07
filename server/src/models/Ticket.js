import mongoose from 'mongoose';

export const TICKET_CATEGORIES = {
  TECHNICAL: 'TECHNICAL',
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
      default: false, // Internal notes visible ONLY to staff (AGENT, MANAGER, ADMIN)
    },
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

const ticketSchema = new mongoose.Schema(
  {
    ticketId: {
      type: String,
      unique: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Please provide a ticket title'],
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters'],
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

// Auto-generate unique ticketId (e.g. TIK-84729) & calculate SLA deadline before initial save
ticketSchema.pre('save', function (next) {
  if (this.isNew) {
    if (!this.ticketId) {
      const randomSuffix = Math.floor(10000 + Math.random() * 90000);
      this.ticketId = `TIK-${randomSuffix}`;
    }

    const slaHours = SLA_HOURS_MAP[this.priority] || 24;
    this.slaHours = slaHours;
    this.slaDeadline = new Date(Date.now() + slaHours * 60 * 60 * 1000);

    // Initial activity log entry
    this.activityLog.push({
      action: 'TICKET_CREATED',
      performedBy: 'System',
      details: `Ticket created with ${this.priority} priority and ${slaHours}h SLA.`,
      timestamp: new Date(),
    });
  }
  next();
});

const Ticket = mongoose.model('Ticket', ticketSchema);

export default Ticket;

