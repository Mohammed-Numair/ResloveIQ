/**
 * ResolveIQ Comprehensive System Audit Test Suite
 *
 * Verifies against live MongoDB Atlas:
 * 1. Database connectivity and actual data persistence in all 7 collections
 * 2. Registration and login for all 4 roles (Customer, Support Agent, Support Manager, Admin)
 * 3. Public registration role escalation prevention
 * 4. Unauthorized route access blocking (HTTP 401 & HTTP 403)
 * 5. Ticket creation, AI triage, SLA calculations, and 6-digit Call PIN generation
 * 6. Telephony Voice IVR lookup
 * 7. Ticket assignment and Assignment history model
 * 8. Public replies vs. private internal notes (role-based wire privacy)
 * 9. Ticket escalation to URGENT
 * 10. Status workflow (OPEN -> IN_PROGRESS -> RESOLVED)
 * 11. Customer CSAT feedback rating submission
 * 12. Ticket reopening lifecycle
 * 13. Active viewer collision presence heartbeat
 * 14. Real MongoDB aggregation analytics & CSV export
 * 15. Guided troubleshooting categories and policy enforcement
 */

import http from 'http';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import app from '../src/index.js';
import User, { USER_ROLES } from '../src/models/User.js';
import Category from '../src/models/Category.js';
import Ticket, { TICKET_STATUSES, TICKET_PRIORITIES } from '../src/models/Ticket.js';
import TicketMessage from '../src/models/TicketMessage.js';
import Assignment, { ASSIGNMENT_STATUSES } from '../src/models/Assignment.js';
import Activity from '../src/models/Activity.js';
import Article from '../src/models/Article.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

let server;
let serverPort = 5055;
let baseUrl;

let passedAuditCount = 0;
let failedAuditCount = 0;
const auditFailures = [];

function assertTest(condition, testName, details = '') {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedAuditCount++;
  } else {
    console.error(`  ❌ FAIL: ${testName} ${details ? `(${details})` : ''}`);
    failedAuditCount++;
    auditFailures.push({ testName, details });
  }
}

function makeApiRequest(apiPath, method = 'GET', body = null, token = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = {
      'Content-Type': 'application/json',
      ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const req = http.request(
      `${baseUrl}${apiPath}`,
      { method, headers },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(raw) });
          } catch {
            resolve({ status: res.statusCode, headers: res.headers, raw });
          }
        });
      }
    );

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runComprehensiveAudit() {
  console.log('\n===============================================================');
  console.log('🔍 RESOLVEIQ COMPREHENSIVE PRODUCTION AUDIT & VERIFICATION');
  console.log('===============================================================\n');

  // Step 1: Connect to MongoDB Atlas
  console.log('1. Connecting to MongoDB Atlas...');
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not set in server/.env');
  }
  await mongoose.connect(process.env.MONGODB_URI);
  assertTest(
    mongoose.connection.readyState === 1,
    'MongoDB Atlas connection is established and in ready state 1'
  );
  console.log(`   Connected Host: ${mongoose.connection.host}`);

  // Step 2: Start In-Process Express Server
  console.log('\n2. Starting In-Process HTTP Server for Audit Verification...');
  await new Promise((resolve) => {
    server = app.listen(serverPort, () => {
      baseUrl = `http://localhost:${serverPort}`;
      console.log(`   Audit Server listening on ${baseUrl}`);
      resolve();
    });
  });

  const timestamp = Date.now();
  const testCustomerEmail = `audit.cust.${timestamp}@resolveiq.test`;
  const testCustomerPassword = 'CustPassword@123';

  // --- SECTION 1: PUBLIC REGISTRATION & SECURITY ---
  console.log('\n--- Section 1: User Registration & Role Isolation Security ---');
  // 1.1 Valid Customer Registration
  const regRes = await makeApiRequest('/api/auth/register', 'POST', {
    name: `Audit Customer ${timestamp}`,
    email: testCustomerEmail,
    password: testCustomerPassword,
  });
  assertTest(regRes.status === 201, 'Public registration returns HTTP 201 Created');
  assertTest(regRes.body.success === true, 'Registration body confirms success: true');
  assertTest(typeof regRes.body.token === 'string', 'Registration generates and returns valid JWT token');
  assertTest(regRes.body.user.role === USER_ROLES.CUSTOMER, 'Registered user is assigned role CUSTOMER');

  // 1.2 Security Check: Attempted Privilege Escalation during Public Registration
  const hackerRes = await makeApiRequest('/api/auth/register', 'POST', {
    name: 'Privilege Escalation Attacker',
    email: `attacker.${timestamp}@resolveiq.test`,
    password: 'Attacker@12345',
    role: USER_ROLES.ADMIN, // Attempting to self-assign ADMIN
  });
  assertTest(hackerRes.status === 201, 'Registration accepted without server crash');
  assertTest(
    hackerRes.body.user.role === USER_ROLES.CUSTOMER,
    'Security Verified: Public registration forces CUSTOMER even when ADMIN role is requested'
  );

  // 1.3 Duplicate Registration Rejection
  const dupRes = await makeApiRequest('/api/auth/register', 'POST', {
    name: 'Duplicate Registrant',
    email: testCustomerEmail,
    password: testCustomerPassword,
  });
  assertTest(dupRes.status === 400, 'Duplicate registration is rejected with HTTP 400 Bad Request');
  assertTest(dupRes.body.success === false, 'Duplicate error response contains success: false');

  // --- SECTION 2: LOGIN FOR ALL 4 ROLES ---
  console.log('\n--- Section 2: Login Verification for All 4 Roles ---');
  // Customer Login
  const custLogin = await makeApiRequest('/api/auth/login', 'POST', {
    email: testCustomerEmail,
    password: testCustomerPassword,
  });
  assertTest(custLogin.status === 200, 'Customer login succeeds with HTTP 200');
  assertTest(custLogin.body.user.role === USER_ROLES.CUSTOMER, 'Customer user role verified as CUSTOMER');
  const custToken = custLogin.body.token;

  // Agent Login
  const agentLogin = await makeApiRequest('/api/auth/login', 'POST', {
    email: 'agent@resolveiq.test',
    password: 'Agent@12345',
  });
  assertTest(agentLogin.status === 200, 'Support Agent login succeeds with HTTP 200');
  assertTest(agentLogin.body.user.role === USER_ROLES.SUPPORT_AGENT, 'Agent user role verified as SUPPORT_AGENT');
  const agentToken = agentLogin.body.token;

  // Manager Login
  const managerLogin = await makeApiRequest('/api/auth/login', 'POST', {
    email: 'manager@resolveiq.test',
    password: 'Manager@12345',
  });
  assertTest(managerLogin.status === 200, 'Support Manager login succeeds with HTTP 200');
  assertTest(managerLogin.body.user.role === USER_ROLES.SUPPORT_MANAGER, 'Manager user role verified as SUPPORT_MANAGER');
  const managerToken = managerLogin.body.token;

  // Admin Login
  const adminLogin = await makeApiRequest('/api/auth/login', 'POST', {
    email: 'admin@resolveiq.test',
    password: 'Admin@12345',
  });
  assertTest(adminLogin.status === 200, 'Admin login succeeds with HTTP 200');
  assertTest(adminLogin.body.user.role === USER_ROLES.ADMIN, 'Admin user role verified as ADMIN');
  const adminToken = adminLogin.body.token;

  // Admin Provisioning of Staff User
  const newStaffEmail = `staff.${timestamp}@resolveiq.test`;
  const provRes = await makeApiRequest(
    '/api/users/staff',
    'POST',
    {
      name: 'Newly Provisioned Specialist',
      email: newStaffEmail,
      password: 'StaffPassword@123',
      role: USER_ROLES.SUPPORT_AGENT,
    },
    adminToken
  );
  assertTest(provRes.status === 201, 'Admin can provision new staff account via POST /api/users/staff');
  assertTest(provRes.body.user.role === USER_ROLES.SUPPORT_AGENT, 'Provisioned staff retains SUPPORT_AGENT role');

  // --- SECTION 3: ROLE-BASED ACCESS CONTROL (UNAUTHORIZED ACCESS BLOCKED) ---
  console.log('\n--- Section 3: RBAC Security & Unauthorized Access Blocks ---');
  // Customer attempting Admin-only users list
  const custUsersBlock = await makeApiRequest('/api/users', 'GET', null, custToken);
  assertTest(custUsersBlock.status === 403, 'Customer blocked from Admin /api/users with HTTP 403 Forbidden');

  // Customer attempting Analytics Overview
  const custAnalyticsBlock = await makeApiRequest('/api/tickets/analytics/overview', 'GET', null, custToken);
  assertTest(custAnalyticsBlock.status === 403, 'Customer blocked from Analytics overview with HTTP 403 Forbidden');

  // Customer attempting CSV Export
  const custCsvBlock = await makeApiRequest('/api/tickets/export/csv', 'GET', null, custToken);
  assertTest(custCsvBlock.status === 403, 'Customer blocked from CSV export with HTTP 403 Forbidden');

  // Agent attempting Admin-only users list
  const agentUsersBlock = await makeApiRequest('/api/users', 'GET', null, agentToken);
  assertTest(agentUsersBlock.status === 403, 'Agent blocked from Admin /api/users with HTTP 403 Forbidden');

  // Unauthenticated request (no JWT)
  const noAuthBlock = await makeApiRequest('/api/tickets', 'GET', null, null);
  assertTest(noAuthBlock.status === 401, 'Unauthenticated request rejected with HTTP 401 Unauthorized');

  // Manager accessing Analytics (Allowed)
  const managerAnalyticsAllow = await makeApiRequest('/api/tickets/analytics/overview', 'GET', null, managerToken);
  assertTest(managerAnalyticsAllow.status === 200, 'Manager authorized to access /api/tickets/analytics/overview with HTTP 200');

  // Admin accessing Users (Allowed)
  const adminUsersAllow = await makeApiRequest('/api/users', 'GET', null, adminToken);
  assertTest(adminUsersAllow.status === 200, 'Admin authorized to access /api/users with HTTP 200');

  // --- SECTION 4: TICKET CREATION, AI ENGINE & CALL PIN ---
  console.log('\n--- Section 4: Ticket Creation, AI Triage & Telephony PIN ---');
  const ticketRes = await makeApiRequest(
    '/api/tickets',
    'POST',
    {
      title: 'UPI Transaction Deducted But Gateway Crashed With Error 500',
      description: 'Customer attempted checkout. Money debited with UTR 987654321098. Database connection timeout.',
      category: 'PAYMENTS_UPI',
      priority: 'URGENT',
      attachments: [{ name: 'screenshot.png', url: 'data:image/png;base64,iVBORw0KGgo...', fileType: 'image/png' }],
    },
    custToken
  );
  assertTest(ticketRes.status === 201, 'Ticket creation returns HTTP 201 Created');
  const createdTicket = ticketRes.body.ticket;
  assertTest(createdTicket.ticketId.startsWith('TIK-'), `Ticket ID generated with format ${createdTicket.ticketId}`);
  assertTest(
    typeof createdTicket.callPin === 'string' && createdTicket.callPin.length === 6,
    `6-digit Telephony Call PIN generated: ${createdTicket.callPin}`
  );
  assertTest(createdTicket.priority === 'URGENT', 'Priority set to URGENT');
  assertTest(createdTicket.slaHours === 4, 'SLA target for URGENT calculated as 4 hours');
  assertTest(Boolean(createdTicket.slaDeadline), 'SLA deadline timestamp scheduled');
  assertTest(Boolean(createdTicket.aiMetadata), 'AI triage metadata attached to ticket');
  assertTest(
    ['URGENT', 'FRUSTRATED', 'NEUTRAL'].includes(createdTicket.aiMetadata.sentiment),
    `AI Sentiment triaged as ${createdTicket.aiMetadata.sentiment}`
  );

  // Check Activity Log creation in Atlas
  const createActivity = await Activity.findOne({ ticketId: createdTicket.ticketId, action: 'TICKET_CREATED' });
  assertTest(Boolean(createActivity), 'Dedicated Activity model persists TICKET_CREATED record in Atlas');

  // --- SECTION 5: TELEPHONY VOICE IVR SIMULATION LOOKUP ---
  console.log('\n--- Section 5: Voice IVR Telephony Simulation Lookup ---');
  const ivrRes = await makeApiRequest(`/api/tickets/lookup/pin/${createdTicket.callPin}`, 'GET');
  assertTest(ivrRes.status === 200, 'IVR Call PIN lookup returns HTTP 200 OK');
  assertTest(ivrRes.body.ticketId === createdTicket.ticketId, 'IVR returns correct ticket reference ID');
  assertTest(typeof ivrRes.body.spokenPrompt === 'string', 'IVR returns automated spoken speech script text');
  assertTest(ivrRes.body.spokenPrompt.includes(createdTicket.ticketId), 'IVR spoken speech references ticket ID');

  // Negative PIN Lookup
  const badIvrRes = await makeApiRequest('/api/tickets/lookup/pin/000000', 'GET');
  assertTest(badIvrRes.status === 404, 'Invalid 6-digit Call PIN returns HTTP 404 Not Found');

  // --- SECTION 6: TICKET CLAIM & ASSIGNMENT ---
  console.log('\n--- Section 6: Agent Assignment Workflow ---');
  const assignRes = await makeApiRequest(
    `/api/tickets/${createdTicket._id}/assign`,
    'PUT',
    {}, // Self-assign for agent
    agentToken
  );
  assertTest(assignRes.status === 200, 'Agent claim/assignment returns HTTP 200 OK');
  assertTest(Boolean(assignRes.body.ticket.assignedTo), 'Ticket assignedTo field updated with agent');
  assertTest(assignRes.body.ticket.status === 'IN_PROGRESS', 'Ticket auto-advances to IN_PROGRESS on assignment');

  // Check Assignment model in Atlas
  const assignDoc = await Assignment.findOne({ ticketId: createdTicket.ticketId, status: ASSIGNMENT_STATUSES.ASSIGNED });
  assertTest(Boolean(assignDoc), 'Dedicated Assignment collection persists record in Atlas');

  // --- SECTION 7: MESSAGING & ROLE PRIVACY ENFORCEMENT ---
  console.log('\n--- Section 7: Public Messages & Internal Note Privacy ---');
  // 7.1 Agent adds private internal note
  const internalNoteRes = await makeApiRequest(
    `/api/tickets/${createdTicket._id}/messages`,
    'POST',
    {
      message: 'Staff Internal Note: Verified bank switch UTR with Razorpay NOC. Transaction settled.',
      isInternal: true,
    },
    agentToken
  );
  assertTest(internalNoteRes.status === 201, 'Agent posting internal note returns HTTP 201 Created');

  // 7.2 Agent adds public reply
  const publicReplyRes = await makeApiRequest(
    `/api/tickets/${createdTicket._id}/messages`,
    'POST',
    {
      message: 'Dear Alex, your UPI payment has been reconciled and your subscription is active.',
      isInternal: false,
    },
    agentToken
  );
  assertTest(publicReplyRes.status === 201, 'Agent posting public reply returns HTTP 201 Created');

  // 7.3 CRITICAL SECURITY AUDIT: Customer View Filters Internal Notes
  const customerViewRes = await makeApiRequest(`/api/tickets/${createdTicket._id}`, 'GET', null, custToken);
  assertTest(customerViewRes.status === 200, 'Customer retrieves ticket details with HTTP 200 OK');
  const customerMessages = customerViewRes.body.ticket.messages;
  const customerSeesInternalNote = customerMessages.some((m) => m.isInternal === true);
  assertTest(
    customerSeesInternalNote === false,
    'Security Verified: Customer response physically omits all internal staff notes'
  );
  assertTest(
    customerMessages.some((m) => m.message.includes('Dear Alex')),
    'Customer can view the public reply message'
  );

  // 7.4 Staff View Retains Internal Notes
  const staffViewRes = await makeApiRequest(`/api/tickets/${createdTicket._id}`, 'GET', null, agentToken);
  const staffMessages = staffViewRes.body.ticket.messages;
  const staffSeesInternalNote = staffMessages.some((m) => m.isInternal === true);
  assertTest(staffSeesInternalNote === true, 'Staff view retains internal notes for operational collaboration');

  // --- SECTION 8: ESCALATION, RESOLUTION & CSAT RATINGS ---
  console.log('\n--- Section 8: Escalation, Resolution & CSAT Rating ---');
  // 8.1 Ticket Escalation
  const escalateRes = await makeApiRequest(
    `/api/tickets/${createdTicket._id}/escalate`,
    'PUT',
    { reason: 'Customer reported repeated gateway timeout' },
    agentToken
  );
  assertTest(escalateRes.status === 200, 'Staff ticket escalation returns HTTP 200 OK');
  assertTest(escalateRes.body.ticket.escalated.isEscalated === true, 'Ticket escalated flag is true');
  assertTest(escalateRes.body.ticket.priority === 'URGENT', 'Escalation elevates priority to URGENT');

  // 8.2 Ticket Resolution
  const resolveRes = await makeApiRequest(
    `/api/tickets/${createdTicket._id}/status`,
    'PUT',
    { status: TICKET_STATUSES.RESOLVED },
    agentToken
  );
  assertTest(resolveRes.status === 200, 'Status updated to RESOLVED with HTTP 200 OK');
  assertTest(Boolean(resolveRes.body.ticket.resolvedAt), 'resolvedAt timestamp recorded in ticket');

  // 8.3 Customer CSAT Rating Submission
  const csatRes = await makeApiRequest(
    `/api/tickets/${createdTicket._id}/rate`,
    'PUT',
    { score: 5, comment: 'Exceptional response speed and courteous support.' },
    custToken
  );
  assertTest(csatRes.status === 200, 'Customer submitting CSAT rating returns HTTP 200 OK');
  assertTest(csatRes.body.satisfactionRating.score === 5, 'CSAT rating score 5 recorded');

  // Negative CSAT: Non-customer rating blocked
  const badCsatRes = await makeApiRequest(
    `/api/tickets/${createdTicket._id}/rate`,
    'PUT',
    { score: 5, comment: 'Staff rating' },
    agentToken
  );
  assertTest(badCsatRes.status === 403, 'Non-owner blocked from submitting CSAT rating with HTTP 403 Forbidden');

  // --- SECTION 9: TICKET REOPENING LIFECYCLE ---
  console.log('\n--- Section 9: Ticket Reopening Lifecycle ---');
  const reopenRes = await makeApiRequest(
    `/api/tickets/${createdTicket._id}/reopen`,
    'PUT',
    { reason: 'Customer needs tax invoice receipt attached' },
    custToken
  );
  assertTest(reopenRes.status === 200, 'Ticket reopen returns HTTP 200 OK');
  assertTest(reopenRes.body.ticket.status === 'IN_PROGRESS', 'Reopened ticket status resets to IN_PROGRESS');
  assertTest(reopenRes.body.ticket.reopened.isReopened === true, 'Ticket reopened.isReopened flag is true');
  assertTest(reopenRes.body.ticket.reopened.reopenCount === 1, 'Ticket reopenCount incremented to 1');

  // Re-resolve ticket
  await makeApiRequest(
    `/api/tickets/${createdTicket._id}/status`,
    'PUT',
    { status: TICKET_STATUSES.RESOLVED },
    agentToken
  );

  // --- SECTION 10: COLLISION HEARTBEAT & REAL ANALYTICS ---
  console.log('\n--- Section 10: Collision Presence Heartbeat & Real Analytics ---');
  // 10.1 Collision Heartbeat
  const heartbeatRes = await makeApiRequest(
    `/api/tickets/${createdTicket._id}/viewing`,
    'POST',
    null,
    agentToken
  );
  assertTest(heartbeatRes.status === 200, 'Collision presence heartbeat returns HTTP 200 OK');

  // 10.2 Real MongoDB Analytics Aggregation
  const analyticsRes = await makeApiRequest('/api/tickets/analytics/overview', 'GET', null, managerToken);
  assertTest(analyticsRes.status === 200, 'Analytics endpoint returns HTTP 200 OK');
  assertTest(analyticsRes.body.analytics.summary.total >= 1, 'Analytics summary reflects total tickets count');
  assertTest(typeof analyticsRes.body.analytics.summary.resolutionRate === 'number', 'Resolution rate calculated');
  assertTest(Array.isArray(analyticsRes.body.analytics.categories), 'Category aggregation array returned');
  assertTest(Array.isArray(analyticsRes.body.analytics.sentiments), 'Sentiment aggregation array returned');
  assertTest(Array.isArray(analyticsRes.body.analytics.agentWorkload), 'Agent workload aggregation array returned');

  // 10.3 CSV Report Export
  const csvRes = await makeApiRequest('/api/tickets/export/csv', 'GET', null, managerToken);
  assertTest(csvRes.status === 200, 'CSV export endpoint returns HTTP 200 OK');
  assertTest(
    csvRes.headers['content-type']?.includes('text/csv'),
    'CSV export returns Content-Type: text/csv'
  );
  assertTest(
    csvRes.raw.includes('Ticket ID,Call PIN,Title'),
    'CSV export contains correct header format'
  );

  // --- SECTION 11: GUIDED TROUBLESHOOTING & CATEGORY POLICIES ---
  console.log('\n--- Section 11: Guided Troubleshooting & Category Policies ---');
  const catRes = await makeApiRequest('/api/categories', 'GET');
  assertTest(catRes.status === 200, 'Categories endpoint returns HTTP 200 OK');
  assertTest(catRes.body.categories.length >= 5, 'All 5 default categories populated');

  const upiCategory = catRes.body.categories.find((c) => c.slug === 'PAYMENTS_UPI');
  assertTest(
    upiCategory?.policyType === 'RESTRICTED_CALL_REQUIRED',
    'Policy Verified: PAYMENTS_UPI is governed by RESTRICTED_CALL_REQUIRED policy'
  );

  const techCategory = catRes.body.categories.find((c) => c.slug === 'TECHNICAL');
  assertTest(
    techCategory?.policyType === 'ALLOW_DIY',
    'Policy Verified: TECHNICAL is governed by ALLOW_DIY self-service deflection policy'
  );
  assertTest(
    techCategory?.troubleshootingSteps.length >= 3,
    'TECHNICAL category contains guided troubleshooting step-by-step instructions'
  );

  // --- SECTION 12: MONGODB ATLAS DIRECT DATA PERSISTENCE ---
  console.log('\n--- Section 12: MongoDB Atlas Physical Data Persistence Audit ---');
  const directCounts = {
    User: await User.countDocuments(),
    Category: await Category.countDocuments(),
    Ticket: await Ticket.countDocuments(),
    TicketMessage: await TicketMessage.countDocuments(),
    Assignment: await Assignment.countDocuments(),
    Activity: await Activity.countDocuments(),
    Article: await Article.countDocuments(),
  };

  console.table(directCounts);
  assertTest(directCounts.User >= 4, 'Users collection populated in Atlas');
  assertTest(directCounts.Category >= 5, 'Category collection populated in Atlas');
  assertTest(directCounts.Ticket >= 1, 'Ticket collection populated in Atlas');
  assertTest(directCounts.TicketMessage >= 2, 'Dedicated TicketMessage collection populated in Atlas');
  assertTest(directCounts.Assignment >= 1, 'Dedicated Assignment collection populated in Atlas');
  assertTest(directCounts.Activity >= 3, 'Dedicated Activity audit collection populated in Atlas');
  assertTest(directCounts.Article >= 4, 'Knowledge Article collection populated in Atlas');

  // Cleanup server
  server.close();
  await mongoose.disconnect();

  console.log('\n===============================================================');
  console.log(`AUDIT COMPLETE: ${passedAuditCount} / ${passedAuditCount + failedAuditCount} PASSED`);
  if (failedAuditCount > 0) {
    console.log(`❌ FAILURES DETECTED: ${failedAuditCount}`);
    auditFailures.forEach((f) => console.log(`   - ${f.testName}: ${f.details}`));
  } else {
    console.log('✅ ZERO FAILURES DETECTED ACROSS ALL AUDITED SYSTEM DOMAINS.');
  }
  console.log('===============================================================\n');

  if (failedAuditCount > 0) {
    process.exit(1);
  }
}

runComprehensiveAudit().catch((err) => {
  console.error('Fatal audit error:', err);
  if (server) server.close();
  process.exit(1);
});
