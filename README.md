# ResolveIQ - Intelligent Multimodal Customer Helpdesk System

> **"Understand Faster. Resolve Smarter."**  
> Course: **21CSC705T – Intelligent Systems Development**

ResolveIQ is a full-stack, enterprise-grade intelligent customer support platform built on the MERN stack (MongoDB Atlas, Express.js, React 19, Node.js). It bridges the gap between self-service issue deflection, AI-driven triage, multimodal inquiry handling (voice IVR simulation + screenshots), and role-based helpdesk operations.

---

## Current Status & Verification
- **System Status:** **100% COMPLETE, INTEGRATED & VERIFIED LIVE**
- **Live Database:** MongoDB Atlas Replica Set connected
- **Automated Test Suite:** **96 / 96 Tests Passing (100%)**
- **Frontend Build:** **0 compilation errors / 0 warnings** (Vite 6 + React 19)

---

## 1-Click Demo Accounts for Evaluation

When opening the app in the browser, 1-Click Demo Login pills are provided on the Login page:

| Role | Full Name | Demo Email | Password | Access Capabilities |
| :--- | :--- | :--- | :--- | :--- |
| **Customer** | Alex Rivera | `customer@resolveiq.test` | `Customer@12345` | Guided troubleshooting wizard, submit tickets with attachments, Voice IVR, CSAT ratings, reopen tickets |
| **Support Agent** | Sarah Connor | `agent@resolveiq.test` | `Agent@12345` | Claim queue, update status, AI canned replies, private internal staff notes, escalate to urgent |
| **Support Manager** | Marcus Chen | `manager@resolveiq.test` | `Manager@12345` | Reassign tickets, view agent workload, real MongoDB analytics, download CSV reports |
| **System Admin** | Eleanor Vance | `admin@resolveiq.test` | `Admin@12345` | Full system control, User Management, provision staff accounts, role promote/demote |

---

## Quick Start (How to Run)

### 1. Start the Backend API (Port 5000)
```powershell
cd server
npm run dev
```
*Expected terminal output:*
```text
[nodemon] starting `node src/index.js`
✅ MongoDB Connected: ac-jlliqp4-shard-...dqq2lho.mongodb.net
✅ Default demo accounts, categories & knowledge base verified.
ResolveIQ Server running on port 5000
```

### 2. Start the Frontend UI (Port 5173)
```powershell
cd client
npm run dev
```
*Expected terminal output:*
```text
  VITE v6.4.5  ready in ... ms
  ➜  Local:   http://localhost:5173/
```

### 3. Application URLs
- **Web App**: [http://localhost:5173/](http://localhost:5173/)
- **Sign In**: [http://localhost:5173/login](http://localhost:5173/login)
- **Register**: [http://localhost:5173/register](http://localhost:5173/register)
- **Multi-Role Dashboard**: [http://localhost:5173/dashboard](http://localhost:5173/dashboard)
- **API Health Check**: [http://localhost:5000/api/health](http://localhost:5000/api/health)

---

## Key Architectural Highlights

### 1. 6 Mandatory Dedicated MongoDB Atlas Models
1. **`User`**: 4 roles (`CUSTOMER`, `SUPPORT_AGENT`, `SUPPORT_MANAGER`, `ADMIN`), availability status, department, and bcrypt hashed credentials.
2. **`Category`**: Troubleshooting steps and policy enforcement (`ALLOW_DIY`, `ASSIST_ONLY`, `RESTRICTED_CALL_REQUIRED`).
3. **`Ticket`**: Unique `TIK-xxxxx` ID, 6-digit `callPin`, SLA targets, CSAT rating, reopen tracking, active viewer presence, and AI triage metadata.
4. **`TicketMessage`**: Public conversation replies and private staff internal notes with attachment support.
5. **`Assignment`**: Full agent assignment and queue reassignment audit history.
6. **`Activity`**: System-wide activity and audit trail.
*(Plus `Article` for self-help knowledge base FAQs).*

### 2. Guided Troubleshooting & Policy Enforcement
- **Self-Service Deflection (`ALLOW_DIY`)**: Step-by-step interactive troubleshooting wizard allows customers to solve common platform issues without submitting unnecessary tickets.
- **Strict Security Policy (`RESTRICTED_CALL_REQUIRED`)**: Enforced on high-risk categories such as UPI payments, fraud disputes, and credential resets. Displays policy badge informing customers that automated action is blocked for financial safety and human verification is required.

### 3. Voice IVR Telephony Simulator
- Every ticket is automatically issued a secure **6-digit Call PIN**.
- The interactive **Voice IVR Telephony modal** allows users to dial their PIN, simulates telephony network handshakes, renders an audio visualizer wave, and speaks an automated ticket status prompt using the browser's Web Speech API (`speechSynthesis`).

### 4. Customer Satisfaction (CSAT) & Reopen Tracking
- On resolved tickets, customers can rate their support experience from **1 to 5 stars** with feedback comments.
- Customers can **reopen tickets** with documented reasons if an issue recurs, automatically placing it back into active queue.

### 5. Collision Awareness (Active Viewers)
- Live heartbeat presence alerts support agents if another team member is currently viewing the same ticket, preventing duplicate work.

### 6. Real MongoDB Aggregation Analytics
- Live aggregation pipelines for category volume, priority breakdown, triaged customer sentiment, and agent workload distribution.
- One-click CSV report export.

---

## Automated Test Suite (96 Tests Passing)

Run all backend automated test suites:
```powershell
cd server
npm test
```

```text
=======================================
Test Results: 18/18 tests passed. (authTest.js)
End-to-End Auth Results: 31/31 tests passed. (controllerTest.js)
Ticket & Intelligent Engine Tests: 21/21 passed. (ticketTest.js)
In-Process API Tests: 5/5 tests passed. (apiEndpointTest.js)
Master System Test Results: 21/21 passed. (fullSystemTest.js)
=======================================
Total: 96 / 96 passed (100% success rate)
```

Run the live MongoDB Atlas verification script:
```powershell
node server/test/liveAtlasVerification.js
```
*(Directly queries live MongoDB Atlas cluster, verifies all 6 models, Call PINs, assignments, and CSAT persistence).*
