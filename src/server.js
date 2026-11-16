import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import morgan from 'morgan';
import { connectDB } from './config/db.js';

import authRoutes from './routes/authRoutes.js';
import productRoutes from './routes/productRoutes.js';
import saleRoutes from './routes/saleRoutes.js';
import purchaseRoutes from './routes/purchaseRoutes.js';
import sessionRoutes from './routes/sessionRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import expenseRoutes from './routes/expenseRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';

dotenv.config();

// Connect to MongoDB Atlas
connectDB();

const app = express();

// Middlewares - Enable complete CORS for astrader.site and all origins
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    credentials: false,
  })
);
app.options('*', cors());

app.use(express.json());
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    message: 'Urea Fertilizer Billing API is operational',
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/settings', settingsRoutes);

// Fallback 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: `API route not found: ${req.originalUrl}` });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[Global Error]:', err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`[Backend Server running] on port ${PORT}`);
});

