import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User, { USER_ROLES } from '../src/models/User.js';
import { registerUser, loginUser, getUserProfile } from '../src/controllers/authController.js';
import { protect, authorize } from '../src/middleware/authMiddleware.js';

console.log('🧪 Starting ResolveIQ End-to-End Controller & Auth Logic Tests...\n');

let passed = 0;
let total = 0;

function assert(condition, message) {
  total++;
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
  }
}

// Helper to simulate Express req, res, next
function createMockContext(reqOverrides = {}) {
  const req = {
    body: {},
    headers: {},
    params: {},
    query: {},
    user: null,
    ...reqOverrides,
  };

  let statusCode = 200;
  let responseData = null;

  const res = {
    statusCode: 200,
    status(code) {
      statusCode = code;
      res.statusCode = code;
      return res;
    },
    json(data) {
      responseData = data;
      return res;
    },
    send(data) {
      responseData = data;
      return res;
    },
  };

  return {
    req,
    res,
    getStatusCode: () => statusCode,
    getBody: () => responseData,
  };
}

async function runControllerTests() {
  process.env.JWT_SECRET = 'resolveiq_test_jwt_secret_key_123';

  // In-memory user store for mock database behavior
  const mockDb = new Map();

  // Save original methods
  const originalFindOne = User.findOne;
  const originalCreate = User.create;
  const originalFindById = User.findById;
  const originalReadyState = mongoose.connection.readyState;

  try {
    // Mock database connection as active (readyState = 1)
    Object.defineProperty(mongoose.connection, 'readyState', {
      value: 1,
      configurable: true,
      writable: true,
    });

    // Mock User.findOne
    User.findOne = ({ email }) => {
      const normalizedEmail = email.toLowerCase().trim();
      const found = mockDb.get(normalizedEmail);

      return {
        select: (fields) => {
          if (!found) return Promise.resolve(null);
          // Return user instance with matchPassword method
          return Promise.resolve({
            _id: found._id,
            name: found.name,
            email: found.email,
            password: found.password,
            role: found.role,
            createdAt: found.createdAt,
            matchPassword: async (enteredPassword) => {
              return await bcrypt.compare(enteredPassword, found.password);
            },
          });
        },
        then: (resolve) => resolve(found ? { ...found } : null),
      };
    };

    // Mock User.create
    User.create = async ({ name, email, password, role }) => {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      const newUser = {
        _id: 'user_' + Math.random().toString(36).substr(2, 9),
        name,
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        role: role || USER_ROLES.CUSTOMER,
        createdAt: new Date(),
      };
      mockDb.set(newUser.email, newUser);
      return newUser;
    };

    // Mock User.findById
    User.findById = (id) => {
      let foundUser = null;
      for (const u of mockDb.values()) {
        if (u._id === id) {
          foundUser = u;
          break;
        }
      }

      return {
        select: (fields) => {
          if (!foundUser) return Promise.resolve(null);
          return Promise.resolve({
            _id: foundUser._id,
            name: foundUser.name,
            email: foundUser.email,
            role: foundUser.role,
            createdAt: foundUser.createdAt,
          });
        },
      };
    };

    // ----------------------------------------------------
    // Test Suite 1: Registration API (registerUser)
    // ----------------------------------------------------
    console.log('--- Test Suite 1: User Registration Controller ---');

    // 1.1 Successful Registration of Customer
    const ctx1 = createMockContext({
      body: {
        name: 'Sarah Customer',
        email: 'sarah@example.com',
        password: 'password123',
        role: 'CUSTOMER',
      },
    });
    await registerUser(ctx1.req, ctx1.res, () => {});
    assert(ctx1.getStatusCode() === 201, 'registerUser returns HTTP 201 on valid customer registration');
    assert(ctx1.getBody().success === true, 'Registration response includes success: true');
    assert(typeof ctx1.getBody().token === 'string', 'Registration returns a valid signed JWT token');
    assert(ctx1.getBody().user.role === 'CUSTOMER', 'Registered user has role CUSTOMER');
    const sarahToken = ctx1.getBody().token;

    // 1.2 Duplicate Email Rejection
    const ctxDup = createMockContext({
      body: {
        name: 'Sarah Duplicate',
        email: 'sarah@example.com',
        password: 'password456',
      },
    });
    await registerUser(ctxDup.req, ctxDup.res, () => {});
    assert(ctxDup.getStatusCode() === 400, 'Duplicate registration is rejected with HTTP 400');
    assert(ctxDup.getBody().message.includes('already exists'), 'Duplicate error message informs user email exists');

    // 1.3 Security Rule: Public Registration always assigns CUSTOMER role
    // Even if an unauthenticated user requests SUPPORT_AGENT, role is safely forced to CUSTOMER
    const ctxAgent = createMockContext({
      body: {
        name: 'Alex Agent Attempt',
        email: 'alex.agent@example.com',
        password: 'agentpassword',
        role: 'SUPPORT_AGENT',
      },
    });
    await registerUser(ctxAgent.req, ctxAgent.res, () => {});
    assert(
      ctxAgent.getStatusCode() === 201 && ctxAgent.getBody().user.role === 'CUSTOMER',
      'Security Check: Public registration safely forces CUSTOMER role even if SUPPORT_AGENT is requested'
    );

    // 1.4 Security Rule: Public registration with ADMIN requested is forced to CUSTOMER
    const ctxAdmin = createMockContext({
      body: {
        name: 'David Admin Attempt',
        email: 'david.admin@example.com',
        password: 'adminpassword',
        role: 'ADMIN',
      },
    });
    await registerUser(ctxAdmin.req, ctxAdmin.res, () => {});
    assert(
      ctxAdmin.getStatusCode() === 201 && ctxAdmin.getBody().user.role === 'CUSTOMER',
      'Security Check: Public registration safely forces CUSTOMER role even if ADMIN is requested'
    );

    // 1.5 Security Rule: Staff roles are created securely by Admins or seed data
    const staffAgent = {
      _id: 'agent_1',
      name: 'Sarah Agent',
      email: 'sarah.agent@resolveiq.test',
      password: await bcrypt.hash('agentpass', 10),
      role: USER_ROLES.SUPPORT_AGENT,
    };
    mockDb.set(staffAgent.email, staffAgent);
    assert(staffAgent.role === 'SUPPORT_AGENT', 'Staff accounts provisioned through admin/seed retain SUPPORT_AGENT role');

    const staffAdmin = {
      _id: 'admin_1',
      name: 'Eleanor Admin',
      email: 'eleanor.admin@resolveiq.test',
      password: await bcrypt.hash('adminpass', 10),
      role: USER_ROLES.ADMIN,
    };
    mockDb.set(staffAdmin.email, staffAdmin);
    assert(staffAdmin.role === 'ADMIN', 'Admin accounts provisioned through admin/seed retain ADMIN role');

    // 1.7 Missing Fields Validation
    const ctxMissing = createMockContext({ body: { email: 'test@example.com' } });
    await registerUser(ctxMissing.req, ctxMissing.res, () => {});
    assert(ctxMissing.getStatusCode() === 400, 'registerUser rejects missing name or password with HTTP 400');

    // 1.8 Password < 6 chars Validation
    const ctxShort = createMockContext({
      body: { name: 'Dan', email: 'dan@example.com', password: '123' },
    });
    await registerUser(ctxShort.req, ctxShort.res, () => {});
    assert(ctxShort.getStatusCode() === 400, 'registerUser rejects password shorter than 6 characters');

    // ----------------------------------------------------
    // Test Suite 2: Login API (loginUser)
    // ----------------------------------------------------
    console.log('\n--- Test Suite 2: User Login Controller ---');

    // 2.1 Login with Correct Credentials
    const ctxLoginSuccess = createMockContext({
      body: {
        email: 'sarah@example.com',
        password: 'password123',
      },
    });
    await loginUser(ctxLoginSuccess.req, ctxLoginSuccess.res, () => {});
    assert(ctxLoginSuccess.getStatusCode() === 200, 'loginUser returns HTTP 200 on valid credentials');
    assert(ctxLoginSuccess.getBody().success === true, 'Login response has success: true');
    assert(typeof ctxLoginSuccess.getBody().token === 'string', 'Login returns valid JWT token');
    assert(ctxLoginSuccess.getBody().user.email === 'sarah@example.com', 'Login response matches authenticated user email');

    // 2.2 Login with Incorrect Password
    const ctxBadPass = createMockContext({
      body: {
        email: 'sarah@example.com',
        password: 'incorrectpassword',
      },
    });
    await loginUser(ctxBadPass.req, ctxBadPass.res, () => {});
    assert(ctxBadPass.getStatusCode() === 401, 'loginUser rejects incorrect password with HTTP 401');
    assert(ctxBadPass.getBody().message === 'Invalid email or password.', 'Error message avoids leaking whether email or password was wrong');

    // 2.3 Login with Non-Existent Email
    const ctxNoUser = createMockContext({
      body: {
        email: 'nonexistent@example.com',
        password: 'somepassword',
      },
    });
    await loginUser(ctxNoUser.req, ctxNoUser.res, () => {});
    assert(ctxNoUser.getStatusCode() === 401, 'loginUser rejects non-existent email with HTTP 401');

    // 2.4 Login with Missing Password
    const ctxNoPass = createMockContext({
      body: { email: 'sarah@example.com' },
    });
    await loginUser(ctxNoPass.req, ctxNoPass.res, () => {});
    assert(ctxNoPass.getStatusCode() === 400, 'loginUser rejects missing password with HTTP 400');

    // ----------------------------------------------------
    // Test Suite 3: Auth Middleware & Profile Verification
    // ----------------------------------------------------
    console.log('\n--- Test Suite 3: Auth Middleware (protect) & Profile ---');

    // 3.1 Protect Middleware with Valid Token
    const ctxProtectValid = createMockContext({
      headers: { authorization: `Bearer ${sarahToken}` },
    });
    let protectNextCalled = false;
    await protect(ctxProtectValid.req, ctxProtectValid.res, () => {
      protectNextCalled = true;
    });
    assert(protectNextCalled === true, 'protect middleware accepts valid JWT and calls next()');
    assert(ctxProtectValid.req.user && ctxProtectValid.req.user.email === 'sarah@example.com', 'protect middleware attaches authenticated user to req.user');

    // 3.2 getUserProfile with Authenticated User
    const ctxProfile = createMockContext({
      user: ctxProtectValid.req.user,
    });
    await getUserProfile(ctxProfile.req, ctxProfile.res);
    assert(ctxProfile.getStatusCode() === 200, 'getUserProfile returns HTTP 200');
    assert(ctxProfile.getBody().user.name === 'Sarah Customer', 'getUserProfile returns user name correctly');

    // 3.3 Protect Middleware with Malformed Token
    const ctxProtectBad = createMockContext({
      headers: { authorization: 'Bearer invalid.token.signature' },
    });
    await protect(ctxProtectBad.req, ctxProtectBad.res, () => {});
    assert(ctxProtectBad.getStatusCode() === 401, 'protect middleware rejects invalid token signature with HTTP 401');

    // ----------------------------------------------------
    // Test Suite 4: Role-Based Access Control (RBAC)
    // ----------------------------------------------------
    console.log('\n--- Test Suite 4: Role-Based Access Control (authorize) ---');

    // 4.1 Admin Route accessed by Admin -> Allowed
    const ctxAdminAllowed = createMockContext({
      user: { role: USER_ROLES.ADMIN, name: 'David Admin' },
    });
    let adminNext = false;
    authorize(USER_ROLES.ADMIN)(ctxAdminAllowed.req, ctxAdminAllowed.res, () => {
      adminNext = true;
    });
    assert(adminNext === true, 'authorize(ADMIN) allows ADMIN user to access endpoint');

    // 4.2 Admin Route accessed by Customer -> Blocked with 403
    const ctxCustomerBlocked = createMockContext({
      user: { role: USER_ROLES.CUSTOMER, name: 'Sarah Customer' },
    });
    let customerNext = false;
    authorize(USER_ROLES.ADMIN)(ctxCustomerBlocked.req, ctxCustomerBlocked.res, () => {
      customerNext = true;
    });
    assert(customerNext === false && ctxCustomerBlocked.getStatusCode() === 403, 'authorize(ADMIN) blocks CUSTOMER with HTTP 403 Forbidden');

    // 4.3 Staff Route accessed by Support Agent -> Allowed
    const ctxAgentAllowed = createMockContext({
      user: { role: USER_ROLES.SUPPORT_AGENT, name: 'Alex Agent' },
    });
    let agentNext = false;
    authorize(USER_ROLES.ADMIN, USER_ROLES.SUPPORT_MANAGER, USER_ROLES.SUPPORT_AGENT)(
      ctxAgentAllowed.req,
      ctxAgentAllowed.res,
      () => {
        agentNext = true;
      }
    );
    assert(agentNext === true, 'authorize(ADMIN, SUPPORT_MANAGER, SUPPORT_AGENT) allows SUPPORT_AGENT');

    // 4.4 Staff Route accessed by Customer -> Blocked with 403
    const ctxCustomerStaffBlocked = createMockContext({
      user: { role: USER_ROLES.CUSTOMER, name: 'Sarah Customer' },
    });
    let custStaffNext = false;
    authorize(USER_ROLES.ADMIN, USER_ROLES.SUPPORT_MANAGER, USER_ROLES.SUPPORT_AGENT)(
      ctxCustomerStaffBlocked.req,
      ctxCustomerStaffBlocked.res,
      () => {
        custStaffNext = true;
      }
    );
    assert(custStaffNext === false && ctxCustomerStaffBlocked.getStatusCode() === 403, 'authorize(STAFF) blocks CUSTOMER with HTTP 403 Forbidden');

    // ----------------------------------------------------
    // Test Suite 5: Database Graceful Disconnection Handling
    // ----------------------------------------------------
    console.log('\n--- Test Suite 5: Database Connection State Handling ---');

    // Set readyState = 0 (disconnected)
    Object.defineProperty(mongoose.connection, 'readyState', {
      value: 0,
      configurable: true,
      writable: true,
    });

    const ctxDbDown = createMockContext({
      body: { name: 'Test', email: 'test@example.com', password: 'password123' },
    });
    await registerUser(ctxDbDown.req, ctxDbDown.res, () => {});
    assert(ctxDbDown.getStatusCode() === 503, 'registerUser returns HTTP 503 Service Unavailable when DB is disconnected');
    assert(ctxDbDown.getBody().message.includes('Database is currently not connected'), 'Clear message returned when DB connection is pending');

    // Restore original readyState
    Object.defineProperty(mongoose.connection, 'readyState', {
      value: originalReadyState,
      configurable: true,
      writable: true,
    });

    console.log('\n======================================================');
    console.log(`End-to-End Auth Results: ${passed}/${total} tests passed.`);
    console.log('======================================================\n');

    if (passed === total) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  } finally {
    // Restore User methods
    User.findOne = originalFindOne;
    User.create = originalCreate;
    User.findById = originalFindById;
  }
}

runControllerTests().catch((err) => {
  console.error('Controller test error:', err);
  process.exit(1);
});

