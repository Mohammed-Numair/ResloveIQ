import mongoose from 'mongoose';
import User, { USER_ROLES } from '../models/User.js';
import Ticket, { TICKET_STATUSES, TICKET_PRIORITIES, TICKET_CATEGORIES } from '../models/Ticket.js';
import TicketMessage from '../models/TicketMessage.js';
import Assignment, { ASSIGNMENT_STATUSES } from '../models/Assignment.js';
import Activity from '../models/Activity.js';

export const SAMPLE_TICKETS = [
  {
    title: 'UPI Transaction Deducted But Order Failed (500 Error)',
    description: 'I attempted to pay Rs. 1,499 via Google Pay UPI. The amount was debited from my HDFC bank account with UTR 482910394821, but ResolveIQ displayed internal server timeout.',
    category: TICKET_CATEGORIES.PAYMENTS_UPI,
    priority: TICKET_PRIORITIES.URGENT,
    status: TICKET_STATUSES.RESOLVED,
    sentiment: 'FRUSTRATED',
    summary: 'Customer debited Rs. 1,499 via UPI with UTR 482910394821 during gateway timeout.',
    suggestedReply: 'Dear Alex, we have contacted our banking gateway partner with your UTR to initiate reconciliation or reversal within 2-4 banking hours.',
    csatScore: 5,
    csatComment: 'Agent Sarah reconciled the UTR within 2 hours. Superb customer service!',
    messages: [
      { senderRole: 'CUSTOMER', name: 'Alex Rivera', isInternal: false, message: 'Please help, this was my monthly budget allocation!' },
      { senderRole: 'SUPPORT_AGENT', name: 'Sarah Connor', isInternal: true, message: 'Verified banking UTR in Razorpay dashboard. Webhook timeout caused premature order termination.' },
      { senderRole: 'SUPPORT_AGENT', name: 'Sarah Connor', isInternal: false, message: 'Dear Alex, your UPI transaction was manually reconciled and your service is active.' },
    ],
  },
  {
    title: 'Production Database Connection Timeout on Port 5000',
    description: 'Our backend cluster cannot resolve DNS SRV records for MongoDB Atlas shard. Server logs display MongooseServerSelectionError.',
    category: TICKET_CATEGORIES.TECHNICAL,
    priority: TICKET_PRIORITIES.HIGH,
    status: TICKET_STATUSES.IN_PROGRESS,
    sentiment: 'URGENT',
    summary: 'DNS resolution failure for MongoDB Atlas shard causing MongooseServerSelectionError.',
    suggestedReply: 'Please check your local DNS resolver (e.g. 8.8.8.8) and confirm outgoing port 27017 is open in your security groups.',
    messages: [
      { senderRole: 'CUSTOMER', name: 'Alex Rivera', isInternal: false, message: 'Here is the stack trace from npm dev server.' },
      { senderRole: 'SUPPORT_AGENT', name: 'Sarah Connor', isInternal: true, message: 'Suspecting local DNS cache poisoning or firewall blocking outbound port 27017.' },
    ],
  },
  {
    title: 'Request for Annual GST Tax Invoice Receipt',
    description: 'We require a formal PDF tax receipt with our company GSTIN number for the annual SaaS Enterprise subscription.',
    category: TICKET_CATEGORIES.BILLING,
    priority: TICKET_PRIORITIES.MEDIUM,
    status: TICKET_STATUSES.OPEN,
    sentiment: 'NEUTRAL',
    summary: 'Customer requests formal GST-compliant invoice PDF for enterprise subscription.',
    suggestedReply: 'Invoices can be accessed under Account Settings > Invoices, or our billing team can issue an amended PDF with your GSTIN.',
    messages: [],
  },
  {
    title: 'Two-Factor Authentication (2FA) Locked After Phone Reset',
    description: 'I recently changed phones and lost my Google Authenticator seed codes. I cannot log into my manager portal.',
    category: TICKET_CATEGORIES.ACCOUNT,
    priority: TICKET_PRIORITIES.URGENT,
    status: TICKET_STATUSES.RESOLVED,
    sentiment: 'FRUSTRATED',
    summary: 'Customer locked out due to lost 2FA authenticator seed codes during device change.',
    suggestedReply: 'For your security, we require government ID or domain DNS challenge verification before resetting 2FA.',
    csatScore: 4,
    csatComment: 'Identity check was strict but safe.',
    messages: [
      { senderRole: 'CUSTOMER', name: 'Alex Rivera', isInternal: false, message: 'Need urgent access to approve team tickets.' },
      { senderRole: 'SUPPORT_AGENT', name: 'Sarah Connor', isInternal: false, message: 'Identity confirmed via domain TXT record. 2FA has been securely reset.' },
    ],
  },
  {
    title: 'Feature Request: Dark Mode Support in Helpdesk Dashboard',
    description: 'Our support teams work night shifts and would love a native dark theme toggle in the dashboard UI.',
    category: TICKET_CATEGORIES.GENERAL,
    priority: TICKET_PRIORITIES.LOW,
    status: TICKET_STATUSES.CLOSED,
    sentiment: 'POSITIVE',
    summary: 'Feature request proposing native dark mode theme for night-shift operators.',
    suggestedReply: 'Thank you for your valuable feedback! This request has been logged with our product design team.',
    csatScore: 5,
    csatComment: 'Appreciate the swift acknowledgment.',
    messages: [],
  },
];

export const seedSampleTickets = async () => {
  try {
    const existingCount = await Ticket.countDocuments();
    if (existingCount >= 3) {
      return; // Already populated
    }

    const customer = await User.findOne({ role: USER_ROLES.CUSTOMER });
    const agent = await User.findOne({ role: USER_ROLES.SUPPORT_AGENT });
    if (!customer || !agent) return;

    for (const item of SAMPLE_TICKETS) {
      const exists = await Ticket.findOne({ title: item.title });
      if (exists) continue;

      const randomPin = Math.floor(100000 + Math.random() * 900000).toString();
      const ticket = await Ticket.create({
        title: item.title,
        description: item.description,
        category: item.category,
        priority: item.priority,
        status: item.status,
        customer: customer._id,
        callPin: randomPin,
        assignedTo: item.status !== TICKET_STATUSES.OPEN ? agent._id : null,
        resolvedAt: item.status === TICKET_STATUSES.RESOLVED || item.status === TICKET_STATUSES.CLOSED ? new Date() : null,
        satisfactionRating: item.csatScore
          ? {
              score: item.csatScore,
              comment: item.csatComment || '',
              submittedAt: new Date(),
            }
          : undefined,
        aiMetadata: {
          sentiment: item.sentiment,
          summary: item.summary,
          suggestedCategory: item.category,
          suggestedPriority: item.priority,
          suggestedReply: item.suggestedReply,
          source: 'INTELLIGENT_ENGINE_FALLBACK',
        },
      });

      // Add messages
      if (item.messages && item.messages.length > 0) {
        for (const m of item.messages) {
          const senderId = m.senderRole === 'CUSTOMER' ? customer._id : agent._id;
          const msgDoc = await TicketMessage.create({
            ticket: ticket._id,
            ticketId: ticket.ticketId,
            sender: senderId,
            senderName: m.name,
            senderRole: m.senderRole,
            message: m.message,
            isInternal: m.isInternal,
          });
          ticket.messages.push({
            sender: senderId,
            senderName: m.name,
            senderRole: m.senderRole,
            message: m.message,
            isInternal: m.isInternal,
          });
        }
        await ticket.save();
      }

      // Add Assignment record
      if (item.status !== TICKET_STATUSES.OPEN) {
        await Assignment.create({
          ticket: ticket._id,
          ticketId: ticket.ticketId,
          agent: agent._id,
          agentName: agent.name,
          assignedBy: agent._id,
          assignedByName: agent.name,
          status: ASSIGNMENT_STATUSES.ASSIGNED,
          notes: 'Auto-seeded workflow sample',
        });
      }

      // Add Activity log
      await Activity.create({
        ticket: ticket._id,
        ticketId: ticket.ticketId,
        action: 'TICKET_CREATED',
        performedBy: customer._id,
        performedByName: customer.name,
        performedByRole: customer.role,
        details: `Ticket created with Call PIN ${ticket.callPin}`,
      });
    }

    console.log('✅ Realistic sample tickets seeded for immediate analytics evaluation.');
  } catch (error) {
    console.warn('⚠️  Ticket sample seeding skipped:', error.message);
  }
};
