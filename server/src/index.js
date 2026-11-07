import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import ticketRoutes from './routes/ticketRoutes.js';
import userRoutes from './routes/userRoutes.js';
import articleRoutes from './routes/articleRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import { notFound, errorHandler } from './middleware/errorMiddleware.js';
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

// Core Middleware
app.use(cors());
app.use(express.json());

// Basic Health Check Route
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'ResolveIQ Backend API is running',
    timestamp: new Date().toISOString(),
  });
});

// Application Routes
app.use('/api/auth', authRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/users', userRoutes);
app.use('/api/articles', articleRoutes);
app.use('/api/categories', categoryRoutes);

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
      for (const art of DEFAULT_ARTICLES) {
        const exists = await Article.findOne({ title: art.title });
        if (!exists) await Article.create(art);
      }
      await seedSampleTickets();
      console.log('✅ Default demo accounts, categories & knowledge base verified.');
    } catch (err) {
      console.warn('⚠️  Auto-seeding skipped:', err.message);
    }
  }

  app.listen(PORT, () => {
    console.log(`ResolveIQ Server running on port ${PORT}`);
  });
};

// Only listen if executed directly (not when imported in tests)
if (process.argv[1] && process.argv[1].endsWith('index.js')) {
  startServer();
}

export default app;
