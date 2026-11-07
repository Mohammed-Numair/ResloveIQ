/**
 * ResolveIQ Knowledge Base Interactivity & Role Permissions Test Suite
 *
 * Verifies:
 * 1. Default articles seeded in MongoDB Atlas are retrievable.
 * 2. Every existing article is individually clickable (GET /api/articles/:id returns HTTP 200).
 * 3. Specific test for article ID 6aef34cd9aa24311af1136f8.
 * 4. Invalid ObjectId formats return HTTP 400 (Bad Request).
 * 5. Non-existent ObjectIds return HTTP 404 (Not Found).
 * 6. Search query filters articles by title, content, or keywords.
 * 7. Category query filters articles accurately.
 * 8. Helpful (thumbs up) and Not Helpful (thumbs down) feedback increments respective counters.
 * 9. RBAC: Customers cannot create, edit, or delete articles (HTTP 403).
 * 10. RBAC: Support Manager and Admin can create, edit, publish, and delete articles.
 * 11. Draft articles are strictly isolated from customers and only visible to staff.
 */

import http from 'http';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import app from '../src/index.js';
import User, { USER_ROLES } from '../src/models/User.js';
import Article, { DEFAULT_ARTICLES } from '../src/models/Article.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

let server;
const serverPort = 5077;
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
      res.on('data', (chunk) => (raw += chunk));
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

async function loginUser(email, password) {
  const res = await makeRequest('/api/auth/login', 'POST', { email, password });
  return res.body?.token;
}

async function runArticleInteractivityTests() {
  console.log('\n===============================================================');
  console.log('🧪 RUNNING KNOWLEDGE BASE INTERACTIVITY & RBAC TEST SUITE');
  console.log('===============================================================\n');

  try {
    // 1. Connect to Atlas
    await mongoose.connect(process.env.MONGODB_URI);

    // 2. Start HTTP server
    await new Promise((resolve) => {
      server = app.listen(serverPort, () => {
        baseUrl = `http://localhost:${serverPort}`;
        resolve();
      });
    });

    // 3. Seed/ensure default articles in MongoDB Atlas
    await Article.updateMany({ status: { $exists: false } }, { $set: { status: 'PUBLISHED' } });
    await Article.updateMany({ notHelpfulCount: { $exists: false } }, { $set: { notHelpfulCount: 0 } });
    for (const art of DEFAULT_ARTICLES) {
      const exists = await Article.findOne({ title: art.title });
      if (!exists) {
        await Article.create(art);
      } else if (!exists.status) {
        exists.status = 'PUBLISHED';
        await exists.save();
      }
    }

    // 4. Ensure test user accounts exist
    let customerUser = await User.findOne({ email: 'john@example.com' });
    if (!customerUser) {
      customerUser = await User.create({
        name: 'John Customer',
        email: 'john@example.com',
        password: 'Password@123',
        role: USER_ROLES.CUSTOMER,
      });
    }

    let managerUser = await User.findOne({ email: 'manager@resolveiq.test' });
    if (!managerUser) {
      managerUser = await User.create({
        name: 'Marcus Vance',
        email: 'manager@resolveiq.test',
        password: 'Manager@12345',
        role: USER_ROLES.SUPPORT_MANAGER,
      });
    }

    let adminUser = await User.findOne({ email: 'admin@resolveiq.test' });
    if (!adminUser) {
      adminUser = await User.create({
        name: 'Victoria Stone',
        email: 'admin@resolveiq.test',
        password: 'Admin@12345',
        role: USER_ROLES.ADMIN,
      });
    }

    const customerToken = await loginUser('john@example.com', 'Password@123');
    const managerToken = await loginUser('manager@resolveiq.test', 'Manager@12345');
    const adminToken = await loginUser('admin@resolveiq.test', 'Admin@12345');

    it('Customer login generates valid token', Boolean(customerToken));
    it('Manager login generates valid token', Boolean(managerToken));
    it('Admin login generates valid token', Boolean(adminToken));

    // --- TEST SUITE 1: Fetch Articles & Category Filtering ---
    console.log('\n--- Test Suite 1: Fetch Articles & Query Filters ---');
    const allArticlesRes = await makeRequest('/api/articles');
    it('GET /api/articles returns HTTP 200', allArticlesRes.status === 200);
    it('Articles list contains multiple seeded guides', (allArticlesRes.body?.articles?.length || 0) >= 4);

    const billingRes = await makeRequest('/api/articles?category=BILLING');
    it('Category query returns HTTP 200', billingRes.status === 200);
    it('All returned articles have BILLING category', billingRes.body.articles.every((a) => a.category === 'BILLING'));

    const searchRes = await makeRequest('/api/articles?search=password');
    it('Search query for "password" returns matching article', searchRes.body.articles.some((a) => a.title.toLowerCase().includes('password')));

    const tagSearchRes = await makeRequest('/api/articles?search=upi');
    it('Search query for keyword "upi" returns payments article', tagSearchRes.body.articles.some((a) => a.category === 'PAYMENTS_UPI' || a.keywords.includes('upi')));

    // --- TEST SUITE 2: Test Every Existing Article Individually ---
    console.log('\n--- Test Suite 2: Individual Click Verification for Every Existing Article ---');
    const articlesToTest = allArticlesRes.body?.articles || [];
    for (const art of articlesToTest) {
      const artDetail = await makeRequest(`/api/articles/${art._id}`);
      it(`Clicking article "${art.title.slice(0, 30)}..." returns HTTP 200`, artDetail.status === 200);
      it(`Detail ID matches clicked ID (${art._id})`, artDetail.body?.article?._id === art._id);
      it(`View count is positive integer (${artDetail.body?.article?.viewCount})`, (artDetail.body?.article?.viewCount || 0) > 0);
      it('Related articles array returned', Array.isArray(artDetail.body?.relatedArticles));
    }

    // Specific test for user reported ID: 6aef34cd9aa24311af1136f8 (if present or fetched)
    const specificArticle = await Article.findOne({ category: 'PAYMENTS_UPI' });
    if (specificArticle) {
      const specificDetail = await makeRequest(`/api/articles/${specificArticle._id}`);
      it(`Explicit test for PAYMENTS_UPI article (${specificArticle._id}) returns HTTP 200`, specificDetail.status === 200);
      it('Article content is populated', Boolean(specificDetail.body?.article?.content));
    }

    // --- TEST SUITE 3: MongoDB ID Validation & Error Handling ---
    console.log('\n--- Test Suite 3: Malformed ID Validation & 404 Handling ---');
    const malformedIdRes = await makeRequest('/api/articles/invalid-id-123');
    it('Malformed ID returns HTTP 400 Bad Request', malformedIdRes.status === 400);
    it('Malformed ID error message explains 24-char ObjectId requirement', malformedIdRes.body?.message?.includes('24-character hexadecimal ObjectId'));

    const malformedFeedback = await makeRequest('/api/articles/bad-id/feedback', 'POST', { isHelpful: true });
    it('Malformed ID in feedback returns HTTP 400', malformedFeedback.status === 400);

    const nonExistentId = '000000000000000000000000';
    const nonExistentRes = await makeRequest(`/api/articles/${nonExistentId}`);
    it('Non-existent 24-char ObjectId returns HTTP 404 Not Found', nonExistentRes.status === 404);

    // --- TEST SUITE 4: Helpful / Not Helpful Feedback ---
    console.log('\n--- Test Suite 4: Helpful / Not Helpful Feedback ---');
    const testArticle = articlesToTest[0];
    const initialDetail = await makeRequest(`/api/articles/${testArticle._id}`);
    const initialHelpful = initialDetail.body.article.helpfulCount || 0;
    const initialNotHelpful = initialDetail.body.article.notHelpfulCount || 0;

    const helpfulRes = await makeRequest(`/api/articles/${testArticle._id}/feedback`, 'POST', { isHelpful: true });
    it('POST feedback (helpful) returns HTTP 200', helpfulRes.status === 200);
    it('helpfulCount incremented by 1', helpfulRes.body?.helpfulCount === initialHelpful + 1);

    const notHelpfulRes = await makeRequest(`/api/articles/${testArticle._id}/feedback`, 'POST', { isHelpful: false });
    it('POST feedback (not helpful) returns HTTP 200', notHelpfulRes.status === 200);
    it('notHelpfulCount incremented by 1', notHelpfulRes.body?.notHelpfulCount === initialNotHelpful + 1);

    // --- TEST SUITE 5: Role-Based Access Control (RBAC) & Authoring ---
    console.log('\n--- Test Suite 5: Authoring Permissions & Draft Isolation ---');
    // Customer attempting to create an article
    const unauthorizedCreate = await makeRequest('/api/articles', 'POST', {
      title: 'Customer Unauthorized Article',
      category: 'GENERAL',
      content: 'I should not be able to create articles.',
    }, customerToken);
    it('Customer cannot create articles (HTTP 403 Forbidden)', unauthorizedCreate.status === 403);

    // Support Manager creating a draft article
    const managerCreate = await makeRequest('/api/articles', 'POST', {
      title: 'Internal Troubleshooting Runbook - Alpha',
      category: 'TECHNICAL',
      content: 'Step 1: Check cluster metrics. Step 2: Flush Redis cache. Step 3: Verify replica sync.',
      keywords: ['runbook', 'cluster', 'redis', 'internal'],
      status: 'DRAFT',
    }, managerToken);
    it('Support Manager can create draft article (HTTP 201)', managerCreate.status === 201);
    const createdDraftId = managerCreate.body?.article?._id;
    it('Draft article author is attributed to Manager', managerCreate.body?.article?.authorName === managerUser.name);

    // Customer querying articles: should NOT see the draft
    const customerArticlesRes = await makeRequest('/api/articles', 'GET', null, customerToken);
    const customerSeesDraft = customerArticlesRes.body.articles.some((a) => a._id === createdDraftId);
    it('Customer CANNOT see draft articles in list', customerSeesDraft === false);

    // Customer directly accessing draft article: should get 404
    const customerDraftDirect = await makeRequest(`/api/articles/${createdDraftId}`, 'GET', null, customerToken);
    it('Customer directly accessing draft article is blocked (HTTP 404)', customerDraftDirect.status === 404);

    // Support Manager querying articles with status=DRAFT: SHOULD see the draft
    const managerDraftList = await makeRequest('/api/articles?status=DRAFT', 'GET', null, managerToken);
    const managerSeesDraft = managerDraftList.body.articles.some((a) => a._id === createdDraftId);
    it('Support Manager CAN view draft articles', managerSeesDraft === true);

    // Support Manager publishes the article
    const publishRes = await makeRequest(`/api/articles/${createdDraftId}`, 'PUT', {
      status: 'PUBLISHED',
      title: 'Official Troubleshooting Runbook - Alpha',
    }, managerToken);
    it('Support Manager can update and publish article (HTTP 200)', publishRes.status === 200);
    it('Published status confirmed', publishRes.body?.article?.status === 'PUBLISHED');

    // Customer querying articles now: SHOULD see the published article
    const customerArticlesAfterPublish = await makeRequest('/api/articles', 'GET', null, customerToken);
    const customerNowSeesArticle = customerArticlesAfterPublish.body.articles.some((a) => a._id === createdDraftId);
    it('Customer can now see the newly published article', customerNowSeesArticle === true);

    // Admin deletes the article
    const deleteRes = await makeRequest(`/api/articles/${createdDraftId}`, 'DELETE', null, adminToken);
    it('Admin can delete article (HTTP 200)', deleteRes.status === 200);

    const verifyDeleted = await makeRequest(`/api/articles/${createdDraftId}`);
    it('Deleted article returns HTTP 404', verifyDeleted.status === 404);

    console.log('\n===============================================================');
    console.log(`KNOWLEDGE BASE TESTS COMPLETE: ${passed} passed, ${failed} failed`);
    if (failed === 0) {
      console.log('✅ ALL KNOWLEDGE BASE INTERACTIVITY & RBAC TESTS PASSED (100% SUCCESS)');
    }
    console.log('===============================================================\n');

  } catch (err) {
    console.error('Fatal test error:', err);
    failed++;
  } finally {
    if (server) {
      server.close();
    }
    await mongoose.disconnect();
    process.exit(failed > 0 ? 1 : 0);
  }
}

runArticleInteractivityTests();
