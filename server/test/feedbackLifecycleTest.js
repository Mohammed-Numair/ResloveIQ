/**
 * ResolveIQ Knowledge Base Feedback Lifecycle & User Vote Persistence Test
 *
 * Requirements Tested:
 * 1. Unauthorized request rejected (HTTP 401).
 * 2. User 1 submits Yes (helpful: true) -> counts update.
 * 3. Refresh simulation (GET /api/articles/:id) returns userFeedback: 'helpful'.
 * 4. Duplicate prevention -> submitting same vote does not inflate counts.
 * 5. Vote changing -> User 1 changes vote to No (helpful: false) -> counts adjust.
 * 6. Refresh simulation -> GET returns userFeedback: 'not_helpful'.
 * 7. Multi-user isolation -> User 2 votes Yes -> both votes recorded in DB.
 * 8. Direct MongoDB document inspection confirms accurate persistent feedback records.
 * 9. Validation: Malformed ID returns 400, missing body returns 400, non-existent returns 404.
 * 10. Security: Customers cannot rate unpublished DRAFT articles (HTTP 403).
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
const serverPort = 5082;
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

async function runFeedbackTests() {
  console.log('\n===============================================================');
  console.log('🧪 RUNNING KNOWLEDGE BASE FEEDBACK & VOTE PERSISTENCE TEST');
  console.log('===============================================================\n');

  try {
    await mongoose.connect(process.env.MONGODB_URI);

    await new Promise((resolve) => {
      server = app.listen(serverPort, () => {
        baseUrl = `http://localhost:${serverPort}`;
        resolve();
      });
    });

    // Ensure test users
    let alex = await User.findOne({ email: 'customer@resolveiq.test' });
    if (!alex) {
      alex = await User.create({
        name: 'Alex Rivera',
        email: 'customer@resolveiq.test',
        password: 'Customer@12345',
        role: USER_ROLES.CUSTOMER,
      });
    }

    let john = await User.findOne({ email: 'john@example.com' });
    if (!john) {
      john = await User.create({
        name: 'John Customer',
        email: 'john@example.com',
        password: 'Password@123',
        role: USER_ROLES.CUSTOMER,
      });
    }

    let manager = await User.findOne({ email: 'manager@resolveiq.test' });
    if (!manager) {
      manager = await User.create({
        name: 'Marcus Chen',
        email: 'manager@resolveiq.test',
        password: 'Manager@12345',
        role: USER_ROLES.SUPPORT_MANAGER,
      });
    }

    const alexToken = await loginUser('customer@resolveiq.test', 'Customer@12345');
    const johnToken = await loginUser('john@example.com', 'Password@123');
    const managerToken = await loginUser('manager@resolveiq.test', 'Manager@12345');

    it('Alex token acquired', Boolean(alexToken));
    it('John token acquired', Boolean(johnToken));
    it('Manager token acquired', Boolean(managerToken));

    // Create a fresh test article to test feedback in isolation
    const testArticle = await Article.create({
      title: 'Feedback Test Guide ' + Date.now(),
      category: 'TECHNICAL',
      content: 'This guide tests feedback voting and persistence in MongoDB Atlas.',
      keywords: ['feedback', 'test', 'voting'],
      status: 'PUBLISHED',
      authorName: 'QA Test Runner',
      feedback: [],
      helpfulCount: 0,
      notHelpfulCount: 0,
    });
    const articleId = testArticle._id.toString();

    // 1. Unauthenticated request rejected
    console.log('\n--- Step 1: Authentication Enforcement ---');
    const unauthRes = await makeRequest(`/api/articles/${articleId}/feedback`, 'POST', { helpful: true });
    it('Unauthenticated feedback rejected with HTTP 401', unauthRes.status === 401);

    // 2. Malformed ID and missing body
    console.log('\n--- Step 2: Request Validation ---');
    const malformedIdRes = await makeRequest('/api/articles/invalid-id/feedback', 'POST', { helpful: true }, alexToken);
    it('Malformed article ID returns HTTP 400', malformedIdRes.status === 400);

    const missingBodyRes = await makeRequest(`/api/articles/${articleId}/feedback`, 'POST', {}, alexToken);
    it('Missing helpful field returns HTTP 400', missingBodyRes.status === 400);

    const nonExistentRes = await makeRequest('/api/articles/000000000000000000000000/feedback', 'POST', { helpful: true }, alexToken);
    it('Non-existent article returns HTTP 404', nonExistentRes.status === 404);

    // 3. User 1 (Alex) votes Yes (helpful: true)
    console.log('\n--- Step 3: User 1 Votes Yes (Helpful) ---');
    const alexVoteYes = await makeRequest(`/api/articles/${articleId}/feedback`, 'POST', { helpful: true }, alexToken);
    it('Alex vote Yes returns HTTP 200', alexVoteYes.status === 200);
    it('helpfulCount is 1', alexVoteYes.body?.helpfulCount === 1);
    it('notHelpfulCount is 0', alexVoteYes.body?.notHelpfulCount === 0);
    it('userFeedback is "helpful"', alexVoteYes.body?.userFeedback === 'helpful');
    it('action is "new"', alexVoteYes.body?.action === 'new');

    // 4. Refresh simulation for Alex
    console.log('\n--- Step 4: Refresh Simulation (Preserve Vote for Alex) ---');
    const alexRefresh1 = await makeRequest(`/api/articles/${articleId}`, 'GET', null, alexToken);
    it('GET /api/articles/:id returns HTTP 200 after refresh', alexRefresh1.status === 200);
    it('Alex sees saved userFeedback: "helpful"', alexRefresh1.body?.userFeedback === 'helpful');
    it('Article helpfulCount persisted as 1', alexRefresh1.body?.article?.helpfulCount === 1);

    // 5. Duplicate submission prevention
    console.log('\n--- Step 5: Duplicate Prevention (No Count Inflation) ---');
    const alexDuplicateYes = await makeRequest(`/api/articles/${articleId}/feedback`, 'POST', { helpful: true }, alexToken);
    it('Submitting same vote returns HTTP 200', alexDuplicateYes.status === 200);
    it('helpfulCount remains 1 (did not inflate)', alexDuplicateYes.body?.helpfulCount === 1);
    it('action is "unchanged"', alexDuplicateYes.body?.action === 'unchanged');

    // 6. User 1 changes vote to No (helpful: false)
    console.log('\n--- Step 6: User 1 Changes Vote to No (Not Helpful) ---');
    const alexChangeNo = await makeRequest(`/api/articles/${articleId}/feedback`, 'POST', { helpful: false }, alexToken);
    it('Alex changing vote returns HTTP 200', alexChangeNo.status === 200);
    it('helpfulCount decremented to 0', alexChangeNo.body?.helpfulCount === 0);
    it('notHelpfulCount incremented to 1', alexChangeNo.body?.notHelpfulCount === 1);
    it('userFeedback updated to "not_helpful"', alexChangeNo.body?.userFeedback === 'not_helpful');
    it('action is "updated"', alexChangeNo.body?.action === 'updated');

    // 7. Refresh simulation after vote change
    console.log('\n--- Step 7: Refresh Simulation After Vote Change ---');
    const alexRefresh2 = await makeRequest(`/api/articles/${articleId}`, 'GET', null, alexToken);
    it('Alex sees updated userFeedback: "not_helpful" after refresh', alexRefresh2.body?.userFeedback === 'not_helpful');
    it('Persisted notHelpfulCount is 1', alexRefresh2.body?.article?.notHelpfulCount === 1);

    // 8. User 2 (John) votes Yes
    console.log('\n--- Step 8: User 2 (John) Submits Vote ---');
    const johnCheckBeforeVote = await makeRequest(`/api/articles/${articleId}`, 'GET', null, johnToken);
    it('John has userFeedback: null before voting', johnCheckBeforeVote.body?.userFeedback === null);

    const johnVoteYes = await makeRequest(`/api/articles/${articleId}/feedback`, 'POST', { helpful: true }, johnToken);
    it('John voting Yes returns HTTP 200', johnVoteYes.status === 200);
    it('helpfulCount is now 1 (John)', johnVoteYes.body?.helpfulCount === 1);
    it('notHelpfulCount remains 1 (Alex)', johnVoteYes.body?.notHelpfulCount === 1);

    const johnRefresh = await makeRequest(`/api/articles/${articleId}`, 'GET', null, johnToken);
    it('John sees userFeedback: "helpful"', johnRefresh.body?.userFeedback === 'helpful');

    // 9. Direct MongoDB record verification
    console.log('\n--- Step 9: MongoDB Document Audit ---');
    const dbDoc = await Article.findById(articleId);
    it('Article exists in MongoDB Atlas', Boolean(dbDoc));
    it('MongoDB Atlas feedback array has exactly 2 records', dbDoc?.feedback?.length === 2);
    it('MongoDB Atlas helpfulCount is exactly 1', dbDoc?.helpfulCount === 1);
    it('MongoDB Atlas notHelpfulCount is exactly 1', dbDoc?.notHelpfulCount === 1);

    // 10. Security: Non-staff cannot rate unpublished DRAFT articles
    console.log('\n--- Step 10: Draft Rating Access Control ---');
    const draftArticle = await Article.create({
      title: 'Draft Runbook ' + Date.now(),
      category: 'TECHNICAL',
      content: 'Internal draft content.',
      status: 'DRAFT',
      authorName: 'Marcus Chen',
    });
    const draftVoteRes = await makeRequest(`/api/articles/${draftArticle._id}/feedback`, 'POST', { helpful: true }, alexToken);
    it('Customer cannot rate unpublished draft (HTTP 403 Forbidden)', draftVoteRes.status === 403);

    // Clean up test articles
    await Article.findByIdAndDelete(articleId);
    await Article.findByIdAndDelete(draftArticle._id);

    console.log('\n===============================================================');
    console.log(`FEEDBACK TESTS COMPLETE: ${passed} passed, ${failed} failed`);
    if (failed === 0) {
      console.log('✅ ALL KNOWLEDGE BASE FEEDBACK & PERSISTENCE TESTS PASSED (100% SUCCESS)');
    }
    console.log('===============================================================\n');

  } catch (err) {
    console.error('Fatal test error:', err);
    failed++;
  } finally {
    if (server) server.close();
    await mongoose.disconnect();
    process.exit(failed > 0 ? 1 : 0);
  }
}

runFeedbackTests();

