# ResolveIQ - Intelligent Customer Helpdesk System

ResolveIQ is a production-grade full-stack customer support and ticketing platform built using the MERN stack (MongoDB Atlas, Express.js, React 19, Node.js).

**Project Status:** **COMPLETE, VERIFIED & RUNNING LIVE**  
- **Backend API**: `http://localhost:5000` (Connected live to MongoDB Atlas Replica Set)  
- **Frontend App**: `http://localhost:5173` (Vite 6 + React 19 + Tailwind CSS)  

---

## 1-Click Demo Accounts for Evaluation

When visiting the Login page, use the **1-Click Demo Login** buttons to immediately test any role:

| Role | Full Name | Demo Email | Password | Access Capabilities |
| :--- | :--- | :--- | :--- | :--- |
| **Customer** | Alex Rivera | `customer@resolveiq.test` | `Customer@12345` | Submit tickets, view conversation, self-service FAQs |
| **Support Agent** | Sarah Connor | `agent@resolveiq.test` | `Agent@12345` | Claim open tickets, update status, post public replies & private internal notes |
| **Support Manager** | Marcus Chen | `manager@resolveiq.test` | `Manager@12345` | Reassign tickets, monitor SLA breaches, real MongoDB Analytics, CSV export |
| **System Admin** | Eleanor Vance | `admin@resolveiq.test` | `Admin@12345` | Full system access, User Management, provision staff accounts, role promote/demote |

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
✅ Default demo accounts & knowledge base verified.
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

### 3. Open in Browser
- **Login**: [http://localhost:5173/login](http://localhost:5173/login)
- **Register**: [http://localhost:5173/register](http://localhost:5173/register)
- **Dashboard**: [http://localhost:5173/dashboard](http://localhost:5173/dashboard)
- **Backend Health Check**: [http://localhost:5000/api/health](http://localhost:5000/api/health)

---

## Automated Test Suite

Run the complete backend automated test suite (**75 tests across 4 suites**):
```powershell
cd server
npm test
```

### Test Coverage Highlights:
- **Suite 1: User & Auth Unit Tests (`test/authTest.js`)**: 18 tests
  - User Schema, 4 roles (`CUSTOMER`, `SUPPORT_AGENT`, `SUPPORT_MANAGER`, `ADMIN`), bcrypt hashing (10 rounds), JWT signing & decoding, RBAC middleware.
- **Suite 2: Controller & Auth Logic Tests (`test/controllerTest.js`)**: 31 tests
  - Registration, duplicate prevention, credential verification, RBAC endpoint blocks, database disconnect handling.
  - **Security Rule Verified**: Public registration is strictly locked to `CUSTOMER` role; staff roles can only be created by Admins or seed data.
- **Suite 3: Ticket & Intelligent Engine Tests (`test/ticketTest.js`)**: 21 tests
  - Unique `TIK-xxxx` generation, SLA calculations (Urgent=4h, High=12h, Medium=24h, Low=48h).
  - Sentiment detection (`URGENT`, `FRUSTRATED`, `NEUTRAL`, `POSITIVE`).
  - Executive 1-sentence summary generation.
  - Contextual agent reply suggestion.
  - Knowledge Base keyword matching.
  - **Security Rule Verified**: Private internal staff notes (`isInternal: true`) are filtered out and completely invisible to customers.
- **Suite 4: Express Endpoint Integration Tests (`test/apiEndpointTest.js`)**: 5 tests
  - `/api/health`, `/api/auth/me`, `/api/auth/admin-only`, 404 handler.

---

## Key Features Implemented

1. **Authentication & RBAC**:
   - bcrypt password hashing, stateless 7-day JWT tokens, persistent `localStorage` session restoration.
   - Public registration restricted to Customers for security. Staff accounts provisioned by Admins.
2. **Core Ticket Management**:
   - Unique auto-increment ticket identifiers (`TIK-xxxx`).
   - Categories: `TECHNICAL`, `BILLING`, `ACCOUNT`, `GENERAL`.
   - Priorities: `LOW`, `MEDIUM`, `HIGH`, `URGENT` with automated SLA deadline calculations.
   - Status tracking: `OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`.
3. **Role-Tailored Workflows**:
   - **Customer Portal**: Create tickets with live FAQ suggestions, track status, view response timeline.
   - **Agent Portal**: Claim tickets from unassigned queue, update status, post replies with 1-click AI suggestions.
   - **Manager Portal**: Team workload distribution, ticket reassignment, SLA monitoring.
   - **Admin Portal**: User management table, role change dropdowns, staff account creator.
4. **Communication & Privacy**:
   - Public messaging between customer and agents.
   - Private internal staff notes (amber highlight, strictly hidden from customers).
   - Full ticket activity audit trail.
5. **Intelligent Triage Engine**:
   - Real-time sentiment analysis, priority boosting, and automated executive summaries.
   - Contextual canned responses for agents.
   - Rule-based fallback clearly distinguished when Gemini API key is not configured.
6. **Analytics & Reporting**:
   - Real-time MongoDB aggregation (status breakdown, priority distribution, sentiment analysis, agent workload).
   - 1-Click CSV data export for management reporting.
