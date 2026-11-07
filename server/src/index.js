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

// Dynamic CORS Configuration supporting deployed Render frontend and local development
const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',').map((url) => url.trim().replace(/\/+$/, ''))
  : null;

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests (mobile apps, server-to-server, curl, tests)
    if (!origin) return callback(null, true);

    if (allowedOrigins) {
      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        return callback(null, true);
      }
      // Allow localhost dev origins
      if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
        return callback(null, true);
      }
      // Allow any Render subdomain if deployed on Render
      if (origin.endsWith('.onrender.com')) {
        return callback(null, true);
      }
      return callback(new Error(`CORS policy blocked access from origin: ${origin}`));
    }

    // Default: allow all origins when CLIENT_URL is not explicitly configured
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};

app.use(cors(corsOptions));
app.use(express.json());

// Health Check Handler (supports both /api/health and /health)
const handleHealthCheck = (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'ResolveIQ Backend API is running',
    environment: process.env.NODE_ENV || 'development',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
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
  if (!process.env.MONGODB_URI) {
    console.warn('⚠️  MONGODB_URI is not defined in server/.env. Server running without DB connection.');
  } else if (process.env.MONGODB_URI.includes('<') || process.env.MONGODB_URI.includes('>')) {
    console.warn('⚠️  MONGODB_URI still contains placeholder angle brackets < >. Please remove them in server/.env.');
  } else {
    await connectDB();
    // Seed default role demo accounts, categories, articles & sample tickets if needed
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
  }

  app.listen(PORT, HOST, () => {
    console.log(`ResolveIQ Server running on http://${HOST}:${PORT}`);
  });
};

// Only listen if executed directly (not when imported in tests)
if (process.argv[1] && process.argv[1].endsWith('index.js')) {
  startServer();
}

export default app;
