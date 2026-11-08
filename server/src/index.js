import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import ticketRoutes from './routes/ticketRoutes.js';
import userRoutes from './routes/userRoutes.js';
import articleRoutes from './routes/articleRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import { notFound, errorHandler } from './middleware/errorMiddleware.js';
import { securityHeaders, authLimiter } from './middleware/securityMiddleware.js';
import { seedDemoAccounts } from './utils/seedData.js';
import { seedCategories } from './controllers/categoryController.js';
import { seedSampleTickets } from './utils/seedTickets.js';
import Article, { DEFAULT_ARTICLES } from './models/Article.js';

// Resolve directory path so .env is always loaded reliably
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

// Production Security Headers & Core Middleware
app.use(securityHeaders);

// Structured Production Request Logging Middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const origin = req.headers.origin || 'same-origin';
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.originalUrl || req.url} ${res.statusCode} (${duration}ms) Origin: ${origin}`);
  });
  next();
});

// Dynamic CORS Configuration supporting deployed Render frontend, Vercel frontend, and local development
const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',').map((url) => url.trim().replace(/\/+$/, ''))
  : null;

const isAllowedOrigin = (origin) => {
  if (!origin) return true; // non-browser requests
  if (allowedOrigins) {
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) return true;
  }
  // Local development origins
  if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) return true;
  // Render subdomains (e.g. resolveiq-client.onrender.com)
  if (/^https:\/\/[a-zA-Z0-9_-]+\.onrender\.com$/.test(origin)) return true;
  // Vercel deployment subdomains (e.g. resolveiq.vercel.app or preview URLs)
  if (/^https:\/\/[a-zA-Z0-9_-]+\.vercel\.app$/.test(origin)) return true;
  return false;
};

const corsOptions = {
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }
    // Return callback(null, false) rather than throwing to avoid Express 500 error cascades
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));

// Explicit CORS preflight handler for all routes (fast-path resolution)
app.options('*', cors(corsOptions));

app.use(express.json());

// Health Check Handler (supports both /api/health and /health)
const handleHealthCheck = (req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;
  res.status(200).json({
    status: 'ok',
    message: isDbConnected ? 'ResolveIQ Backend API is fully operational' : 'ResolveIQ Backend API is running (database disconnected)',
    environment: process.env.NODE_ENV || 'development',
    database: isDbConnected ? 'connected' : 'disconnected',
    health: isDbConnected ? 'healthy' : 'degraded',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
};

app.get('/api/health', handleHealthCheck);
app.get('/health', handleHealthCheck);

// Application Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/users', userRoutes);
app.use('/api/articles', articleRoutes);
app.use('/api/categories', categoryRoutes);

// Production Static Client File Serving (Only if client bundle actually exists on disk)
const clientDist = path.resolve(__dirname, '../../client/dist');
const hasClientBuild = fs.existsSync(path.resolve(clientDist, 'index.html'));

if (process.env.NODE_ENV === 'production' && hasClientBuild) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path === '/health') {
      return next();
    }
    res.sendFile(path.resolve(clientDist, 'index.html'));
  });
}

// API Root Index route when client is deployed separately (e.g. Vercel)
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'ResolveIQ Backend API is running',
    healthCheck: '/api/health',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      tickets: '/api/tickets',
      articles: '/api/articles',
      categories: '/api/categories',
      users: '/api/users',
    },
  });
});

// Error Handling Middleware
app.use(notFound);
app.use(errorHandler);

// Start Server Function
const startServer = async () => {
  // Bind HTTP server immediately so health checks and preflight requests respond without delay
  app.listen(PORT, HOST, () => {
    console.log(`ResolveIQ Server running on http://${HOST}:${PORT}`);
  });

  if (!process.env.MONGODB_URI) {
    console.warn('⚠️  MONGODB_URI is not defined in server/.env. Server running without DB connection.');
    return;
  }
  if (process.env.MONGODB_URI.includes('<') || process.env.MONGODB_URI.includes('>')) {
    console.warn('⚠️  MONGODB_URI still contains placeholder angle brackets < >. Please remove them in server/.env.');
    return;
  }

  // Connect and run initial database verify/seed in background without blocking server startup
  (async () => {
    try {
      const conn = await connectDB();
      if (!conn) return;

      try {
        await seedDemoAccounts();
        await seedCategories();
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
        await seedSampleTickets();
        console.log('✅ Default demo accounts, categories & knowledge base verified.');
      } catch (err) {
        console.warn('⚠️  Auto-seeding skipped:', err.message);
      }
    } catch (err) {
      console.error('⚠️  Background database connection error:', err.message);
    }
  })();
};

// Only listen if executed directly (not when imported in tests)
if (process.argv[1] && process.argv[1].endsWith('index.js')) {
  startServer();
}

export default app;
