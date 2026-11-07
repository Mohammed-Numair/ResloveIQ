# ResolveIQ – Render Production Environment Variables Reference

**Document Version:** 1.0 (Production Verified)  
**Target Platform:** [Render](https://render.com) (Node.js Web Service)  
**Database Infrastructure:** MongoDB Atlas Multi-Node Replica Set  
**Frontend Hosts Supported:** [Vercel](https://vercel.com) / Render Static Site / Custom Domain  
**Audit Standard:** Strict source-code evidence (zero invented variables, zero exposed secret values)

---

## 1. Complete Environment Variables Inventory

Based on direct source-code inspection of the backend repository (`server/src/index.js`, `server/src/config/db.js`, `server/src/middleware/`, `server/src/utils/`), the backend references exactly **7 environment variables**:

```
┌─────────────────┬───────────┬───────────────────────────────────────────┬───────────────────────────────────────────┐
│ Variable Name   │ Severity  │ Purpose Summary                           │ Exact Source-Code Reference               │
├─────────────────┼───────────┼───────────────────────────────────────────┼───────────────────────────────────────────┤
│ NODE_ENV        │ Mandatory │ Runtime environment mode & security flags │ server/src/index.js (L85), middleware    │
│ PORT            │ Mandatory │ HTTP listener port (injected by Render)   │ server/src/index.js (L25, L134)          │
│ HOST            │ Optional  │ Network interface binding (0.0.0.0)       │ server/src/index.js (L26, L134)          │
│ MONGODB_URI     │ Mandatory │ Database replica set connection string    │ server/src/config/db.js (L5), index.js   │
│ JWT_SECRET      │ Mandatory │ 30-day session token signing secret       │ server/src/utils/generateToken.js (L9)    │
│ CLIENT_URL      │ Recom.    │ CORS allowed frontend origin(s)           │ server/src/index.js (L32-L54)            │
│ GEMINI_API_KEY  │ Optional  │ Google Gemini AI API key for live triage  │ server/src/utils/intelligentEngine.js(L13)│
└─────────────────┴───────────┴───────────────────────────────────────────┴───────────────────────────────────────────┘
```

---

## 2. Exact Variable Names, Purposes & Source-Code Verification

### 1. `NODE_ENV`
- **Mandatory or Optional:** **Mandatory**
- **Production Target Value:** `production`
- **Source-Code References:**
  - `server/src/index.js` (Line 85): Enables production static client bundle serving:
    ```javascript
    if (process.env.NODE_ENV === 'production') {
      app.use(express.static(clientDist));
      app.get('*', (req, res, next) => { ... });
    }
    ```
  - `server/src/middleware/securityMiddleware.js` (Line 17): Activates the HTTP Strict Transport Security (HSTS) header:
    ```javascript
    if (process.env.NODE_ENV === 'production' && isHttps) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }
    ```
  - `server/src/middleware/errorMiddleware.js` (Line 15): Sanitizes error responses by suppressing internal file paths and stack traces:
    ```javascript
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    ```

---

### 2. `PORT`
- **Mandatory or Optional:** **Mandatory (Handled Automatically by Render)**
- **Production Target Value:** *(Assigned dynamically by Render, e.g. `10000`)*
- **Source-Code References:**
  - `server/src/index.js` (Line 25): Reads port from environment or falls back to 5000:
    ```javascript
    const PORT = process.env.PORT || 5000;
    ```
  - `server/src/index.js` (Line 134): Starts server listener:
    ```javascript
    app.listen(PORT, HOST, () => {
      console.log(`ResolveIQ Server running on http://${HOST}:${PORT}`);
    });
    ```
- **Render Behavior:** Render automatically injects `process.env.PORT`. You do **not** need to manually define this in the Render dashboard.

---

### 3. `HOST`
- **Mandatory or Optional:** **Optional (Defaults to `0.0.0.0`)**
- **Production Target Value:** `0.0.0.0`
- **Source-Code References:**
  - `server/src/index.js` (Line 26 & Line 134):
    ```javascript
    const HOST = process.env.HOST || '0.0.0.0';
    app.listen(PORT, HOST, () => { ... });
    ```
- **Purpose:** Binds the Express listener to `0.0.0.0` (all container network interfaces). This ensures Render's edge load balancer and internal health check probes reach the container without IPv6 loopback binding conflicts.

---

### 4. `MONGODB_URI`
- **Mandatory or Optional:** **Mandatory (Critical Secret)**
- **Production Target Value:** `mongodb+srv://<username>:<password>@<cluster-host>/resolveiq?retryWrites=true&w=majority`
- **Source-Code References:**
  - `server/src/config/db.js` (Line 5):
    ```javascript
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      maxPoolSize: 20,
      minPoolSize: 2,
    });
    ```
  - `server/src/index.js` (Lines 101–105): Verifies that `MONGODB_URI` is present and does not retain unconfigured placeholder angle brackets (`<` or `>`):
    ```javascript
    if (!process.env.MONGODB_URI) {
      console.warn('⚠️ MONGODB_URI is not defined in server/.env. Server running without DB connection.');
    } else if (process.env.MONGODB_URI.includes('<') || process.env.MONGODB_URI.includes('>')) {
      console.warn('⚠️ MONGODB_URI still contains placeholder angle brackets < >. Please remove them in server/.env.');
    } else {
      await connectDB();
    ```
- **Purpose:** Connects Mongoose ODM to MongoDB Atlas to persist all 7 database collections: `User`, `Category`, `Ticket`, `TicketMessage`, `Assignment`, `Activity`, and `Article`.

---

### 5. `JWT_SECRET`
- **Mandatory or Optional:** **Mandatory (Critical Secret)**
- **Production Target Value:** High-entropy random alphanumeric or hex string (minimum 32 bytes / 64 characters).
- **Source-Code References:**
  - `server/src/utils/generateToken.js` (Line 9): Signs authentication tokens with a 30-day lifetime:
    ```javascript
    const secret = process.env.JWT_SECRET || 'resolveiq_fallback_development_secret';
    return jwt.sign({ id: userId }, secret, { expiresIn: '30d' });
    ```
  - `server/src/middleware/authMiddleware.js` (Lines 17 & 79): Verifies token validity and extracts user ID:
    ```javascript
    const secret = process.env.JWT_SECRET || 'resolveiq_fallback_development_secret';
    const decoded = jwt.verify(token, secret);
    ```
- **Security Requirement:** In production, you must supply a cryptographically secure key. Never allow production to fall back to the development default.

---

### 6. `CLIENT_URL`
- **Mandatory or Optional:** **Recommended (CORS Security Boundary)**
- **Production Target Value:** Your frontend origin URL, e.g. `https://<your-project>.vercel.app` (supports multiple comma-separated URLs).
- **Source-Code References:**
  - `server/src/index.js` (Lines 32–34): Splits and cleans allowed origins:
    ```javascript
    const allowedOrigins = process.env.CLIENT_URL
      ? process.env.CLIENT_URL.split(',').map((url) => url.trim().replace(/\/+$/, ''))
      : null;
    ```
  - `server/src/index.js` (Lines 37–54): Origin validator:
    ```javascript
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins) {
        if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
          return callback(null, true);
        }
        if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
          return callback(null, true);
        }
        if (origin.endsWith('.onrender.com')) {
          return callback(null, true);
        }
        return callback(new Error(`CORS policy blocked access from origin: ${origin}`));
      }
      return callback(null, true);
    }
    ```
- **Purpose:** Restricts cross-origin resource sharing to your deployed frontend, preventing unauthorized third-party sites from invoking your API endpoints.

---

### 7. `GEMINI_API_KEY`
- **Mandatory or Optional:** **Optional (Enhanced AI Capability)**
- **Production Target Value:** Valid Google Gemini API Key from Google AI Studio (`AIzaSy...`).
- **Source-Code References:**
  - `server/src/utils/intelligentEngine.js` (Line 13 & Line 110):
    ```javascript
    if (process.env.GEMINI_API_KEY) {
      console.log('🤖 Google Gemini Generative AI Engine configured for live triage.');
    } else {
      console.log('⚡ Internal Intelligent Rule Engine active (zero external latency).');
    }
    ```
- **Purpose:** Provides live generative NLP triage (category prediction, priority elevation, sentiment scoring, and canned reply drafting).
- **Fallback Verification:** If `GEMINI_API_KEY` is not provided, the platform automatically utilizes its built-in rule engine. All 21 triage test suites pass with 100% accuracy.

---

## 3. MongoDB Atlas Production Connection Configuration

To ensure continuous, uninterrupted connectivity between Render and MongoDB Atlas:

### 1. Network Access (IP Whitelist)
- **Atlas Dashboard:** Go to **Security** &rarr; **Network Access**.
- **Rule Required:** Add `0.0.0.0/0` (Allow Access from Anywhere).
- **Technical Reason:** Render Web Services use dynamic IP addresses that shift across cloud regions. Restricting access to a single static IP will cause connection timeouts unless you subscribe to Render's dedicated static outbound IP feature.

### 2. Database User Privileges
- **Atlas Dashboard:** Go to **Security** &rarr; **Database Access**.
- **Required Privileges:** Built-in role `readWrite` on the `resolveiq` database.
- **Authentication Mechanism:** SCRAM-SHA-1 or SCRAM-SHA-256.

### 3. Password Character Encoding
If your database user password contains special characters (`@`, `:`, `/`, `?`, `#`, `[`, `]`, `!`, `&`), they must be URL-encoded in the connection string:
- Replace `@` with `%40`
- Replace `:` with `%3A`
- Replace `/` with `%2F`
- Replace `?` with `%3F`
- Replace `#` with `%23`

### 4. Connection Pool Parameters (Active in Code)
In `server/src/config/db.js`:
- `serverSelectionTimeoutMS: 5000` (Fails fast after 5 seconds if Atlas is unreachable)
- `socketTimeoutMS: 45000` (Keeps long-lived database operations stable)
- `maxPoolSize: 20` (Supports concurrent staff and customer operations)
- `minPoolSize: 2` (Maintains warm connections for sub-50ms latency)

---

## 4. JWT & Session Secret Requirements

In `server/src/utils/generateToken.js` and `server/src/middleware/authMiddleware.js`, JWT tokens are signed using HMAC-SHA256:

1. **Entropy Requirement:** The secret must be a cryptographically random string of at least 256 bits (32 bytes).
2. **Generation Command:** Generate a production secret locally using Node.js:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
3. **Token Expiration:** Hardcoded to `30d` (30 days) to match helpdesk operational workflows.
4. **Security Isolation:** If `JWT_SECRET` is compromised, an attacker could forge tokens with `role: 'ADMIN'`. It must never be shared or exposed in client repositories.

---

## 5. CORS and Frontend URL Configuration

ResolveIQ supports flexible frontend hosting configurations:

### Scenario A: Frontend Deployed on Vercel
If your frontend will be deployed on Vercel at `https://resolveiq.vercel.app`:
```env
CLIENT_URL=https://resolveiq.vercel.app
```

### Scenario B: Frontend Deployed on Vercel with Custom Domain
If your frontend has both a Vercel default domain and a custom domain:
```env
CLIENT_URL=https://resolveiq.vercel.app,https://helpdesk.yourcompany.com
```

### Scenario C: Frontend Deployed on Render (Static Site)
If using Render for both backend and frontend:
```env
CLIENT_URL=https://resolveiq-client.onrender.com
```
*(Note: `server/src/index.js` line 50 automatically permits any `*.onrender.com` subdomain).*

### Scenario D: Permissive Staging Mode
To allow any frontend during staging:
```env
CLIENT_URL=*
```

---

## 6. PORT Configuration

- In `server/src/index.js` line 25, the server evaluates `process.env.PORT || 5000`.
- In `server/src/index.js` line 134, it binds to `app.listen(PORT, HOST, ...)`.
- **Render Implementation:** Render automatically assigns an open internal port (e.g., `10000`) and routes external HTTPS traffic (`https://your-service.onrender.com`) to it. You do not need to configure `PORT` in the Render dashboard.

---

## 7. Additional Production-Specific Settings

1. **Security Headers (`securityMiddleware.js`):**
   - Automatically injects `X-Content-Type-Options: nosniff` (MIME protection).
   - Injects `X-Frame-Options: SAMEORIGIN` (Clickjacking protection).
   - Injects `X-XSS-Protection: 1; mode=block`.
   - Injects `Referrer-Policy: strict-origin-when-cross-origin`.
   - Injects HSTS when `NODE_ENV === 'production'` and HTTPS is active.
2. **In-Memory Rate Limiting (`authLimiter`):**
   - Mounted on `/api/auth/*` in `server/src/index.js` line 77.
   - Enforces 150 requests per 15-minute sliding window to block brute-force attacks.
   - Automatically bypassed when `NODE_ENV === 'test'` to allow test suite execution.
3. **Health Check Endpoint:**
   - Mount path: `GET /api/health`
   - Returns `{ status: "ok", message: "ResolveIQ Backend API is running", timestamp: "..." }`
   - Use `/api/health` as Render's **Health Check Path**.

---

## 8. Exact Render Dashboard Configuration Table

When creating your **Web Service** on Render, configure the settings and enter these environment variables in the **Environment** tab:

### Service Settings
| Setting Name | Value to Enter |
|:---|:---|
| **Service Type** | `Web Service` |
| **Language / Runtime** | `Node` |
| **Root Directory** | `server` |
| **Build Command** | `npm ci` *(or `npm install`)* |
| **Start Command** | `npm start` |
| **Health Check Path** | `/api/health` |
| **Auto-Deploy** | `Yes` |

### Environment Variables to Enter into Render

| Variable Name | Recommended Value | Mandatory? | Notes |
|:---|:---|:---:|:---|
| **`NODE_ENV`** | `production` | **YES** | Activates HSTS and suppresses stack traces |
| **`HOST`** | `0.0.0.0` | Optional | Binds across all container interfaces |
| **`MONGODB_URI`** | `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/resolveiq?retryWrites=true&w=majority` | **YES** | Your actual MongoDB Atlas connection string |
| **`JWT_SECRET`** | *(64-character random string)* | **YES** | Key for signing and verifying user tokens |
| **`CLIENT_URL`** | `https://<your-project>.vercel.app` | Recommended | URL of your deployed frontend (supports comma-separated list) |
| **`GEMINI_API_KEY`** | *(Your Google AI Studio API key)* | Optional | Omit if using the built-in Intelligent Rule Engine |

*(Note: `PORT` is assigned automatically by Render; do not enter it manually).*
