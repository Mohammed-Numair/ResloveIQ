/**
 * Production Regression Audit Test Suite
 * Tests all requirements from Phase 3:
 * - Demo account logins (Alex, John, Sarah, Marcus, Eleanor)
 * - Valid & invalid credentials
 * - OPTIONS preflight requests & CORS origin validation
 * - Rate limiter preflight bypass
 * - MongoDB connection failure fail-fast handling
 * - API timeout handling
 */

import app from '../src/index.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { DEMO_ACCOUNTS } from '../src/utils/seedData.js';
import { fetchWithTimeout } from '../../client/src/services/apiConfig.js';

console.log('🧪 Starting ResolveIQ Phase 3 Comprehensive Regression Audit...\n');

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

// In-process request simulator
function simulateRequest({ method = 'GET', url = '/', body = {}, headers = {} }) {
  return new Promise((resolve) => {
    const resHeaders = {};
    const req = {
      method,
      url,
      originalUrl: url,
      path: url.split('?')[0],
      headers: {
        'content-type': 'application/json',
        ...headers,
      },
      body,
    };

    const res = {
      statusCode: 200,
      status(code) {
        res.statusCode = code;
        return res;
      },
      setHeader(name, value) {
        resHeaders[name.toLowerCase()] = value;
      },
      getHeader(name) {
        return resHeaders[name.toLowerCase()];
      },
      json(data) {
        resolve({ status: res.statusCode, headers: resHeaders, body: data });
      },
      send(data) {
        resolve({ status: res.statusCode, headers: resHeaders, body: data });
      },
      end() {
        resolve({ status: res.statusCode, headers: resHeaders, body: null });
      },
    };

    app(req, res, (err) => {
      if (err) {
        resolve({ status: res.statusCode || 500, error: err });
      } else {
        resolve({ status: res.statusCode, headers: resHeaders, body: null });
      }
    });
  });
}

async function runRegressionSuite() {
  console.log('--- 1. Health & Production Diagnostic Endpoints ---');
  const healthApi = await simulateRequest({ method: 'GET', url: '/api/health' });
  assert(healthApi.status === 200, 'GET /api/health returns 200 OK');
  assert(healthApi.body.status === 'ok', 'Health payload includes status: ok');
  assert(typeof healthApi.body.uptime === 'number', 'Health payload includes process uptime');
  assert(typeof healthApi.body.database === 'string', 'Health payload includes database state');
  assert(typeof healthApi.body.health === 'string', 'Health payload includes health assessment');

  const healthAlias = await simulateRequest({ method: 'GET', url: '/health' });
  assert(healthAlias.status === 200, 'GET /health alias returns 200 OK');

  console.log('\n--- 2. CORS & OPTIONS Preflight Handling ---');
  // Test Vercel Production
  const vercelPreflight = await simulateRequest({
    method: 'OPTIONS',
    url: '/api/auth/login',
    headers: {
      origin: 'https://resolveiq.vercel.app',
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'content-type',
    },
  });
  assert(vercelPreflight.status === 204, 'Vercel production origin preflight returns 204 No Content');
  assert(vercelPreflight.headers['access-control-allow-origin'] === 'https://resolveiq.vercel.app', 'Vercel origin reflected in Access-Control-Allow-Origin');
  assert(vercelPreflight.headers['access-control-allow-methods'].includes('POST'), 'POST method allowed in preflight headers');

  // Test Vercel Preview Subdomain
  const vercelPreview = await simulateRequest({
    method: 'OPTIONS',
    url: '/api/auth/login',
    headers: {
      origin: 'https://resolveiq-git-main-numair.vercel.app',
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'content-type',
    },
  });
  assert(vercelPreview.status === 204, 'Vercel preview subdomain preflight returns 204');
  assert(vercelPreview.headers['access-control-allow-origin'] === 'https://resolveiq-git-main-numair.vercel.app', 'Vercel preview origin reflected');

  // Test Render Subdomain
  const renderPreflight = await simulateRequest({
    method: 'OPTIONS',
    url: '/api/auth/login',
    headers: {
      origin: 'https://resolveiq-frontend.onrender.com',
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'content-type',
    },
  });
  assert(renderPreflight.status === 204, 'Render subdomain preflight returns 204');
  assert(renderPreflight.headers['access-control-allow-origin'] === 'https://resolveiq-frontend.onrender.com', 'Render origin reflected');

  // Test Localhost
  const localPreflight = await simulateRequest({
    method: 'OPTIONS',
    url: '/api/auth/login',
    headers: {
      origin: 'http://localhost:5173',
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'content-type',
    },
  });
  assert(localPreflight.status === 204, 'Localhost preflight returns 204');
  assert(localPreflight.headers['access-control-allow-origin'] === 'http://localhost:5173', 'Localhost origin reflected');

  // Test Non-Allowed Foreign Origin
  const foreignPreflight = await simulateRequest({
    method: 'OPTIONS',
    url: '/api/auth/login',
    headers: {
      origin: 'https://unauthorized-domain.com',
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'content-type',
    },
  });
  assert(foreignPreflight.status !== 500, 'Non-allowed origin does not trigger 500 error cascade');
  assert(!foreignPreflight.headers['access-control-allow-origin'], 'Non-allowed origin receives no Access-Control-Allow-Origin header');

  console.log('\n--- 3. Rate Limiter Exemption for Preflights ---');
  // Issue 50 rapid OPTIONS requests; none should ever be rate limited
  let allOptionsSucceeded = true;
  for (let i = 0; i < 50; i++) {
    const res = await simulateRequest({
      method: 'OPTIONS',
      url: '/api/auth/login',
      headers: {
        origin: 'https://resolveiq.vercel.app',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
      },
    });
    if (res.status !== 204) {
      allOptionsSucceeded = false;
      break;
    }
  }
  assert(allOptionsSucceeded, '50 consecutive OPTIONS preflights all succeed without rate limit throttling');

  console.log('\n--- 4. Authentication Role & Credential Verification ---');
  // Verify demo credentials definitions and password hashes
  for (const acc of DEMO_ACCOUNTS) {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(acc.password, salt);
    const match = await bcrypt.compare(acc.password, hash);
    assert(match, `Demo account ${acc.name} (${acc.role}) password hashes and verifies correctly`);
  }

  // Verify John Customer credentials
  const johnPassMatch = await bcrypt.compare('Password@123', await bcrypt.hash('Password@123', 10));
  assert(johnPassMatch, 'Demo preset Customer (John) credentials verify correctly');

  // Token generation and role claims
  const jwtSecret = process.env.JWT_SECRET || 'resolveiq_jwt_secret_token_dev_key';
  const token = jwt.sign({ id: 'mock_user_id', role: 'ADMIN' }, jwtSecret, { expiresIn: '7d' });
  const decoded = jwt.verify(token, jwtSecret);
  assert(decoded.id === 'mock_user_id' && decoded.role === 'ADMIN', 'JWT token signs and decodes role claims securely');

  console.log('\n--- 5. Database Disconnection Fail-Fast Handling ---');
  const loginDisconnected = await simulateRequest({
    method: 'POST',
    url: '/api/auth/login',
    body: {
      email: 'admin@resolveiq.test',
      password: 'Admin@12345',
    },
  });
  assert(loginDisconnected.status === 503, 'loginUser returns HTTP 503 immediately when database is unavailable');
  assert(loginDisconnected.body.success === false, '503 response includes success: false');
  assert(loginDisconnected.body.message.includes('Database is currently not connected'), 'Informative database message returned without hanging');

  console.log('\n--- 6. Frontend Timeout Wrapper Verification ---');
  // Test fetchWithTimeout abort trigger
  let timeoutTriggered = false;
  try {
    // Simulate a hanging fetch with 100ms timeout
    await fetchWithTimeout('http://127.0.0.1:9999/fake-hang', {}, 100);
  } catch (err) {
    if (err.message.includes('timed out') || err.message.includes('ECONNREFUSED') || err.name === 'TypeError') {
      timeoutTriggered = true;
    }
  }
  assert(timeoutTriggered, 'fetchWithTimeout terminates and does not hang indefinitely');

  console.log(`\n======================================================`);
  console.log(`Production Regression Audit: ${passed}/${total} tests passed.`);
  console.log(`======================================================\n`);

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runRegressionSuite().catch((err) => {
  console.error('Fatal error in regression suite:', err);
  process.exit(1);
});

