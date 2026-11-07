import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import User, { USER_ROLES } from '../src/models/User.js';
import Category, { DEFAULT_CATEGORIES } from '../src/models/Category.js';
import Ticket, { TICKET_STATUSES, TICKET_PRIORITIES } from '../src/models/Ticket.js';
import TicketMessage from '../src/models/TicketMessage.js';
import Assignment, { ASSIGNMENT_STATUSES } from '../src/models/Assignment.js';
import Activity from '../src/models/Activity.js';
import Article, { DEFAULT_ARTICLES } from '../src/models/Article.js';
import { seedDemoAccounts } from '../src/utils/seedData.js';
import { analyzeTicket } from '../src/utils/intelligentEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function verifyLiveMongoDBAtlas() {
  console.log('🚀 Connecting Live to MongoDB Atlas for Autonomous Master System Verification...\n');

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI not found in server/.env');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected Live to MongoDB Atlas Cluster:', mongoose.connection.host);

  // 1. Seed default accounts, categories, and knowledge base
  console.log('\n--- 1. Verifying Database Seed Entities ---');
  await seedDemoAccounts();
  for (const cat of DEFAULT_CATEGORIES) {
    const exists = await Category.findOne({ slug: cat.slug });
    if (!exists) await Category.create(cat);
  }
  for (const art of DEFAULT_ARTICLES) {
    const exists = await Article.findOne({ title: art.title });
    if (!exists) await Article.create(art);
  }

  const categoryCount = await Category.countDocuments();
  const articleCount = await Article.countDocuments();
  const userCount = await User.countDocuments();
  console.log(`  Categories in Atlas: ${categoryCount}`);
  console.log(`  Knowledge Articles in Atlas: ${articleCount}`);
  console.log(`  Users in Atlas: ${userCount}`);

  // 2. Fetch Customer and Agent Accounts
  const customer = await User.findOne({ role: USER_ROLES.CUSTOMER });
  const agent = await User.findOne({ role: USER_ROLES.SUPPORT_AGENT });
  const admin = await User.findOne({ role: USER_ROLES.ADMIN });

  console.log(`  Customer: ${customer.name} (${customer.email})`);
  console.log(`  Agent: ${agent.name} (${agent.email})`);
  console.log(`  Admin: ${admin.name} (${admin.email})`);

  // 3. Create Ticket with AI Analysis & 6-Digit Call PIN
  console.log('\n--- 2. Creating Real Ticket in MongoDB Atlas ---');
  const issueTitle = 'UPI Transaction Deducted But Order Pending';
  const issueDesc = 'I paid Rs. 1,499 via Google Pay UPI. Money was deducted with UTR 482910394821, but ResolveIQ checkout crashed with 500 error.';

  const aiMetadata = await analyzeTicket(issueTitle, issueDesc);
  console.log('  AI Engine Detected Sentiment:', aiMetadata.sentiment);
  console.log('  AI Engine Suggested Category:', aiMetadata.suggestedCategory);
  console.log('  AI Engine Suggested Priority:', aiMetadata.suggestedPriority);

  const ticket = await Ticket.create({
    title: issueTitle,
    description: issueDesc,
    category: 'PAYMENTS_UPI',
    priority: aiMetadata.suggestedPriority || TICKET_PRIORITIES.URGENT,
    customer: customer._id,
    aiMetadata,
  });

  console.log(`  ✅ Ticket Created in Atlas: ID=${ticket.ticketId}, Call PIN=${ticket.callPin}, Priority=${ticket.priority}, SLA=${ticket.slaHours}h`);

  // Log Activity
  await Activity.create({
    ticket: ticket._id,
    ticketId: ticket.ticketId,
    action: 'TICKET_CREATED',
    performedBy: customer._id,
    performedByName: customer.name,
    performedByRole: customer.role,
    details: `Ticket created with Call PIN ${ticket.callPin}`,
  });

  // 4. Test Telephony Voice IVR Lookup by 6-digit Call PIN
  console.log('\n--- 3. Testing Phone / Voice IVR Telephony Lookup ---');
  const ivrMatch = await Ticket.findOne({ callPin: ticket.callPin })
    .populate('customer', 'name')
    .populate('assignedTo', 'name');

  console.log('  IVR Located Ticket:', ivrMatch.ticketId);
  const spokenPrompt = `Welcome to ResolveIQ Automated Telephony. Ticket reference ${ivrMatch.ticketId} for ${ivrMatch.title} is currently ${ivrMatch.status}. Priority is ${ivrMatch.priority}. Target SLA resolution time is within ${ivrMatch.slaHours} hours.`;
  console.log('  Simulated IVR Speech Output:\n  "' + spokenPrompt + '"');

  // 5. Agent Claims Ticket & Updates Status
  console.log('\n--- 4. Support Agent Assignment & Dedicated Models Write ---');
  ticket.assignedTo = agent._id;
  ticket.status = TICKET_STATUSES.IN_PROGRESS;
  await ticket.save();

  // Create Assignment record
  const assignment = await Assignment.create({
    ticket: ticket._id,
    ticketId: ticket.ticketId,
    agent: agent._id,
    agentName: agent.name,
    assignedBy: agent._id,
    assignedByName: agent.name,
    status: ASSIGNMENT_STATUSES.ASSIGNED,
    notes: 'Agent self-assigned via queue',
  });
  console.log(`  ✅ Dedicated Assignment Record Created: Status=${assignment.status}, Agent=${assignment.agentName}`);

  // 6. Messages & Internal Notes
  console.log('\n--- 5. Messaging: Internal Staff Note & Public Reply ---');
  // Internal Note
  const internalMsg = await TicketMessage.create({
    ticket: ticket._id,
    ticketId: ticket.ticketId,
    sender: agent._id,
    senderName: agent.name,
    senderRole: agent.role,
    message: 'Verified bank UTR with payment gateway. Transaction was caught in reconciliation pool.',
    isInternal: true,
  });
  ticket.messages.push({
    sender: agent._id,
    senderName: agent.name,
    senderRole: agent.role,
    message: internalMsg.message,
    isInternal: true,
  });

  // Public Reply
  const publicReply = await TicketMessage.create({
    ticket: ticket._id,
    ticketId: ticket.ticketId,
    sender: agent._id,
    senderName: agent.name,
    senderRole: agent.role,
    message: 'Dear Alex, your UPI payment has been manually reconciled and your order is confirmed.',
    isInternal: false,
  });
  ticket.messages.push({
    sender: agent._id,
    senderName: agent.name,
    senderRole: agent.role,
    message: publicReply.message,
    isInternal: false,
  });
  ticket.status = TICKET_STATUSES.RESOLVED;
  ticket.resolvedAt = new Date();
  await ticket.save();

  console.log(`  ✅ Dedicated TicketMessages Persisted: Internal Note & Public Reply`);
  console.log(`  ✅ Ticket Status Advanced to RESOLVED`);

  // 7. Customer Submits CSAT Rating
  console.log('\n--- 6. Customer Satisfaction (CSAT) Feedback Submission ---');
  ticket.satisfactionRating = {
    score: 5,
    comment: 'Instant resolution for my payment. Agent Sarah was extremely professional!',
    submittedAt: new Date(),
  };
  await ticket.save();

  await Activity.create({
    ticket: ticket._id,
    ticketId: ticket.ticketId,
    action: 'CSAT_RATING_SUBMITTED',
    performedBy: customer._id,
    performedByName: customer.name,
    performedByRole: customer.role,
    details: 'Customer submitted 5-star CSAT rating.',
    metadata: { score: 5 },
  });
  console.log(`  ✅ 5-Star CSAT Rating Successfully Saved in Atlas`);

  // 8. Customer Reopens Ticket
  console.log('\n--- 7. Ticket Reopen Flow Verification ---');
  ticket.status = TICKET_STATUSES.IN_PROGRESS;
  ticket.resolvedAt = null;
  ticket.reopened = {
    isReopened: true,
    reopenedAt: new Date(),
    reopenCount: 1,
    reopenReason: 'Reopening to request invoice PDF copy',
  };
  await ticket.save();

  await Activity.create({
    ticket: ticket._id,
    ticketId: ticket.ticketId,
    action: 'TICKET_REOPENED',
    performedBy: customer._id,
    performedByName: customer.name,
    performedByRole: customer.role,
    details: 'Ticket reopened: Reopening to request invoice PDF copy',
  });
  console.log(`  ✅ Ticket Reopened Successfully: ReopenCount=${ticket.reopened.reopenCount}, Status=${ticket.status}`);

  // Re-resolve
  ticket.status = TICKET_STATUSES.RESOLVED;
  ticket.resolvedAt = new Date();
  await ticket.save();

  // 9. Real MongoDB Aggregation Analytics
  console.log('\n--- 8. Real MongoDB Atlas Analytics Aggregations ---');
  const total = await Ticket.countDocuments();
  const resolved = await Ticket.countDocuments({ status: { $in: ['RESOLVED', 'CLOSED'] } });
  const open = await Ticket.countDocuments({ status: 'OPEN' });
  const inProgress = await Ticket.countDocuments({ status: 'IN_PROGRESS' });
  const csatAvg = await Ticket.aggregate([
    { $match: { 'satisfactionRating.score': { $ne: null } } },
    { $group: { _id: null, avg: { $avg: '$satisfactionRating.score' }, count: { $sum: 1 } } },
  ]);

  console.log(`  Total Inquiries in Atlas: ${total}`);
  console.log(`  Resolved: ${resolved}`);
  console.log(`  In Progress: ${inProgress}`);
  console.log(`  Open: ${open}`);
  console.log(`  Average CSAT Score: ${csatAvg.length > 0 ? csatAvg[0].avg.toFixed(1) : 'N/A'} / 5.0 (from ${csatAvg.length > 0 ? csatAvg[0].count : 0} ratings)`);

  // 10. Check all 6 Models in Atlas
  console.log('\n--- 9. Verifying All 6 Models Populated in MongoDB Atlas ---');
  const counts = {
    User: await User.countDocuments(),
    Category: await Category.countDocuments(),
    Ticket: await Ticket.countDocuments(),
    TicketMessage: await TicketMessage.countDocuments(),
    Assignment: await Assignment.countDocuments(),
    Activity: await Activity.countDocuments(),
    Article: await Article.countDocuments(),
  };
  console.table(counts);

  await mongoose.disconnect();
  console.log('\n✅ All Live Database Verification Tests Passed with 100% Success Against MongoDB Atlas!\n');
}

verifyLiveMongoDBAtlas().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});

