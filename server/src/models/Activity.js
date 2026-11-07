import mongoose from 'mongoose';

const activitySchema = new mongoose.Schema(
  {
    ticket: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ticket',
      default: null,
      index: true,
    },
    ticketId: {
      type: String,
      default: null,
      index: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    performedByName: {
      type: String,
      required: true,
    },
    performedByRole: {
      type: String,
      default: 'SYSTEM',
    },
    details: {
      type: String,
      default: '',
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

const Activity = mongoose.model('Activity', activitySchema);

export default Activity;
