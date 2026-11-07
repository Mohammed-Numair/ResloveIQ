import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User, { USER_ROLES } from '../src/models/User.js';
import { generateToken } from '../src/utils/generateToken.js';
import { protect, authorize } from '../src/middleware/authMiddleware.js';

console.log('🧪 Starting ResolveIQ Phase 1 Authentication Tests...\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
  }
}

async function runTests() {
  // Test 1: User Roles Definition
  console.log('--- Test Suite 1: User Roles ---');
  assert(USER_ROLES.ADMIN === 'ADMIN', 'ADMIN role is defined');
  assert(USER_ROLES.SUPPORT_MANAGER === 'SUPPORT_MANAGER', 'SUPPORT_MANAGER role is defined');
  assert(USER_ROLES.SUPPORT_AGENT === 'SUPPORT_AGENT', 'SUPPORT_AGENT role is defined');
  assert(USER_ROLES.CUSTOMER === 'CUSTOMER', 'CUSTOMER role is defined');

  // Test 2: User Model Schema Validation
  console.log('\n--- Test Suite 2: Schema Validation ---');
  const validUser = new User({
    name: 'Alice Johnson',
    email: 'alice@example.com',
    password: 'securepassword123',
    role: USER_ROLES.CUSTOMER,
  });
  const validErr = validUser.validateSync();
  assert(!validErr, 'Valid user schema validation passes without errors');

  const invalidRoleUser = new User({
    name: 'Bob',
    email: 'bob@example.com',
    password: 'password123',
    role: 'SUPERUSER',
  });
  const invalidRoleErr = invalidRoleUser.validateSync();
  assert(
    invalidRoleErr && invalidRoleErr.errors['role'],
    'Invalid role "SUPERUSER" is rejected by User schema'
  );

  const invalidEmailUser = new User({
    name: 'Charlie',
    email: 'not-an-email',
    password: 'password123',
  });
  const invalidEmailErr = invalidEmailUser.validateSync();
  assert(
    invalidEmailErr && invalidEmailErr.errors['email'],
    'Malformed email address is rejected by User schema'
  );

  const shortPasswordUser = new User({
    name: 'Dan',
    email: 'dan@example.com',
    password: '123',
  });
  const shortPassErr = shortPasswordUser.validateSync();
  assert(
    shortPassErr && shortPassErr.errors['password'],
    'Password with less than 6 characters is rejected'
  );

  // Test 3: Password Hashing & Verification
  console.log('\n--- Test Suite 3: Password Hashing & Verification ---');
  const plainPassword = 'collegeProjectPassword123!';
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(plainPassword, salt);

  assert(hashedPassword !== plainPassword, 'Password is never stored in plain text');
  assert(hashedPassword.startsWith('$2'), 'Password hash uses valid bcrypt format');

  const matchCorrect = await bcrypt.compare(plainPassword, hashedPassword);
  assert(matchCorrect === true, 'bcrypt correctly verifies matching password');

  const matchWrong = await bcrypt.compare('WrongPassword456', hashedPassword);
  assert(matchWrong === false, 'bcrypt rejects non-matching password');

  // Test 4: JWT Token Generation & Verification
  console.log('\n--- Test Suite 4: JWT Token Generation ---');
  process.env.JWT_SECRET = 'test_secret_for_resolveiq_evaluation';
  const testUserId = '654321654321654321654321';
  const token = generateToken(testUserId);

  assert(typeof token === 'string' && token.split('.').length === 3, 'generateToken returns valid 3-part JWT string');

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  assert(decoded.id === testUserId, 'JWT payload correctly decodes the user ID');

  // Test 5: Authorization Middleware
  console.log('\n--- Test Suite 5: Role-Based Authorization Middleware ---');
  
  // Test authorize allows authorized role
  const mockCustomerReq = { user: { role: USER_ROLES.CUSTOMER, name: 'Alice' } };
  let authorizedCalled = false;
  const authMiddlewareCustomer = authorize(USER_ROLES.CUSTOMER, USER_ROLES.ADMIN);
  authMiddlewareCustomer(mockCustomerReq, {}, () => {
    authorizedCalled = true;
  });
  assert(authorizedCalled === true, 'authorize middleware allows user with matching role');

  // Test authorize blocks unauthorized role with 403
  const mockAgentReq = { user: { role: USER_ROLES.SUPPORT_AGENT } };
  let statusResult = null;
  let jsonResult = null;
  const mockRes = {
    status: (code) => {
      statusResult = code;
      return {
        json: (data) => {
          jsonResult = data;
        },
      };
    },
  };
  const authMiddlewareAdminOnly = authorize(USER_ROLES.ADMIN);
  authMiddlewareAdminOnly(mockAgentReq, mockRes, () => {});
  assert(statusResult === 403, 'authorize middleware blocks SUPPORT_AGENT from ADMIN-only route with HTTP 403');
  assert(jsonResult && jsonResult.success === false, '403 response includes success: false message');

  // Test protect middleware rejects missing token with 401
  let protectStatus = null;
  let protectJson = null;
  const mockProtectRes = {
    status: (code) => {
      protectStatus = code;
      return {
        json: (data) => {
          protectJson = data;
        },
      };
    },
  };
  await protect({ headers: {} }, mockProtectRes, () => {});
  assert(protectStatus === 401, 'protect middleware rejects missing Authorization header with HTTP 401');

  // Summary
  console.log('\n=======================================');
  console.log(`Test Results: ${passedTests}/${totalTests} tests passed.`);
  console.log('=======================================\n');

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test suite failed with unexpected error:', err);
  process.exit(1);
});

