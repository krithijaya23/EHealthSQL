const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const recordRoutes = require('./routes/recordRoutes');
const accessRoutes = require('./routes/accessRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const summaryRoutes = require('./routes/summaryRoutes');
const doctorRoutes = require('./routes/doctorRoutes');

const errorHandler = require('./middleware/errorHandler');

const app = express();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginOpenerPolicy: false,
}));

// Handle Google credentials from env variable (for Render deployment)
// In production, set GOOGLE_CREDENTIALS_JSON env var with the full JSON string
if (process.env.GOOGLE_CREDENTIALS_JSON) {
  const credPath = path.join(__dirname, 'google-credentials-runtime.json');
  fs.writeFileSync(credPath, process.env.GOOGLE_CREDENTIALS_JSON);
  process.env.GOOGLE_APPLICATION_CREDENTIALS = credPath;
  console.log('✅ Google credentials loaded from environment variable');
}

// CORS - Allow all origins in development
if (process.env.NODE_ENV === 'development') {
  app.use(cors({
    origin: true, // Allow all origins in dev
    credentials: true,
  }));
  console.log('🔓 CORS: All origins allowed (development mode)');
} else {
  // Production: strict origin checking
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    process.env.CLIENT_URL,
  ].filter(Boolean);

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
  }));
}

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logger (dev only)
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`, 
    req.method === 'POST' ? JSON.stringify(req.body) : '');
  next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/records', recordRoutes);
app.use('/api/access', accessRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/summary', summaryRoutes);
app.use('/api/doctor', doctorRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Health Record Manager API is running' });
});

// Error handler
app.use(errorHandler);

// Connect to MongoDB and start server
const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected successfully');
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });

module.exports = app;
