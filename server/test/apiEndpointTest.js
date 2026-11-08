import app from '../src/index.js';

console.log('🧪 Starting Express Auth & Production Route Handler Tests (In-Process)...\n');

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

    const resHeaders = {};

    const res = {
      statusCode: 200,
      status(code) {
        statusCode = code;
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
        responseData = data;
        resolve({ status: res.statusCode, headers: resHeaders, body: responseData });
      },
      send(data) {
        responseData = data;
        resolve({ status: res.statusCode, headers: resHeaders, body: responseData });
      },
      end() {
        resolve({ status: res.statusCode, headers: resHeaders, body: responseData });
      },
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
  // 1. Primary Health check (/api/health)
  const health = await simulateRequest({ method: 'GET', url: '/api/health' });
  assert(health.status === 200 && health.body.status === 'ok', 'GET /api/health returns HTTP 200 and status ok');

  // 2. Production Health check alias (/health)
  const healthAlias = await simulateRequest({ method: 'GET', url: '/health' });
  assert(healthAlias.status === 200 && healthAlias.body.status === 'ok', 'GET /health alias returns HTTP 200 and status ok');

  // 3. API Root endpoint (/)
  const root = await simulateRequest({ method: 'GET', url: '/' });
  assert(root.status === 200 && root.body.status === 'ok', 'GET / returns HTTP 200 with online status and endpoint map');

  // 4. Protected /api/auth/me without token
  const me = await simulateRequest({ method: 'GET', url: '/api/auth/me' });
  assert(me.status === 401 && me.body.success === false, 'GET /api/auth/me rejects missing token with HTTP 401');

  // 5. Admin only route without token
  const admin = await simulateRequest({ method: 'GET', url: '/api/auth/admin-only' });
  assert(admin.status === 401 && admin.body.success === false, 'GET /api/auth/admin-only rejects missing token with HTTP 401');

  // 6. Staff only route without token
  const staff = await simulateRequest({ method: 'GET', url: '/api/auth/staff-only' });
  assert(staff.status === 401 && staff.body.success === false, 'GET /api/auth/staff-only rejects missing token with HTTP 401');

  // 7. 404 Route handler
  const notFound = await simulateRequest({ method: 'GET', url: '/api/unknown-endpoint' });
  assert(notFound.status === 404, 'Unknown endpoint returns HTTP 404');

  // 8. Health check diagnostic fields
  assert(typeof health.body.uptime === 'number', 'GET /api/health includes process uptime');
  assert(typeof health.body.database === 'string', 'GET /api/health includes database status');

  // 9. CORS Preflight OPTIONS /api/auth/login with Vercel origin
  const vercelPreflight = await simulateRequest({
    method: 'OPTIONS',
    url: '/api/auth/login',
    headers: {
      origin: 'https://resolveiq.vercel.app',
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'content-type',
    },
  });
  assert(vercelPreflight.status === 204, 'OPTIONS /api/auth/login from Vercel origin returns HTTP 204 No Content');
  assert(vercelPreflight.headers['access-control-allow-origin'] === 'https://resolveiq.vercel.app', 'Vercel preflight reflects allowed Access-Control-Allow-Origin');
  assert(vercelPreflight.headers['access-control-allow-methods'].includes('POST'), 'Vercel preflight permits POST method');

  // 10. CORS Preflight OPTIONS /api/auth/login with Localhost origin
  const localPreflight = await simulateRequest({
    method: 'OPTIONS',
    url: '/api/auth/login',
    headers: {
      origin: 'http://localhost:5173',
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'content-type',
    },
  });
  assert(localPreflight.status === 204, 'OPTIONS /api/auth/login from Localhost returns HTTP 204');
  assert(localPreflight.headers['access-control-allow-origin'] === 'http://localhost:5173', 'Localhost preflight reflects Access-Control-Allow-Origin');

  // 11. CORS Preflight OPTIONS /api/auth/login with Render origin
  const renderPreflight = await simulateRequest({
    method: 'OPTIONS',
    url: '/api/auth/login',
    headers: {
      origin: 'https://resolveiq-client.onrender.com',
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'content-type',
    },
  });
  assert(renderPreflight.status === 204, 'OPTIONS /api/auth/login from Render subdomain returns HTTP 204');
  assert(renderPreflight.headers['access-control-allow-origin'] === 'https://resolveiq-client.onrender.com', 'Render preflight reflects Access-Control-Allow-Origin');

  // 12. Non-allowed origin does not throw 500 crash
  const foreignPreflight = await simulateRequest({
    method: 'OPTIONS',
    url: '/api/auth/login',
    headers: {
      origin: 'https://malicious-site.example.com',
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'content-type',
    },
  });
  assert(foreignPreflight.status !== 500, 'Non-allowed origin preflight does not trigger HTTP 500 crash');
  assert(!foreignPreflight.headers['access-control-allow-origin'], 'Non-allowed origin does not receive Access-Control-Allow-Origin');

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
