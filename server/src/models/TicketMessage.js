import mongoose from 'mongoose';

const attachmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    url: { type: String, required: true },
    fileType: { type: String, default: 'image/png' },
    size: { type: Number, default: 0 },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const ticketMessageSchema = new mongoose.Schema(
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
      default: false,
    },
    attachments: [attachmentSchema],
  },
  {
    timestamps: true,
  }
);

const TicketMessage = mongoose.model('TicketMessage', ticketMessageSchema);

export default TicketMessage;
