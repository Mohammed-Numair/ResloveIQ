# ResolveIQ — College Project Defense & Viva Preparation Guide

**Course:** 21CSC705T – Intelligent Systems Development  
**Project:** ResolveIQ (Understand Faster. Resolve Smarter.)  
**Architecture:** Full-Stack MERN (MongoDB Atlas, Express.js, React 19, Node.js)  

This guide is designed to prepare you for your final college project presentation, viva-voce examination, and technical defense.

---

## 1. Project Abstract & High-Level Summary

**ResolveIQ** is an intelligent, full-stack, multimodal customer support and ticketing platform built on the modern MERN stack. It replaces disorganized customer email chains with an automated, role-governed, and AI-triaged support system.

### Key Highlights:
1. **Multi-Tier Role-Based Access Control (RBAC)**: Governs four distinct roles (`CUSTOMER`, `SUPPORT_AGENT`, `SUPPORT_MANAGER`, `ADMIN`).
2. **6 Dedicated MongoDB Atlas Schemas**: `User`, `Category`, `Ticket`, `TicketMessage`, `Assignment`, `Activity` (+ `Article` for FAQs).
3. **Automated SLA Deadline Engine**: Calculates resolution target deadlines based on ticket priority (Urgent=4h, High=12h, Medium=24h, Low=48h) and automatically flags SLA breaches.
4. **Guided Troubleshooting & Policy Engine**: Self-service issue deflection (`ALLOW_DIY`) and fraud/security safeguards (`RESTRICTED_CALL_REQUIRED`).
5. **Simulated Voice IVR Telephony Gateway**: Auto-generated 6-digit Call PINs with Web Speech voice readback of ticket status.
6. **Dual-Channel Communication**: Supports public replies (visible to customers) and private internal notes (restricted exclusively to staff).
7. **Customer Satisfaction (CSAT) & Reopen Tracking**: 1-to-5 star ratings with customer reviews and formal ticket dispute/reopen workflows.
8. **Real MongoDB Analytics & CSV Reporting**: Live database aggregation computing resolution rates, category distributions, priority breakdowns, triaged sentiments, and agent workloads.

---

## 2. Technology Stack Justification (Why these tools?)

| Technology | Role | Justification / Examiner Defense |
| :--- | :--- | :--- |
| **MongoDB Atlas** | Database | Cloud replica set high-availability; flexible document schema for dynamic message threads; powerful aggregation framework (`$group`, `$match`, `$lookup`) for real-time analytics. |
| **Express.js & Node.js** | Backend API | Non-blocking, event-driven asynchronous I/O ideal for concurrent chat requests and RESTful API endpoints; seamless JSON handling. |
| **React 19 & Vite 6** | Frontend | Lightning-fast Hot Module Replacement (HMR); declarative component architecture; optimized production bundling (< 110 kB gzipped JS). |
| **Tailwind CSS** | Styling | Utility-first CSS providing a responsive, professional UI without bloated external CSS stylesheets. |
| **Bcryptjs & JWT** | Security | One-way salted password hashing (10 salt rounds); stateless, cryptographic authentication avoiding server-side session memory overhead. |
| **Web Speech API** | Voice Telephony | Native browser speech synthesis (`window.speechSynthesis`) simulating automated phone IVR without expensive third-party telecom APIs. |
| **React Context API** | State Management | Native React state management for global auth, notifications, and ticket state without the external boilerplate of Redux. |

---

## 3. Top 20 Viva / Examiner Questions & Model Answers

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
**Answer:** Allowing an unauthenticated user to select a privileged role like Admin or Support Manager is a major security vulnerability (Privilege Escalation). In ResolveIQ, the public registration endpoint strictly forces the `CUSTOMER` role on all new registrations. Staff accounts (`SUPPORT_AGENT`, `SUPPORT_MANAGER`, `ADMIN`) can only be created by an authenticated Admin through the User Management portal or trusted seed data.

---

### Q4: What are the 6 dedicated database models in your project?
**Answer:**
1. **`User`**: Handles user identity, roles, hashed passwords, availability, and contact details.
2. **`Category`**: Manages issue categories, default SLAs, and guided troubleshooting step policies.
3. **`Ticket`**: Stores core ticket metadata (`TIK-xxxxx`), 6-digit `callPin`, priority, status, SLA deadlines, CSAT rating, and AI triage data.
4. **`TicketMessage`**: Dedicated collection for messages, distinguishably logging public replies vs. private internal staff notes.
5. **`Assignment`**: Dedicated collection recording ticket assignment history, timestamps, and reassignment trails.
6. **`Activity`**: Dedicated audit logging collection capturing ticket lifecycle events (`TICKET_CREATED`, `STATUS_CHANGED`, `AGENT_ASSIGNED`, `CSAT_RATING_SUBMITTED`, etc.).
*(Plus `Article` for Knowledge Base FAQs).*

---

### Q5: How are private internal notes kept secure from customers?
**Answer:** Security is enforced at the database and controller layer, not just hidden in the frontend. When `getTicketById` or `getTickets` is called, the controller inspects `req.user.role`. If the user is a `CUSTOMER`, the controller filters the messages array, stripping out any message where `isInternal === true`. Customers physically never receive internal note data over the network.

---

### Q6: How does the Guided Troubleshooting & Policy Engine operate?
**Answer:** In the Category model, each category has a defined `policyType`:
- **`ALLOW_DIY`**: Triggers a step-by-step interactive troubleshooting wizard. If the customer solves their issue, ticket creation is averted (deflected), saving support capacity.
- **`RESTRICTED_CALL_REQUIRED`**: Enforced on high-risk domains like UPI/payments or account takeovers. Automated self-service is restricted for security, displaying a security policy badge and routing directly to verified human staff.
- **`ASSIST_ONLY`**: Standard assisted support flow with knowledge base matching.

---

### Q7: How does the Voice IVR Telephony Simulation work?
**Answer:** Every created ticket automatically receives a unique 6-digit random `callPin`. Users or simulated callers open the Voice IVR modal and dial their 6-digit PIN. The server queries `GET /api/tickets/lookup/pin/:pin` and dynamically generates an automated spoken prompt text. The client uses the HTML5 Web Speech API (`window.speechSynthesis`) to audibly speak the ticket status, priority, and assigned agent, accompanied by a dynamic audio visualizer animation.

---

### Q8: How is the SLA (Service Level Agreement) calculated and tracked?
**Answer:** Tickets have an automated SLA mapping: Urgent=4h, High=12h, Medium=24h, and Low=48h. A Mongoose pre-save hook calculates `slaDeadline = Date.now() + (slaHours * 3600000)` upon ticket creation. Whenever tickets are retrieved, the server compares `new Date() > ticket.slaDeadline`. If exceeded and the ticket is neither Resolved nor Closed, it updates `isSlaBreached: true`.

---

### Q9: How does the Intelligent Triage / AI Engine work?
**Answer:** The Intelligent Engine analyzes the ticket title and description. It checks for a configured `GEMINI_API_KEY`. If present, it calls the Gemini API for natural language extraction. If unavailable or offline, it seamlessly falls back to our NLP rule-based engine which performs keyword stemming to identify sentiment (`FRUSTRATED`, `URGENT`), suggest categories, extract an executive summary, and generate a contextual first reply. It transparently reports the source (`GEMINI_AI` vs `INTELLIGENT_ENGINE_FALLBACK`).

---

### Q10: How does Collision Awareness (Active Viewers) work?
**Answer:** When staff open a ticket, a background heartbeat pings `POST /api/tickets/:id/viewing`. The server records the active viewer and cleans up any viewer heartbeats older than 2 minutes. If another agent is inspecting the ticket concurrently, a prominent amber collision alert banner appears: *"Active Collision Alert: Agent Sarah is currently viewing this ticket"*, preventing conflicting edits.

---

### Q11: How do customers submit CSAT ratings and reopen tickets?
**Answer:** Once a ticket moves to `RESOLVED` or `CLOSED`:
1. Customers can rate their support on an interactive 1-to-5 star scale with optional qualitative feedback (`PUT /api/tickets/:id/rate`).
2. If the problem recurs, customers can click *"Reopen Ticket"* with a mandatory reason (`PUT /api/tickets/:id/reopen`). This sets status back to `IN_PROGRESS` and increments `reopenCount`.

---

### Q12: How are analytics generated? Are they hardcoded?
**Answer:** All analytics are calculated live using MongoDB Aggregation Pipelines (`$group`, `$match`, `$lookup`, `$project`). They group tickets by status, category, priority, sentiment, and compute real-time agent workloads and resolution percentages. No mock numbers are used.

---

### Q13: What happens if MongoDB Atlas loses internet connectivity?
**Answer:** Rather than allowing the application to hang or crash unhandled, the server features a connection state check (`mongoose.connection.readyState === 1`). If the database is unreachable, the API returns a clean HTTP 503 Service Unavailable error explaining that the database is offline, which the frontend displays in an informative banner.

---

### Q14: How did you handle duplicate registrations?
**Answer:** The User schema enforces `unique: true` on the `email` field. Additionally, `registerUser` executes `User.findOne({ email })` before attempting document creation. If a record already exists, it immediately returns HTTP 400 Bad Request with: *"A user with this email address already exists."*

---

### Q15: How did you handle CORS during development?
**Answer:** We addressed CORS in two layers:
1. `cors()` middleware is mounted in the Express backend.
2. In `client/vite.config.js`, we configured a development proxy that maps all `/api` requests to `http://localhost:5000`. This prevents cross-origin browser warnings and enables clean relative fetch URLs (`/api/tickets`).

---

### Q16: How do Support Agents claim or reassign tickets?
**Answer:** In the Agent Portal, open tickets show a **"Claim This Ticket"** button which sends a `PUT /api/tickets/:id/assign` request attaching the agent's ID and automatically moving the status from `OPEN` to `IN_PROGRESS`. Support Managers and Admins have dropdown access to assign or reassign tickets across any team member, and an `Assignment` history entry is recorded.

---

### Q17: Can agents escalate tickets?
**Answer:** Yes. Support staff can click **"Escalate to URGENT"** on any ticket with a required reason prompt. This elevates the ticket priority to `URGENT`, updates `escalated.isEscalated = true`, records the escalation reason, and logs an `Activity` audit entry.

---

### Q18: What is the benefit of MongoDB over relational databases (like MySQL) for a Helpdesk?
**Answer:** Helpdesk data is semi-structured. A single ticket contains an evolving timeline of public replies, internal notes, activity audit logs, attachments, and AI metadata. In a relational database, this requires 5 to 6 normalized tables with expensive SQL JOIN operations. In MongoDB, documents can be retrieved with high read/write performance, while dedicated collections (`Assignment`, `Activity`, `TicketMessage`) preserve audit integrity.

---

### Q19: What is your automated test coverage?
**Answer:** We built a comprehensive automated test framework covering 336 verified checkpoints across 7 test suites (`authTest.js`, `controllerTest.js`, `ticketTest.js`, `apiEndpointTest.js`, `fullSystemTest.js`, `collisionRegressionTest.js`, `articleInteractivityTest.js`, `feedbackLifecycleTest.js`, `liveServerProbe.js`, `e2eScenarioAudit.js`, and `comprehensiveAuditTest.js`). It tests 100% of the core models, bcrypt hashing, JWT signing, RBAC middleware, SLA calculations, NLP triage, IVR speech generation, collision alert filtering, Knowledge Base interactivity, CSAT ratings, and reopen flows. All 336 test assertions pass against live MongoDB Atlas with 0 failures.

---

### Q20: How does the application scale for production deployment?
**Answer:**
1. **Stateless API**: Express backend is stateless due to JWT tokens; multiple backend instances can sit behind a round-robin load balancer like Nginx.
2. **MongoDB Atlas Clustering**: Native replica set sharding and auto-scaling.
3. **Optimized Frontend**: Production build bundle is tree-shaken and gzipped to ~114 kB JS, easily served via CDN (Vercel, Netlify, Cloudflare).

---

### Q21: How does the Knowledge Base and community feedback system work?
**Answer:** The self-service Knowledge Base provides searchable troubleshooting guides with real-time category filtering. Articles are stored in the `Article` collection with support for draft isolation (customers only see published articles, while Support Managers and Admins can author and review internal drafts). Community feedback (Helpful / Not Helpful) is tracked via `POST /api/articles/:id/feedback` with an array of user votes per article. This guarantees one vote per authenticated user, eliminates artificial count inflation, allows users to change their vote, and dynamically recalculates persistent `helpfulCount` and `notHelpfulCount` in MongoDB Atlas.
