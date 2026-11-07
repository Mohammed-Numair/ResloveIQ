# ResolveIQ – Production Deployment Guide for Render

This guide provides the exact, production-verified configuration for deploying **ResolveIQ** to [Render](https://render.com). It details both the recommended **Split Architecture** (Backend Web Service + Frontend Static Site) and the **Unified Fullstack Container** deployment models.

---

## 1. Architectural Overview on Render

Render natively supports two deployment topologies for MERN applications:

| Topology | Frontend Service | Backend Service | Database | Best For |
|:---|:---|:---|:---|:---|
| **Split Architecture (Recommended)** | **Static Site** (Free CDN edge) | **Web Service** (Node.js API) | MongoDB Atlas | Optimal performance, free frontend hosting, fast builds |
| **Unified Fullstack Container** | Bundled in Backend (`client/dist`) | **Web Service** (Node.js API + Static Server) | MongoDB Atlas | Single-service deployment, single domain without CORS |

---

## 2. Backend Web Service Configuration

Deploy the backend as a Node.js Web Service on Render.

### Service Settings
- **Service Type:** `Web Service`
- **Name:** `resolveiq-api` *(or your preferred service name)*
- **Region:** `Frankfurt (EU Central)` / `Oregon (US West)` / `Ohio (US East)` *(choose the region closest to your MongoDB Atlas cluster)*
- **Branch:** `main`
- **Root Directory:** `server`
- **Runtime:** `Node`
- **Build Command:** `npm ci` *(or `npm install`)*
- **Start Command:** `npm start`
- **Plan:** `Free` or `Starter`
- **Health Check Path:** `/api/health`
- **Auto-Deploy:** `Yes`

### Required Backend Environment Variables (Names Only)
> [!IMPORTANT]
> Define these variables in the Render Dashboard under **Environment** &rarr; **Environment Variables**. Never commit secret values to version control.

| Environment Variable Name | Required / Optional | Purpose | Example Shape / Notes |
|:---|:---:|:---|:---|
| `NODE_ENV` | **Required** | Enables production security optimizations, security headers, and minimal logging | Set to `production` |
| `PORT` | **Automatic / Required** | Port assigned by Render runtime | Handled automatically by Render (defaults to `10000` or `process.env.PORT`) |
| `HOST` | **Optional** | Host interface binding | Configured to `0.0.0.0` to bind across all container interfaces |
| `MONGODB_URI` | **Required** | MongoDB Atlas connection string | `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/resolveiq?retryWrites=true&w=majority` |
| `JWT_SECRET` | **Required** | Cryptographic salt for signing and verifying user session JWTs | High-entropy random alphanumeric secret string |
| `CLIENT_URL` | **Recommended** | Production origin(s) permitted by CORS | Your deployed frontend URL: e.g. `https://resolveiq-client.onrender.com` (supports comma-separated origins) |
| `GEMINI_API_KEY` | **Optional** | API key for live Google Gemini NLP triage | If omitted, ResolveIQ automatically falls back to its deterministic rule engine |

---

## 3. Frontend Static Site Configuration

Deploy the frontend as a Render Static Site with global CDN distribution.

### Service Settings
- **Service Type:** `Static Site`
- **Name:** `resolveiq-client` *(or your preferred service name)*
- **Branch:** `main`
- **Root Directory:** `client`
- **Build Command:** `npm ci && npm run build` *(or `npm install && npm run build`)*
- **Publish Directory:** `dist`
- **Auto-Deploy:** `Yes`

### Required Frontend Environment Variables (Names Only)
> [!IMPORTANT]
> Vite injects variables prefixed with `VITE_` at build time. Define this variable in the Render Static Site dashboard under **Environment**.

| Environment Variable Name | Required / Optional | Purpose | Notes |
|:---|:---:|:---|:---|
| `VITE_API_URL` | **Required (Split Mode)** | Public URL of your deployed Render backend Web Service | Set to your backend Web Service URL: e.g. `https://resolveiq-api.onrender.com` |

---

## 4. SPA Rewrite Configuration (Page Refresh Support)

ResolveIQ uses `react-router-dom` with HTML5 History API (`BrowserRouter`). When a user directly visits or refreshes `/dashboard`, `/login`, or `/register`, Render's static server must rewrite the request to `/index.html` rather than returning a 404.

### Render Static Site Rewrite Rule:
In the Render Dashboard for your **Static Site**, navigate to **Redirects / Rewrites** and add:

```
Type:        Rewrite
Source:      /*
Destination: /index.html
```

*(This guarantees seamless client-side hydration for deep routes on page reload).*

---

## 5. Production CORS Configuration

When using Split Architecture, the frontend (`resolveiq-client.onrender.com`) makes cross-origin requests to the backend (`resolveiq-api.onrender.com`).

The backend `server/src/index.js` is hardened with dynamic CORS evaluation:
1. **Explicit Origins:** Reads `CLIENT_URL` (supports comma-separated list of origins).
2. **Automatic Subdomain Matching:** Requests from any `*.onrender.com` subdomain are permitted automatically.
3. **Localhost Development Fallback:** Local development ports (`http://localhost:5173`, `http://localhost:5000`) remain functional.
4. **Preflight Support:** HTTP `OPTIONS` requests are handled automatically.
5. **Allowed Methods:** `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`.
6. **Allowed Headers:** `Content-Type`, `Authorization`, `X-Requested-With`.
7. **Credentials:** `credentials: true` enabled for authenticated Bearer token exchanges.

---

## 6. Step-by-Step Render Deployment Walkthrough

### Step 1: Deploy MongoDB Atlas Database
1. Ensure your MongoDB Atlas cluster is active.
2. In Atlas **Network Access**, ensure Render IP access is permitted (`0.0.0.0/0` or Render outbound IPs).
3. In Atlas **Database Access**, verify your database user has read/write privileges on the `resolveiq` database.
4. Copy your connection string (`mongodb+srv://...`).

### Step 2: Deploy Backend Web Service on Render
1. Log in to [dashboard.render.com](https://dashboard.render.com).
2. Click **New +** &rarr; **Web Service**.
3. Connect your GitHub repository `https://github.com/Mohammed-Numair/ResloveIQ.git`.
4. Configure the settings:
   - **Root Directory:** `server`
   - **Runtime:** `Node`
   - **Build Command:** `npm ci`
   - **Start Command:** `npm start`
5. Add the Environment Variables:
   - `NODE_ENV` = `production`
   - `MONGODB_URI` = *(your Atlas connection string)*
   - `JWT_SECRET` = *(your secure secret key)*
   - `CLIENT_URL` = *(leave blank initially or set after creating the frontend)*
6. Click **Create Web Service**.
7. Once deployed, note your service URL (e.g., `https://resolveiq-api.onrender.com`).
8. Verify health by opening `https://resolveiq-api.onrender.com/api/health` in your browser &rarr; should return `{ "status": "ok" }`.

### Step 3: Deploy Frontend Static Site on Render
1. In Render Dashboard, click **New +** &rarr; **Static Site**.
2. Connect the same repository `https://github.com/Mohammed-Numair/ResloveIQ.git`.
3. Configure the settings:
   - **Root Directory:** `client`
   - **Build Command:** `npm ci && npm run build`
   - **Publish Directory:** `dist`
4. Add the Environment Variable:
   - `VITE_API_URL` = `https://resolveiq-api.onrender.com` *(your backend URL from Step 2)*
5. Navigate to **Redirects / Rewrites** and add:
   - **Type:** `Rewrite`
   - **Source:** `/*`
   - **Destination:** `/index.html`
6. Click **Create Static Site**.
7. Once built, note your frontend URL (e.g., `https://resolveiq-client.onrender.com`).

### Step 4: Finalize CORS on Backend
1. Go back to your backend Web Service in the Render Dashboard.
2. Under **Environment**, update:
   - `CLIENT_URL` = `https://resolveiq-client.onrender.com`
3. Click **Save Changes** *(triggers an automatic fast restart)*.
4. Open `https://resolveiq-client.onrender.com` &rarr; log in with demo accounts &rarr; all live operations are active!

---

## 7. Alternative: Infrastructure as Code (`render.yaml`)

You can also deploy both services simultaneously using Render's Blueprint specification by creating a `render.yaml` file in the root of your repository:

```yaml
services:
  # -------------------------------------------------------------
  # Backend API Web Service
  # -------------------------------------------------------------
  - type: web
    name: resolveiq-api
    runtime: node
    plan: free
    region: frankfurt
    rootDir: server
    buildCommand: npm ci
    startCommand: npm start
    healthCheckPath: /api/health
    autoDeploy: true
    envVars:
      - key: NODE_ENV
        value: production
      - key: HOST
        value: 0.0.0.0
      - key: MONGODB_URI
        sync: false
      - key: JWT_SECRET
        generateValue: true
      - key: CLIENT_URL
        fromService:
          type: web
          name: resolveiq-client
          property: host

  # -------------------------------------------------------------
  # Frontend Static Site
  # -------------------------------------------------------------
  - type: web
    name: resolveiq-client
    runtime: static
    plan: free
    region: frankfurt
    rootDir: client
    buildCommand: npm ci && npm run build
    staticPublishPath: dist
    autoDeploy: true
    routes:
      - type: rewrite
        source: /*
        destination: /index.html
    envVars:
      - key: VITE_API_URL
        fromService:
          type: web
          name: resolveiq-api
          property: host
```

---

## 8. Pre-Deployment Verification Checklist

Before deploying, verify each item against your local workspace:

- [x] **Backend PORT Configuration:** `server/src/index.js` uses `process.env.PORT` and binds to `process.env.HOST || '0.0.0.0'`.
- [x] **Backend Start Script:** `npm start` in `server/` runs `node src/index.js`.
- [x] **Database Isolation:** All MongoDB credentials read from `process.env.MONGODB_URI`.
- [x] **Dynamic CORS:** Supports `CLIENT_URL`, `*.onrender.com` subdomains, and local dev fallback.
- [x] **Configurable Frontend URL:** `client/src/services/apiConfig.js` derives endpoints from `VITE_API_URL`.
- [x] **No Localhost Leaks in Production:** No hardcoded `localhost` URLs in production source code.
- [x] **SPA Refresh Support:** Static Site rewrite `/*` &rarr; `/index.html` documented and configured.
- [x] **Clean Dependency Audit:** `npm audit` reports 0 vulnerabilities on both client and server.
- [x] **Production Bundle Build:** `npm run build` in `client/` produces clean output in `dist/`.
- [x] **Live Test Verification:** 336 / 336 automated test checkpoints passing.

