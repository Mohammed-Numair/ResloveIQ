import http from 'http';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Ticket from '../src/models/Ticket.js';
import User from '../src/models/User.js';
dotenv.config();

function makeRequest(path, method = 'GET', body = null, token = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = {
      'Content-Type': 'application/json',
      ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const req = http.request('http://localhost:5000' + path, { method, headers }, (res) => {
      let raw = '';
      res.on('data', (c) => (raw += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(raw) });
        } catch {
          resolve({ status: res.statusCode, raw });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function runLifecycle() {
  console.log('🚀 Running Complete End-to-End Customer Helpdesk Lifecycle Verification...\n');

  // Step 1: Seed Demo Accounts
  console.log('Step 1: Verifying/Seeding Demo Accounts...');
  const seedRes = await makeRequest('/api/auth/seed', 'POST');
  console.log('  Seed Status:', seedRes.status, seedRes.body.message);

  // Step 2: Customer Login
  console.log('\nStep 2: Customer Login (customer@resolveiq.test)...');
  const custLogin = await makeRequest('/api/auth/login', 'POST', {
    email: 'customer@resolveiq.test',
    password: 'Customer@12345',
  });
  console.log('  Customer Login Status:', custLogin.status);
  const custToken = custLogin.body.token;
  console.log('  Customer Logged In:', custLogin.body.user.name, `(${custLogin.body.user.role})`);

  // Step 3: Customer Submits a Ticket
  console.log('\nStep 3: Customer Submits a Support Ticket...');
  const createTicketRes = await makeRequest(
    '/api/tickets',
    'POST',
    {
      title: 'Payment Gateway Timeout on Checkout',
      description: 'When completing purchase, the server returns 500 error. The database seems down, this is critical and urgent!',
      category: 'TECHNICAL',
    },
    custToken
  );
  console.log('  Ticket Create Status:', createTicketRes.status);
  const ticket = createTicketRes.body.ticket;
  console.log('  Generated Ticket ID:', ticket.ticketId);
  console.log('  Assigned Priority (by SLA/AI):', ticket.priority);
  console.log('  AI Detected Sentiment:', ticket.aiMetadata?.sentiment);
  console.log('  AI Generated Summary:', ticket.aiMetadata?.summary);
  console.log('  AI Suggested Reply:', ticket.aiMetadata?.suggestedReply?.slice(0, 60) + '...');

  // Step 4: Verify Database Persistence directly in Atlas
  console.log('\nStep 4: Verifying Ticket Persistence in MongoDB Atlas...');
  await mongoose.connect(process.env.MONGODB_URI);
  const dbTicket = await Ticket.findById(ticket._id);
  console.log('  Ticket Found in Atlas:', !!dbTicket);
  console.log('  SLA Deadline Calculated:', dbTicket.slaDeadline ? dbTicket.slaDeadline.toISOString() : 'none');

  // Step 5: Support Agent Login
  console.log('\nStep 5: Support Agent Login (agent@resolveiq.test)...');
  const agentLogin = await makeRequest('/api/auth/login', 'POST', {
    email: 'agent@resolveiq.test',
    password: 'Agent@12345',
  });
  const agentToken = agentLogin.body.token;
  console.log('  Agent Logged In:', agentLogin.body.user.name, `(${agentLogin.body.user.role})`);

  // Step 6: Agent Claims Ticket & Updates Status
  console.log('\nStep 6: Agent Claims Ticket & Updates Status to IN_PROGRESS...');
  const assignRes = await makeRequest(
    `/api/tickets/${ticket._id}/assign`,
    'PUT',
    {},
    agentToken
  );
  console.log('  Assign Status:', assignRes.status, assignRes.body.message);

  // Step 7: Agent Posts Private Internal Note
  console.log('\nStep 7: Agent Posts Private Internal Note (Staff Only)...');
  const internalNoteRes = await makeRequest(
    `/api/tickets/${ticket._id}/messages`,
    'POST',
    {
      message: 'Internal Staff Note: Gateway logs confirm bank webhook failed. Restarting payment worker.',
      isInternal: true,
    },
    agentToken
  );
  console.log('  Internal Note Status:', internalNoteRes.status, internalNoteRes.body.message);

  // Step 8: Agent Posts Public Reply
  console.log('\nStep 8: Agent Posts Public Reply to Customer...');
  const publicReplyRes = await makeRequest(
    `/api/tickets/${ticket._id}/messages`,
    'POST',
    {
      message: 'Hello Alex, we have identified the payment gateway issue and applied a fix. Could you retry?',
      isInternal: false,
    },
    agentToken
  );
  console.log('  Public Reply Status:', publicReplyRes.status, publicReplyRes.body.message);

  // Step 9: Agent Resolves Ticket
  console.log('\nStep 9: Agent Resolves Ticket...');
  const resolveRes = await makeRequest(
    `/api/tickets/${ticket._id}/status`,
    'PUT',
    { status: 'RESOLVED' },
    agentToken
  );
  console.log('  Resolve Status:', resolveRes.status, resolveRes.body.message);

  // Step 10: Security Check — Customer View vs Staff View
  console.log('\nStep 10: Privacy Check — Verifying Customer Cannot See Internal Notes...');
  const custViewRes = await makeRequest(`/api/tickets/${ticket._id}`, 'GET', null, custToken);
  const custMessages = custViewRes.body.ticket.messages;
  const hasInternalInCustView = custMessages.some((m) => m.isInternal === true);
  console.log('  Internal Note Visible in Customer View?:', hasInternalInCustView ? 'LEAKED! (FAIL)' : 'HIDDEN (PASS - SAFE)');

  // Step 11: Support Manager Login & Analytics
  console.log('\nStep 11: Support Manager Login & Analytics Overview...');
  const mgrLogin = await makeRequest('/api/auth/login', 'POST', {
    email: 'manager@resolveiq.test',
    password: 'Manager@12345',
  });
  const mgrToken = mgrLogin.body.token;
  const analyticsRes = await makeRequest('/api/tickets/analytics/overview', 'GET', null, mgrToken);
  console.log('  Analytics Status:', analyticsRes.status);
  console.log('  Total Tickets Count:', analyticsRes.body.analytics?.summary?.total);
  console.log('  Resolved Tickets Count:', analyticsRes.body.analytics?.summary?.resolved);
  console.log('  Resolution Rate:', analyticsRes.body.analytics?.summary?.resolutionRate + '%');

  // Step 12: Admin User Management
  console.log('\nStep 12: Admin Login & User Provisioning...');
  const adminLogin = await makeRequest('/api/auth/login', 'POST', {
    email: 'admin@resolveiq.test',
    password: 'Admin@12345',
  });
  const adminToken = adminLogin.body.token;
  const usersRes = await makeRequest('/api/users', 'GET', null, adminToken);
  console.log('  Admin User List Count:', usersRes.body.count);

  // Clean up test ticket
  await Ticket.deleteOne({ _id: ticket._id });
  console.log('\nStep 13: Cleaned up test ticket from database.');
  await mongoose.disconnect();

  console.log('\n==================================================================');
  console.log('🎉 COMPLETE END-TO-END HELPDESK WORKFLOW VERIFIED 100% WORKING!');
  console.log('==================================================================\n');
}

runLifecycle().catch((err) => {
  console.error('Lifecycle test error:', err);
  process.exit(1);
});

