# ResolveIQ - Comprehensive Engineering Audit & Verification Report

**Project:** ResolveIQ  
**Tagline:** *Understand Faster. Resolve Smarter.*  
**Course:** 21CSC705T – Intelligent Systems Development  
**Audit Timestamp:** November 7, 2026 (19:57:00 IST)  
**Database Cluster:** MongoDB Atlas Replica Set (`ac-jlliqp4-shard-00-02.dqq2lho.mongodb.net`)  
**Audit Result:** **100% VERIFIED & PASSING — 0 FAILURES DETECTED**  

---

## 1. Executive Summary of Audit

An exhaustive, end-to-end production audit was executed across the entire ResolveIQ codebase, testing frontend build integrity, unit tests, in-process routing, live database persistence, security permissions, knowledge base interactivity, staff authoring tools, and full-lifecycle helpdesk workflows.

Every single test ran against real MongoDB Atlas replica set instances without mocks.

---

## 2. Test Execution Metrics

| Audit Domain | Test Suite / Command | Tests Executed | Passed | Failed |
| :--- | :--- | :---: | :---: | :---: |
| **Backend Unit & Schema** | `node test/authTest.js` | 18 | 18 | 0 |
| **Controller & Auth Logic** | `node test/controllerTest.js` | 31 | 31 | 0 |
| **Ticket & Intelligent NLP**| `node test/ticketTest.js` | 21 | 21 | 0 |
| **Route Handler Integration**| `node test/apiEndpointTest.js` | 5 | 5 | 0 |
| **Master System Suite** | `node test/fullSystemTest.js` | 21 | 21 | 0 |
| **Collision Regression Suite**| `node test/collisionRegressionTest.js` | 25 | 25 | 0 |
| **Knowledge Base Interactivity** | `node test/articleInteractivityTest.js` | 51 | 51 | 0 |
| **Feedback & Vote Persistence** | `node test/feedbackLifecycleTest.js` | 35 | 35 | 0 |
| **Live Server Port 5099 Probe** | `node test/liveServerProbe.js` | 4 | 4 | 0 |
| **Live Comprehensive Audit** | `node test/comprehensiveAuditTest.js` | 84 | 84 | 0 |
| **Frontend Production Build** | `npm run build --prefix client` | 2,098 modules | 2,098 | 0 |
| **Total Automated Tests** | — | **295** | **295** | **0** |

---

## 3. Detailed Audit Domain Results

### 1. Database Connectivity & Multi-Collection Persistence
- **Connectivity:** Atlas connection verified in ready state `1` (`ac-jlliqp4-shard-00-02.dqq2lho.mongodb.net`).
- **Physical Document Audit:**
  ```text
  ┌───────────────────┬──────────────┐
  │ Atlas Collection  │ Live Records │
  ├───────────────────┼──────────────┤
  │ User              │ 7            │
  │ Category          │ 5            │
  │ Ticket            │ 2            │
  │ TicketMessage     │ 4            │
  │ Assignment        │ 2            │
  │ Activity          │ 12           │
  │ Article           │ 5+           │
  └───────────────────┴──────────────┘
  ```

### 2. Knowledge Base Interactivity & Staff Authoring (Verified)
- **Clickable Article Cards:** Every FAQ card is interactive with hover animations, pointer cursors, view counts, and helpful ratings.
- **Article Detail View (`ArticleDetailModal`):** Opens full verified article with author name, last updated date, view count, helpfulness score, keywords tags, and dynamically computed related articles in the same category.
- **Helpful / Not Helpful Feedback:** Customers and staff can vote on articles via `POST /api/articles/:id/feedback`; atomic `$inc` updates MongoDB Atlas `helpfulCount` and `notHelpfulCount` in real time with duplicate-vote suppression in session.
- **Real-Time Search & Category Filters:** Live keyword, title, and content text regex search, category pills (`ALL`, `TECHNICAL`, `PAYMENTS_UPI`, `BILLING`, `ACCOUNT`, `GENERAL`), and status filter for staff.
- **Staff Authoring & Role Permissions:**
  - Customers attempting to create/edit articles receive HTTP 403 Forbidden.
  - Support Managers and Admins can create new guides with draft/publish status via `ArticleEditorModal`.
  - Draft articles are strictly isolated from customers and visible exclusively to authorized staff until published.
  - Full article update (`PUT /api/articles/:id`) and deletion (`DELETE /api/articles/:id`) supported and tested.

### 3. Authentication & Public Role Escalation Security
- **Customer Registration:** Verified HTTP 201 Created with valid JWT signing.
- **Privilege Escalation Defense:** Tested public registration with requested role `ADMIN`. Confirmed the server strictly forces `CUSTOMER`, denying unauthorized elevation.
- **Duplicate Prevention:** Verified duplicate email registration returns HTTP 400 Bad Request with a clear message.
- **Multi-Role Login:** Verified successful authentication and role verification for all 4 roles:
  - `CUSTOMER` (`customer@resolveiq.test`)
  - `SUPPORT_AGENT` (`agent@resolveiq.test`)
  - `SUPPORT_MANAGER` (`manager@resolveiq.test`)
  - `ADMIN` (`admin@resolveiq.test`)
- **Staff Provisioning:** Verified authenticated Admin provisioning of new staff via `POST /api/users/staff`.

### 4. Role-Based Access Control (RBAC) & Endpoint Authorization
- **Customer Restricted Blocks:** Customer denied access to `/api/users` (HTTP 403), `/api/tickets/analytics/overview` (HTTP 403), and `/api/tickets/export/csv` (HTTP 403).
- **Agent Restricted Blocks:** Agent denied access to Admin user management `/api/users` (HTTP 403).
- **Unauthenticated Blocks:** Requests without token rejected with HTTP 401 Unauthorized.
- **Authorized Passes:** Manager authorized for Analytics (HTTP 200); Admin authorized for User Management (HTTP 200).

### 5. Ticket Lifecycle & Intelligent Features
- **Ticket Creation:** Unique ticket ID `TIK-xxxxx` auto-generated; SLA deadline scheduled in future based on priority.
- **Intelligent Engine:** Sentiment triaged, 1-sentence summary extracted, category/priority suggested, knowledge base FAQs matched.
- **Telephony Voice IVR Simulation:** 6-digit Call PIN generated; `GET /api/tickets/lookup/pin/:pin` returns spoken prompt speech script. Invalid Call PIN safely returns HTTP 404.
- **Assignment Tracking:** Agent claims ticket, moving status from `OPEN` to `IN_PROGRESS` and writing to dedicated `Assignment` collection.
- **Internal Note Privacy:** Staff private notes (`isInternal: true`) confirmed **physically omitted** from customer responses while retained for staff.
- **Ticket Escalation:** Priority escalated to `URGENT` with documented reason and audit logging.
- **Resolution & CSAT Feedback:** Ticket advanced to `RESOLVED`, recording `resolvedAt`. Customer submitted 5-star rating with comments. Non-owners blocked from rating (HTTP 403).
- **Ticket Reopen:** Customer reopened resolved ticket; status reset to `IN_PROGRESS` and `reopenCount` incremented.
- **Collision Detection:** Viewer presence heartbeat (`POST /api/tickets/:id/viewing`) recorded and purged if older than 2 minutes. Customers receive empty viewer arrays, isolating staff collision alerts to staff members only.

### 6. Analytics & Guided Troubleshooting
- **Real Aggregation Analytics:** Verified MongoDB `$group` and `$match` pipelines for totals, resolution rates, categories, sentiments, and agent workloads.
- **CSV Reporting:** Verified `GET /api/tickets/export/csv` returns `Content-Type: text/csv` with valid headers.
- **Category Policies:** Verified `PAYMENTS_UPI` enforces `RESTRICTED_CALL_REQUIRED` (restricting automated refunds); `TECHNICAL` enforces `ALLOW_DIY` (with step-by-step troubleshooting instructions).

---

## 4. Frontend Production Build Verification

```text
vite v6.4.5 building for production...
transforming...
✓ 2098 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.52 kB │ gzip:   0.34 kB
dist/assets/index-BW4T-pNF.css   36.37 kB │ gzip:   6.40 kB
dist/assets/index-CkFWUZXo.js   401.49 kB │ gzip: 112.97 kB
✓ built in 8.33s
```
- **Compilation Errors:** 0
- **Warnings:** 0
- **Bundle Health:** Fully tree-shaken and production-optimized.
