/**
 * ResolveIQ Ticket Collision & Presence Isolation Regression Test Suite
 *
 * Requirements Verified:
 * 1. Customers must NEVER see internal ticket collision alerts, staff presence information, or internal collaboration metadata.
 * 2. Support agents and managers may see a collaboration alert when another support staff member is actively viewing the same ticket.
 * 3. Clearly distinguish CUSTOMER viewers from SUPPORT_AGENT and SUPPORT_MANAGER viewers.
 * 4. Do not display a staff collision warning merely because the customer is viewing their own ticket.
 * 5. Ensure the backend returns only the viewer information appropriate to the requesting role.
 * 6. Check stale viewer records and ensure inactive sessions do not generate permanent alerts.
 * 7. Verify existing internal-note privacy rules.
 */

import http from 'http';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import app from '../src/index.js';
import User, { USER_ROLES } from '../src/models/User.js';
import Ticket, { TICKET_STATUSES, TICKET_PRIORITIES } from '../src/models/Ticket.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

let server;
let serverPort = 5066;
let baseUrl;

let passed = 0;
let failed = 0;

function it(desc, condition) {
  if (condition) {
    console.log(`  ✅ PASS: ${desc}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${desc}`);
    failed++;
  }
}

function makeRequest(apiPath, method = 'GET', body = null, token = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = {
      'Content-Type': 'application/json',
      ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const req = http.request(`${baseUrl}${apiPath}`, { method, headers }, (res) => {
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
    if (payload) req.write(payload);
    req.end();
  });
}

async function runCollisionRegressionTests() {
  console.log('\n===============================================================');
  console.log('🧪 RUNNING TICKET COLLISION & PRESENCE REGRESSION TEST SUITE');
  console.log('===============================================================\n');

  // Connect to Atlas
  await mongoose.connect(process.env.MONGODB_URI);

  // Start HTTP server on test port
  await new Promise((resolve) => {
    server = app.listen(serverPort, () => {
      baseUrl = `http://localhost:${serverPort}`;
      resolve();
    });
  });

  // Ensure Customer John exists with known password
  let john = await User.findOne({ email: 'john@example.com' });
  if (!john) {
    john = await User.create({
      name: 'John Customer',
      email: 'john@example.com',
      password: 'Password@123',
      role: USER_ROLES.CUSTOMER,
    });
  } else {
    john.password = 'Password@123';
    await john.save();
  }

  // Ensure Sarah (Agent) and Marcus (Manager) exist
  const sarah = await User.findOne({ email: 'agent@resolveiq.test' });
  const marcus = await User.findOne({ email: 'manager@resolveiq.test' });

  // Ensure Ticket TIK-10952 exists and is owned by John
  let ticket10952 = await Ticket.findOne({ ticketId: 'TIK-10952' });
  if (!ticket10952) {
    ticket10952 = await Ticket.create({
      ticketId: 'TIK-10952',
      title: 'UPI payment debited but order failed',
      description: 'Transaction was debited from HDFC bank but order is pending.',
      category: 'PAYMENTS_UPI',
      priority: 'HIGH',
      status: 'OPEN',
      customer: john._id,
      callPin: '109520',
      activeViewers: [],
    });
  } else {
    // Reset activeViewers on TIK-10952 for clean test state
    ticket10952.activeViewers = [];
    ticket10952.customer = john._id;
    await ticket10952.save();
  }

  // Add sample public and internal message to TIK-10952 for privacy check
  ticket10952.messages = [
    {
      sender: john._id,
      senderName: john.name,
      senderRole: 'CUSTOMER',
      message: 'Hello, order failed after debit.',
      isInternal: false,
      createdAt: new Date(),
    },
    {
      sender: sarah._id,
      senderName: sarah.name,
      senderRole: 'SUPPORT_AGENT',
      message: 'Internal Staff Note: Bank gateway reconciliation required.',
      isInternal: true,
      createdAt: new Date(),
    },
    {
      sender: sarah._id,
      senderName: sarah.name,
      senderRole: 'SUPPORT_AGENT',
      message: 'Dear John, we are investigating with payment operations.',
      isInternal: false,
      createdAt: new Date(),
    },
  ];
  await ticket10952.save();

  // Obtain login tokens for John, Sarah, and Marcus
  const johnLogin = await makeRequest('/api/auth/login', 'POST', {
    email: 'john@example.com',
    password: 'Password@123',
  });
  const johnToken = johnLogin.body.token;

  const sarahLogin = await makeRequest('/api/auth/login', 'POST', {
    email: 'agent@resolveiq.test',
    password: 'Agent@12345',
  });
  const sarahToken = sarahLogin.body.token;

  const marcusLogin = await makeRequest('/api/auth/login', 'POST', {
    email: 'manager@resolveiq.test',
    password: 'Manager@12345',
  });
  const marcusToken = marcusLogin.body.token;

  // --- TEST SUITE 1: CUSTOMER VIEW ISOLATION ---
  console.log('--- Test Suite 1: Customer Presence & Privacy Isolation ---');

  // Customer John retrieves TIK-10952
  const johnTicketRes = await makeRequest(`/api/tickets/${ticket10952._id}`, 'GET', null, johnToken);
  it('Customer retrieves ticket with HTTP 200', johnTicketRes.status === 200);
  it(
    'Customer API response strictly strips activeViewers metadata (empty array)',
    Array.isArray(johnTicketRes.body.ticket.activeViewers) && johnTicketRes.body.ticket.activeViewers.length === 0
  );
  it(
    'Customer API response strictly filters out private internal staff notes',
    johnTicketRes.body.ticket.messages.length === 2 &&
      johnTicketRes.body.ticket.messages.every((m) => m.isInternal === false)
  );

  // Customer John sends presence heartbeat
  const johnHeartbeatRes = await makeRequest(`/api/tickets/${ticket10952._id}/viewing`, 'POST', null, johnToken);
  it('Customer heartbeat returns HTTP 200', johnHeartbeatRes.status === 200);
  it(
    'Customer heartbeat returns activeViewers as empty array (no staff collision info)',
    Array.isArray(johnHeartbeatRes.body.activeViewers) && johnHeartbeatRes.body.activeViewers.length === 0
  );
  it('Customer heartbeat returns staffColliding: false', johnHeartbeatRes.body.staffColliding === false);

  // Verify DB recorded John as CUSTOMER viewer
  const dbAfterJohn = await Ticket.findById(ticket10952._id);
  const johnInDb = dbAfterJohn.activeViewers.find((v) => v.userId.toString() === john._id.toString());
  it('Customer presence is recorded in database with userRole: CUSTOMER', johnInDb && johnInDb.userRole === 'CUSTOMER');

  // --- TEST SUITE 2: SUPPORT AGENT OPENS TICKET WHILE CUSTOMER IS VIEWING ---
  console.log('\n--- Test Suite 2: Support Staff Presence with Customer Active ---');

  // Sarah (Support Agent) sends presence heartbeat
  const sarahHeartbeatRes = await makeRequest(`/api/tickets/${ticket10952._id}/viewing`, 'POST', null, sarahToken);
  it('Support Agent heartbeat returns HTTP 200', sarahHeartbeatRes.status === 200);
  it(
    'Requirement 4: Support Agent activeViewers excludes Customer John (no staff collision alert triggered)',
    Array.isArray(sarahHeartbeatRes.body.activeViewers) && sarahHeartbeatRes.body.activeViewers.length === 0
  );
  it(
    'Support Agent staffColliding is false when only the customer is viewing',
    sarahHeartbeatRes.body.staffColliding === false
  );
  it(
    'Requirement 3: Customer presence is distinguished under customerViewing flag',
    sarahHeartbeatRes.body.customerViewing === true
  );

  // --- TEST SUITE 3: TWO STAFF MEMBERS VIEWING CONCURRENTLY (REAL COLLISION) ---
  console.log('\n--- Test Suite 3: Staff-to-Staff Collaboration Collision Alert ---');

  // Marcus (Support Manager) sends presence heartbeat on the same ticket
  const marcusHeartbeatRes = await makeRequest(`/api/tickets/${ticket10952._id}/viewing`, 'POST', null, marcusToken);
  it('Support Manager heartbeat returns HTTP 200', marcusHeartbeatRes.status === 200);
  it(
    'Requirement 2: Support Manager activeViewers contains Sarah (Support Agent)',
    marcusHeartbeatRes.body.activeViewers.length === 1 &&
      marcusHeartbeatRes.body.activeViewers[0].userId === sarah._id.toString()
  );
  it(
    'Requirement 3: Viewer role is explicitly identified as SUPPORT_AGENT',
    marcusHeartbeatRes.body.activeViewers[0].userRole === 'SUPPORT_AGENT'
  );
  it('Support Manager staffColliding is true', marcusHeartbeatRes.body.staffColliding === true);

  // Sarah sends next heartbeat: should now see Marcus (Support Manager)
  const sarahSecondHeartbeat = await makeRequest(`/api/tickets/${ticket10952._id}/viewing`, 'POST', null, sarahToken);
  it(
    'Requirement 2: Support Agent activeViewers contains Marcus (Support Manager)',
    sarahSecondHeartbeat.body.activeViewers.length === 1 &&
      sarahSecondHeartbeat.body.activeViewers[0].userId === marcus._id.toString()
  );
  it(
    'Requirement 3: Viewer role is explicitly identified as SUPPORT_MANAGER',
    sarahSecondHeartbeat.body.activeViewers[0].userRole === 'SUPPORT_MANAGER'
  );
  it('Support Agent staffColliding is true', sarahSecondHeartbeat.body.staffColliding === true);

  // --- TEST SUITE 4: CUSTOMER PERSPECTIVE DURING STAFF COLLISION ---
  console.log('\n--- Test Suite 4: Customer Still Receives Zero Collision Alerts During Active Staff Collision ---');

  // While both Sarah and Marcus are actively viewing, John pings heartbeat
  const johnDuringCollision = await makeRequest(`/api/tickets/${ticket10952._id}/viewing`, 'POST', null, johnToken);
  it('Customer heartbeat still returns HTTP 200', johnDuringCollision.status === 200);
  it(
    'Requirement 1 & 5: Customer activeViewers remains strictly empty [] even while two staff members collide',
    Array.isArray(johnDuringCollision.body.activeViewers) && johnDuringCollision.body.activeViewers.length === 0
  );
  it(
    'Customer staffColliding remains false',
    johnDuringCollision.body.staffColliding === false
  );

  // Customer fetches ticket details
  const johnDetailsDuringCollision = await makeRequest(`/api/tickets/${ticket10952._id}`, 'GET', null, johnToken);
  it(
    'Customer GET /api/tickets/:id returns empty activeViewers: []',
    Array.isArray(johnDetailsDuringCollision.body.ticket.activeViewers) &&
      johnDetailsDuringCollision.body.ticket.activeViewers.length === 0
  );

  // --- TEST SUITE 5: STALE SESSIONS AUTOMATICALLY PURGED ---
  console.log('\n--- Test Suite 5: Stale Viewer Purge Verification ---');

  // Artificially age an active viewer to 3 minutes ago in MongoDB
  const dbTicketStale = await Ticket.findById(ticket10952._id);
  const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000);
  dbTicketStale.activeViewers = [
    {
      userId: marcus._id,
      userName: marcus.name,
      userRole: marcus.role,
      lastSeen: threeMinutesAgo, // Stale!
    },
  ];
  await dbTicketStale.save();

  // Sarah pings heartbeat: stale Marcus viewer must be purged and not cause collision
  const sarahStaleCheck = await makeRequest(`/api/tickets/${ticket10952._id}/viewing`, 'POST', null, sarahToken);
  it(
    'Requirement 7: Inactive/stale sessions (> 2 min) do not generate collision alerts (activeViewers is empty)',
    sarahStaleCheck.body.activeViewers.length === 0 && sarahStaleCheck.body.staffColliding === false
  );

  // --- TEST SUITE 6: INTERNAL NOTE PRIVACY INTEGRITY ---
  console.log('\n--- Test Suite 6: Internal Note Privacy Verification ---');
  const staffTicketRes = await makeRequest(`/api/tickets/${ticket10952._id}`, 'GET', null, sarahToken);
  it('Staff retrieves all messages including internal staff notes (count: 3)', staffTicketRes.body.ticket.messages.length === 3);
  it(
    'Staff response retains message with isInternal: true',
    staffTicketRes.body.ticket.messages.some((m) => m.isInternal === true)
  );

  server.close();
  await mongoose.disconnect();

  console.log('\n===============================================================');
  console.log(`COLLISION REGRESSION TESTS COMPLETE: ${passed}/${passed + failed} PASSED`);
  if (failed > 0) {
    console.log(`❌ FAILURES: ${failed}`);
    process.exit(1);
  } else {
    console.log('✅ ALL COLLISION & PRESENCE REGRESSION TESTS PASSED (100% SUCCESS)');
  }
  console.log('===============================================================\n');
}

runCollisionRegressionTests().catch((err) => {
  console.error('Fatal test error:', err);
  if (server) server.close();
  process.exit(1);
});
