# ResolveIQ - Backend REST API Specification & Endpoint Inventory

> **ResolveIQ – Understand Faster. Resolve Smarter.**  
> Course: **21CSC705T – Intelligent Systems Development**  
> Architecture: **RESTful Express.js / Node.js with MongoDB Atlas Mongoose ODM**  
> Base URL: `http://localhost:5000/api`  
> Authentication Scheme: `Bearer <JWT_TOKEN>` via HTTP Authorization header

---

## 1. System Health & Diagnostics

### `GET /api/health`
- **Description:** Verifies that the Express API server is operational.
- **Authentication:** Public (No token required)
- **Request Parameters / Body:** None
- **Response Format:**
  ```json
  {
    "status": "ok",
    "message": "ResolveIQ Backend API is running",
    "timestamp": "2026-11-07T15:00:00.000Z"
  }
  ```
- **HTTP Status Codes:** `200 OK`

---

## 2. Authentication & User Profile (`/api/auth`)

### `POST /api/auth/register`
- **Description:** Public registration endpoint. Always provisions an account with the `CUSTOMER` role. Role escalation attempts (e.g. requesting `ADMIN`) are safely overridden by security middleware.
- **Authentication:** Public
- **Request Body:**
  ```json
  {
    "name": "Jane Customer",
    "email": "jane@customer.test",
    "password": "Password123!"
  }
  ```
- **Response Format:**
  ```json
  {
    "success": true,
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "672...",
      "name": "Jane Customer",
      "email": "jane@customer.test",
      "role": "CUSTOMER"
    }
  }
  ```
- **HTTP Status Codes:** `201 Created`, `400 Bad Request` (duplicate email or validation failure), `503 Service Unavailable` (DB offline).

### `POST /api/auth/login`
- **Description:** Authenticates user credentials and returns signed JWT token.
- **Authentication:** Public
- **Request Body:**
  ```json
  {
    "email": "customer@resolveiq.test",
    "password": "Customer@12345"
  }
  ```
- **Response Format:**
  ```json
  {
    "success": true,
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "672...",
      "name": "Alex Rivera",
      "email": "customer@resolveiq.test",
      "role": "CUSTOMER"
    }
  }
  ```
- **HTTP Status Codes:** `200 OK`, `401 Unauthorized` (invalid credentials).

### `GET /api/auth/me`
- **Description:** Returns the profile of the currently authenticated session.
- **Authentication:** `protect` (All authenticated roles)
- **Response Format:**
  ```json
  {
    "success": true,
    "user": {
      "_id": "672...",
      "name": "Alex Rivera",
      "email": "customer@resolveiq.test",
      "role": "CUSTOMER"
    }
  }
  ```
- **HTTP Status Codes:** `200 OK`, `401 Unauthorized`.

---

## 3. Support Tickets (`/api/tickets`)

### `POST /api/tickets`
- **Description:** Creates a new support ticket. Automatically executes Intelligent NLP Triage (Gemini AI or fallback rules), assigns priority, schedules SLA deadline, generates a random 6-digit Telephony Call PIN, and logs creation in `Activity` collection.
- **Authentication:** `protect` (All authenticated roles)
- **Request Body:**
  ```json
  {
    "title": "UPI Payment Debited But Order Not Confirmed",
    "description": "PhonePe transaction debited INR 1,499. UTR 428910293847.",
    "category": "PAYMENTS_UPI",
    "priority": "HIGH",
    "attachments": [
      {
        "name": "screenshot.png",
        "url": "data:image/png;base64,...",
        "fileType": "image/png",
        "size": 1024
      }
    ]
  }
  ```
- **Response Format:**
  ```json
  {
    "success": true,
    "message": "Support ticket submitted successfully.",
    "ticket": {
      "_id": "672...",
      "ticketId": "TIK-18275",
      "callPin": "766392",
      "title": "UPI Payment Debited But Order Not Confirmed",
      "status": "OPEN",
      "priority": "HIGH",
      "category": "PAYMENTS_UPI",
      "slaDeadline": "2026-11-08T03:00:00.000Z",
      "aiMetadata": {
        "sentiment": "URGENT",
        "suggestedCategory": "PAYMENTS_UPI",
        "suggestedPriority": "URGENT",
        "summary": "Customer reported UPI payment failure.",
        "suggestedReply": "Hello, thank you for reaching out..."
      }
    }
  }
  ```
- **HTTP Status Codes:** `201 Created`, `400 Bad Request`.

### `GET /api/tickets`
- **Description:** Returns tickets filtered by status, priority, category, search query, or queue. Scoped by role: Customers only receive their own tickets; Agents toggle `myQueue=true`.
- **Authentication:** `protect`
- **Query Parameters:** `status`, `priority`, `category`, `search`, `myQueue`
- **HTTP Status Codes:** `200 OK`.

### `GET /api/tickets/:id`
- **Description:** Retrieves ticket details and timeline. Role isolation: Customers strictly receive public messages (`isInternal: false`) and empty viewer arrays. Staff members receive internal notes and active staff collision alerts.
- **Authentication:** `protect`
- **HTTP Status Codes:** `200 OK`, `403 Forbidden` (customer accessing another customer's ticket), `404 Not Found`.

### `PUT /api/tickets/:id/status`
- **Description:** Updates status (`OPEN`, `IN_PROGRESS`, `PENDING_CUSTOMER`, `RESOLVED`, `CLOSED`). Sets `resolvedAt` on resolution.
- **Authentication:** `protect`, `authorize('SUPPORT_AGENT', 'SUPPORT_MANAGER', 'ADMIN')`
- **Request Body:** `{ "status": "RESOLVED" }`
- **HTTP Status Codes:** `200 OK`, `400 Bad Request`, `403 Forbidden`, `404 Not Found`.

### `PUT /api/tickets/:id/assign`
- **Description:** Reassigns ticket to target agent. Auto-advances `OPEN` ticket to `IN_PROGRESS`. Records record in `Assignment` collection. Support Agents can self-claim. Managers and Admins can assign any staff member.
- **Authentication:** `protect`, `authorize('SUPPORT_AGENT', 'SUPPORT_MANAGER', 'ADMIN')`
- **Request Body:** `{ "agentId": "672..." }`
- **HTTP Status Codes:** `200 OK`, `400 Bad Request`, `403 Forbidden`.

### `POST /api/tickets/:id/messages`
- **Description:** Adds public customer reply or private staff whisper note (`isInternal: true`). Supports multimodal file attachments.
- **Authentication:** `protect` (Customers can post public replies to own tickets; only staff can post `isInternal: true`).
- **Request Body:**
  ```json
  {
    "message": "We have reconciled your transaction.",
    "isInternal": false,
    "attachments": []
  }
  ```
- **HTTP Status Codes:** `201 Created`, `400 Bad Request`, `403 Forbidden`.

### `PUT /api/tickets/:id/rate`
- **Description:** Submits customer satisfaction (CSAT) rating on resolved ticket.
- **Authentication:** `protect` (CUSTOMER owner only)
- **Request Body:** `{ "score": 5, "comment": "Excellent support!" }`
- **HTTP Status Codes:** `200 OK`, `400 Bad Request` (score out of 1-5 or un-resolved ticket), `403 Forbidden`.

### `PUT /api/tickets/:id/reopen`
- **Description:** Reopens a resolved/closed ticket with documented customer reason. Status resets to `IN_PROGRESS` and `reopenCount` increments.
- **Authentication:** `protect` (CUSTOMER owner or Staff)
- **Request Body:** `{ "reason": "Issue occurred again" }`
- **HTTP Status Codes:** `200 OK`, `400 Bad Request`, `403 Forbidden`.

### `PUT /api/tickets/:id/escalate`
- **Description:** Escalates ticket priority to `URGENT` with documented reason.
- **Authentication:** `protect`, `authorize('SUPPORT_AGENT', 'SUPPORT_MANAGER', 'ADMIN')`
- **Request Body:** `{ "reason": "Customer SLA breached and production blocked" }`
- **HTTP Status Codes:** `200 OK`, `403 Forbidden`.

### `GET /api/tickets/lookup/pin/:pin`
- **Description:** Automated Telephony Voice IVR lookup. Returns ticket status, assigned specialist, and synthesized spoken voice prompt text.
- **Authentication:** Public
- **HTTP Status Codes:** `200 OK`, `400 Bad Request` (invalid PIN length), `404 Not Found`.

### `POST /api/tickets/:id/viewing`
- **Description:** Presence heartbeat for collision detection. Purges stale viewers (> 2 minutes). Customers receive empty viewer arrays. Staff receive list of other colliding staff members.
- **Authentication:** `protect`
- **HTTP Status Codes:** `200 OK`.

### `GET /api/tickets/analytics/overview`
- **Description:** Aggregates real MongoDB database metrics: resolution rate, category volume, customer sentiment breakdown, average CSAT score, and active agent workload.
- **Authentication:** `protect`, `authorize('SUPPORT_MANAGER', 'ADMIN')`
- **HTTP Status Codes:** `200 OK`, `403 Forbidden`.

### `GET /api/tickets/export/csv`
- **Description:** Generates live CSV export stream of all tickets with SLA breach indicators, CSAT ratings, and timestamps.
- **Authentication:** `protect`, `authorize('SUPPORT_MANAGER', 'ADMIN')`
- **HTTP Status Codes:** `200 OK` (`Content-Type: text/csv`), `403 Forbidden`.

---

## 4. Knowledge Base Articles (`/api/articles`)

### `GET /api/articles`
- **Description:** Returns published knowledge articles. Supports category and text search filters. Staff can pass `status=DRAFT` to review internal guides.
- **Authentication:** Optional `optionalProtect`
- **Query Parameters:** `category`, `search`, `status`
- **HTTP Status Codes:** `200 OK`.

### `GET /api/articles/:id`
- **Description:** Retrieves article by ID. Atomically increments `viewCount`. Returns `userFeedback` (`helpful`, `not_helpful`, or `null`) for authenticated user and dynamically fetches related articles in the same category. Non-staff accessing drafts are blocked with HTTP 403.
- **Authentication:** Optional `optionalProtect`
- **HTTP Status Codes:** `200 OK`, `400 Bad Request` (malformed ID), `403 Forbidden` (draft), `404 Not Found`.

### `POST /api/articles/:id/feedback`
*(Also supported at `/api/articles/feedback/:id` and `/api/articles/feedback`)*
- **Description:** Submits community helpful / not helpful feedback. Authenticated per user to prevent count inflation and enable vote changes.
- **Authentication:** `protect` (All authenticated roles)
- **Request Body:** `{ "helpful": true }`
- **Response Format:**
  ```json
  {
    "success": true,
    "helpfulCount": 1,
    "notHelpfulCount": 0,
    "userFeedback": "helpful",
    "action": "new",
    "message": "Thank you for rating this article!"
  }
  ```
- **HTTP Status Codes:** `200 OK`, `400 Bad Request`, `401 Unauthorized`, `403 Forbidden` (draft rating by customer), `404 Not Found`.

### `POST /api/articles`
- **Description:** Creates a new knowledge article.
- **Authentication:** `protect`, `authorize('SUPPORT_MANAGER', 'ADMIN')`
- **Request Body:** `{ "title": "...", "category": "TECHNICAL", "content": "...", "keywords": ["..."], "status": "PUBLISHED" }`
- **HTTP Status Codes:** `201 Created`, `400 Bad Request`, `403 Forbidden`.

### `PUT /api/articles/:id`
- **Description:** Updates an existing knowledge article.
- **Authentication:** `protect`, `authorize('SUPPORT_MANAGER', 'ADMIN')`
- **HTTP Status Codes:** `200 OK`, `403 Forbidden`, `404 Not Found`.

### `DELETE /api/articles/:id`
- **Description:** Deletes a knowledge article.
- **Authentication:** `protect`, `authorize('SUPPORT_MANAGER', 'ADMIN')`
- **HTTP Status Codes:** `200 OK`, `403 Forbidden`, `404 Not Found`.

---

## 5. Staff & User Management (`/api/users`)

### `GET /api/users`
- **Description:** Lists all platform accounts with joined date, email, and current role.
- **Authentication:** `protect`, `authorize('SUPPORT_MANAGER', 'ADMIN')`
- **HTTP Status Codes:** `200 OK`, `403 Forbidden`.

### `GET /api/users/agents`
- **Description:** Lists available support agents for assignment dropdowns.
- **Authentication:** `protect` (All staff roles)
- **HTTP Status Codes:** `200 OK`.

### `POST /api/users/staff`
- **Description:** Admin provisions a new staff member account (`SUPPORT_AGENT`, `SUPPORT_MANAGER`, or `ADMIN`). Hashes password with bcrypt.
- **Authentication:** `protect`, `authorize('ADMIN')`
- **Request Body:**
  ```json
  {
    "name": "Sarah Agent",
    "email": "sarah@resolveiq.test",
    "password": "Password123!",
    "role": "SUPPORT_AGENT"
  }
  ```
- **HTTP Status Codes:** `201 Created`, `400 Bad Request`, `403 Forbidden`.

### `PUT /api/users/:id/role`
- **Description:** Admin updates a user's role.
- **Authentication:** `protect`, `authorize('ADMIN')`
- **Request Body:** `{ "role": "SUPPORT_MANAGER" }`
- **HTTP Status Codes:** `200 OK`, `400 Bad Request`, `403 Forbidden`.

---

## 6. Category Policies & Troubleshooting (`/api/categories`)

### `GET /api/categories`
- **Description:** Returns all configured support categories, step-by-step troubleshooting steps, and policy rules (`ALLOW_DIY`, `ASSIST_ONLY`, `RESTRICTED_CALL_REQUIRED`).
- **Authentication:** Public
- **HTTP Status Codes:** `200 OK`.
