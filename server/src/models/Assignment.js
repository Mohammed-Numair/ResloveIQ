import mongoose from 'mongoose';

export const ASSIGNMENT_STATUSES = {
  ASSIGNED: 'ASSIGNED',
  REASSIGNED: 'REASSIGNED',
  UNASSIGNED: 'UNASSIGNED',
};

const assignmentSchema = new mongoose.Schema(
  {
    ticket: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ticket',
      required: true,
      index: true,
    },
    ticketId: {
      type: String,
      index: true,
    },
    agent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    agentName: {
      type: String,
      default: 'Unassigned',
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    assignedByName: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(ASSIGNMENT_STATUSES),
      default: ASSIGNMENT_STATUSES.ASSIGNED,
    },
    assignedAt: {
      type: Date,
      default: Date.now,
    },
    unassignedAt: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

const Assignment = mongoose.model('Assignment', assignmentSchema);

export default Assignment;
