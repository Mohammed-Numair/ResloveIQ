import app from '../src/index.js';

console.log('🧪 Starting Express Auth Route Handler Tests (In-Process)...\n');

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

// Simple in-process request simulator for Express app
function simulateRequest({ method = 'GET', url = '/', body = {}, headers = {} }) {
  return new Promise((resolve) => {
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
        resolve({ status: statusCode, body: responseData });
      },
      send(data) {
        responseData = data;
        resolve({ status: statusCode, body: responseData });
      },
      setHeader() {},
      getHeader() {},
    };

    app(req, res, (err) => {
      if (err) {
        resolve({ status: res.statusCode || 500, error: err });
      } else {
        resolve({ status: res.statusCode || 404, body: responseData });
      }
    });
  });
}

async function runTests() {
  // 1. Health check
  const health = await simulateRequest({ method: 'GET', url: '/api/health' });
  assert(health.status === 200 && health.body.status === 'ok', 'GET /api/health returns HTTP 200 and status ok');

  // 2. Protected /api/auth/me without token
  const me = await simulateRequest({ method: 'GET', url: '/api/auth/me' });
  assert(me.status === 401 && me.body.success === false, 'GET /api/auth/me rejects missing token with HTTP 401');

  // 3. Admin only route without token
  const admin = await simulateRequest({ method: 'GET', url: '/api/auth/admin-only' });
  assert(admin.status === 401 && admin.body.success === false, 'GET /api/auth/admin-only rejects missing token with HTTP 401');

  // 4. Staff only route without token
  const staff = await simulateRequest({ method: 'GET', url: '/api/auth/staff-only' });
  assert(staff.status === 401 && staff.body.success === false, 'GET /api/auth/staff-only rejects missing token with HTTP 401');

  // 5. 404 Route handler
  const notFound = await simulateRequest({ method: 'GET', url: '/api/unknown-endpoint' });
  assert(notFound.status === 404, 'Unknown endpoint returns HTTP 404');

  console.log(`\n=======================================`);
  console.log(`In-Process API Tests: ${passed}/${total} tests passed.`);
  console.log(`=======================================\n`);

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
