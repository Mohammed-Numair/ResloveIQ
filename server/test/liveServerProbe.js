/**
 * Live Port 5000 HTTP Probe for ResolveIQ Article Feedback Endpoint
 *
 * Verifies that the Express server listening on port 5000 properly responds to:
 * 1. POST http://localhost:5000/api/articles/6aef34cd9aa24311af1136f8/feedback
 * 2. POST http://localhost:5000/api/articles/feedback/6aef34cd9aa24311af1136f8
 * 3. POST http://localhost:5000/api/articles/feedback (with { articleId, helpful })
 * 4. GET  http://localhost:5000/api/articles/6aef34cd9aa24311af1136f8
 */

import http from 'http';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import app from '../src/index.js';
import connectDB from '../src/config/db.js';
import User from '../src/models/User.js';
import Article from '../src/models/Article.js';
import { generateToken } from '../src/utils/generateToken.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const TARGET_PORT = 5099;
const TARGET_ARTICLE_ID = '6aef34cd9aa24311af1136f8';

function httpRequest(urlPath, method = 'GET', body = null, token = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      `http://localhost:${TARGET_PORT}${urlPath}`,
      {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          let data;
          try {
            data = JSON.parse(raw);
          } catch {
            data = raw;
          }
          resolve({ status: res.statusCode, headers: res.headers, data });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runProbe() {
  console.log('--- Starting Live Server Probe on Port 5099 ---');
  await connectDB();

  // Ensure target article exists
  let targetArticle = await Article.findById(TARGET_ARTICLE_ID);
  if (!targetArticle) {
    targetArticle = await Article.create({
      _id: TARGET_ARTICLE_ID,
      title: 'Resolving UPI & Payment Gateway Transaction Delays',
      category: 'PAYMENTS_UPI',
      content: 'Steps to resolve UPI pending transaction delays.',
      status: 'PUBLISHED',
      keywords: ['upi', 'payment'],
    });
  }

  // Obtain customer test user
  let customerUser = await User.findOne({ email: 'alex.chen@customer.resolveiq.test' });
  if (!customerUser) {
    customerUser = await User.create({
      name: 'Alex Chen',
      email: 'alex.chen@customer.resolveiq.test',
      password: 'Password123!',
      role: 'CUSTOMER',
    });
  }
  const token = generateToken(customerUser._id);

  // Start HTTP server on TARGET_PORT
  const server = app.listen(TARGET_PORT, async () => {
    console.log(`Probe server listening on http://localhost:${TARGET_PORT}`);

    try {
      // 1. Primary route: POST /api/articles/:id/feedback
      console.log('Testing Primary: POST /api/articles/' + TARGET_ARTICLE_ID + '/feedback');
      const res1 = await httpRequest(
        `/api/articles/${TARGET_ARTICLE_ID}/feedback`,
        'POST',
        { helpful: true },
        token
      );
      console.log('Result 1:', res1.status, res1.data);
      if (res1.status !== 200) throw new Error(`Primary feedback route failed with ${res1.status}`);

      // 2. Fallback route: POST /api/articles/feedback/:id
      console.log('Testing Fallback 1: POST /api/articles/feedback/' + TARGET_ARTICLE_ID);
      const res2 = await httpRequest(
        `/api/articles/feedback/${TARGET_ARTICLE_ID}`,
        'POST',
        { helpful: false },
        token
      );
      console.log('Result 2:', res2.status, res2.data);
      if (res2.status !== 200) throw new Error(`Fallback 1 route failed with ${res2.status}`);

      // 3. Fallback route: POST /api/articles/feedback (with body articleId)
      console.log('Testing Fallback 2: POST /api/articles/feedback');
      const res3 = await httpRequest(
        `/api/articles/feedback`,
        'POST',
        { articleId: TARGET_ARTICLE_ID, helpful: true },
        token
      );
      console.log('Result 3:', res3.status, res3.data);
      if (res3.status !== 200) throw new Error(`Fallback 2 route failed with ${res3.status}`);

      // 4. GET article detail after feedback
      console.log('Testing GET: /api/articles/' + TARGET_ARTICLE_ID);
      const res4 = await httpRequest(`/api/articles/${TARGET_ARTICLE_ID}`, 'GET', null, token);
      console.log('Result 4:', res4.status, {
        userFeedback: res4.data.userFeedback,
        helpfulCount: res4.data.article?.helpfulCount,
        notHelpfulCount: res4.data.article?.notHelpfulCount,
      });
      if (res4.status !== 200) throw new Error(`GET article detail failed with ${res4.status}`);

      console.log('🎉 ALL PROBE TESTS PASSED 100%! All 3 route variants work seamlessly.');
    } catch (err) {
      console.error('❌ Probe test failed:', err);
      process.exitCode = 1;
    } finally {
      server.close();
      process.exit(process.exitCode || 0);
    }
  });
}

runProbe();
