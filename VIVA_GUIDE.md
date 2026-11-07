# ResolveIQ — College Project Defense & Viva Preparation Guide

This guide is designed to prepare you for your final college project presentation, viva-voce examination, and technical defense.

---

## 1. Project Abstract & High-Level Summary

**ResolveIQ** is an intelligent, full-stack customer support and ticketing platform built on the modern MERN stack (MongoDB Atlas, Express.js, React 19, and Node.js). It replaces slow, unorganized customer email chains with an automated, role-governed support system.

### Key Highlights:
1. **Multi-Tier Role-Based Access Control (RBAC)**: Governs four distinct roles (`CUSTOMER`, `SUPPORT_AGENT`, `SUPPORT_MANAGER`, `ADMIN`).
2. **Automated SLA Deadline Engine**: Calculates resolution target deadlines based on ticket priority (Urgent=4h, High=12h, Medium=24h, Low=48h) and automatically flags SLA breaches.
3. **Intelligent Triage & NLP**: Analyzes sentiment (`FRUSTRATED`, `URGENT`, `NEUTRAL`), generates 1-sentence executive summaries for agents, drafts contextual first replies, and suggests Knowledge Base FAQs before ticket submission.
4. **Dual-Channel Communication**: Supports public replies (visible to customers) and private internal notes (restricted exclusively to staff).
5. **Real MongoDB Analytics & CSV Reporting**: Live database aggregation computing resolution rates, category distributions, priority breakdowns, and agent workloads.

---

## 2. Technology Stack Justification (Why these tools?)

| Technology | Role | Justification / Examiner Defense |
| :--- | :--- | :--- |
| **MongoDB Atlas** | Database | Flexible document model for unstructured message threads and nested activity logs; native cloud replica set high-availability; rich aggregation pipelines for analytics. |
| **Express.js & Node.js** | Backend API | Non-blocking, event-driven asynchronous I/O ideal for concurrent chat requests and RESTful API endpoints; seamless JSON handling. |
| **React 19 & Vite 6** | Frontend | Lightning-fast Hot Module Replacement (HMR); declarative component architecture; optimized production bundling (< 100 kB gzipped JS). |
| **Tailwind CSS** | Styling | Utility-first CSS providing a responsive, professional UI without bloated CSS stylesheets. |
| **Bcryptjs & JWT** | Security | One-way salted password hashing (10 salt rounds); stateless, cryptographic authentication avoiding server-side session memory overhead. |
| **React Context API** | State Management | Native React state management for global auth and session restoration without the external boilerplate of Redux. |

---

## 3. Top 15 Viva / Examiner Questions & Model Answers

### Q1: How does your authentication work?
**Answer:** We use stateless JSON Web Tokens (JWT). When a user logs in with their email and password, Express validates the credentials against a one-way bcrypt hash stored in MongoDB Atlas. If valid, the server signs an HMAC SHA256 JWT containing the user's ID, configured with a 7-day expiration. The frontend stores this token and sends it in the `Authorization: Bearer <token>` header on subsequent requests.

---

### Q2: How did you implement Role-Based Access Control (RBAC)?
**Answer:** We implemented custom Express middleware functions:
1. `protect`: Verifies the JWT and attaches the authenticated user document (`req.user`) to the request.
2. `authorize(...roles)`: Checks if `req.user.role` matches the required roles for that endpoint. If not, it halts execution and returns HTTP 403 Forbidden.
On the frontend, navigation links and actions dynamically render based on `user.role`.

---

### Q3: Why is public registration restricted to Customers only?
**Answer:** Allowing an unauthenticated user to select a privileged role like Admin or Support Manager is a major security vulnerability (Privilege Escalation). In ResolveIQ, the public registration endpoint strictly forces the `CUSTOMER` role on all new registrations. Staff accounts (`SUPPORT_AGENT`, `SUPPORT_MANAGER`, `ADMIN`) can only be created by an authenticated Admin through the User Management portal.

---

### Q4: How are private internal notes kept secure from customers?
**Answer:** Security is enforced at the database and controller layer, not just hidden in the frontend. When `getTicketById` or `getTickets` is called, the controller inspects `req.user.role`. If the user is a `CUSTOMER`, the controller filters the messages array, stripping out any message where `isInternal === true`. Customers physically never receive internal note data over the network.

---

### Q5: How is the SLA (Service Level Agreement) calculated and tracked?
**Answer:** Tickets have an automated SLA mapping: Urgent=4h, High=12h, Medium=24h, and Low=48h. A Mongoose pre-save hook calculates `slaDeadline = Date.now() + (slaHours * 3600000)` upon ticket creation. Whenever tickets are retrieved, the server compares `new Date() > ticket.slaDeadline`. If exceeded and the ticket is neither Resolved nor Closed, it updates `isSlaBreached: true`.

---

### Q6: How does the Intelligent Triage / AI Engine work?
**Answer:** The Intelligent Engine analyzes the ticket title and description. It checks for a configured `GEMINI_API_KEY`. If present, it calls the Gemini API for natural language extraction. If unavailable or offline, it seamlessly falls back to our NLP rule-based engine which performs keyword stemming to identify sentiment (`FRUSTRATED`, `URGENT`), suggest categories, extract an executive summary, and generate a contextual first reply. It transparently reports the source (`GEMINI_AI` vs `INTELLIGENT_ENGINE_FALLBACK`).

---

### Q7: What is the benefit of MongoDB over relational databases (like MySQL) for a Helpdesk?
**Answer:** Tickets are semi-structured documents. A single ticket contains an evolving thread of public replies, internal notes, activity audit logs, and AI metadata. In a relational database, this requires 4 to 5 normalized tables with expensive SQL JOIN operations. In MongoDB, the entire ticket and its timeline can be stored as a single document and queried in a single fast operation.

---

### Q8: How did you handle duplicate registrations?
**Answer:** The User schema enforces `unique: true` on the `email` field. Additionally, `registerUser` executes `User.findOne({ email })` before attempting document creation. If a record already exists, it immediately returns HTTP 400 Bad Request with: `"A user with this email address already exists."`

---

### Q9: What happens if MongoDB Atlas loses internet connectivity?
**Answer:** Rather than allowing the application to hang or crash unhandled, the server features a connection state check (`mongoose.connection.readyState === 1`). If the database is unreachable, the API returns a clean HTTP 503 Service Unavailable error explaining that the database is offline, which the frontend displays in an informative banner.

---

### Q10: How did you handle CORS during development?
**Answer:** We addressed CORS in two layers:
1. `cors()` middleware is mounted in the Express backend.
2. In `client/vite.config.js`, we configured a development proxy that maps all `/api` requests to `http://localhost:5000`. This prevents cross-origin browser warnings and enables clean relative fetch URLs (`/api/tickets`).

---

### Q11: How do Support Agents claim or reassign tickets?
**Answer:** In the Agent Portal, open tickets show a **"Claim This Ticket"** button which sends a `PUT /api/tickets/:id/assign` request attaching the agent's ID and automatically moving the status from `OPEN` to `IN_PROGRESS`. Support Managers and Admins have dropdown access to assign or reassign tickets across any team member.

---

### Q12: How are analytics generated? Are they hardcoded?
**Answer:** All analytics are calculated live using MongoDB Aggregation Pipelines (`$group`, `$match`, `$lookup`, `$project`). They group tickets by status, category, priority, sentiment, and compute real-time agent workloads and resolution percentages. No mock numbers are used.

---

### Q13: How does the Knowledge Base FAQ suggestion work?
**Answer:** When a customer types a ticket title in the submission modal, the frontend debounces the input and queries `GET /api/articles/suggestions?q=...`. The backend matches keywords against the Knowledge Base collection and returns top matching articles. This promotes self-service resolution before the ticket is even submitted.

---

### Q14: How are passwords protected?
**Answer:** Passwords are never stored in plain text. Before saving to MongoDB, a Mongoose pre-save hook generates a cryptographic salt and hashes the password using `bcryptjs` with 10 salt rounds. Furthermore, the `password` field has `select: false` so it is excluded from standard database queries.

---

### Q15: How did you test the application?
**Answer:** We created an automated test suite with 75 tests across 4 test files (`npm test`):
1. Unit tests for schema validation, bcrypt hashing, and JWT signing.
2. End-to-end controller tests for registration, login, and RBAC enforcement.
3. Ticket logic tests for SLA calculations, internal notes privacy, and AI categorization.
4. Route integration tests for endpoints and 404 handlers.
Finally, we performed a live end-to-end customer-to-agent lifecycle test against our cloud MongoDB Atlas replica set.
