const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const path    = require('path');
const fs      = require('fs');
require('dotenv').config();

const { connectDB } = require('./config/db');

const authRoutes      = require('./routes/authRoutes');
const recordRoutes    = require('./routes/recordRoutes');
const accessRoutes    = require('./routes/accessRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const summaryRoutes   = require('./routes/summaryRoutes');
const doctorRoutes    = require('./routes/doctorRoutes');
const profileRoutes   = require('./routes/profileRoutes');

const errorHandler = require('./middleware/errorHandler');

const app = express();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginOpenerPolicy: false,
}));

// Handle Google credentials from env variable (for Render deployment)
if (process.env.GOOGLE_CREDENTIALS_JSON) {
  const credPath = path.join(__dirname, 'google-credentials-runtime.json');
  fs.writeFileSync(credPath, process.env.GOOGLE_CREDENTIALS_JSON);
  process.env.GOOGLE_APPLICATION_CREDENTIALS = credPath;
  console.log('✅ Google credentials loaded from environment variable');
}

// CORS
if (process.env.NODE_ENV === 'development') {
  app.use(cors({ origin: true, credentials: true }));
  console.log('🔓 CORS: All origins allowed (development mode)');
} else {
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
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });
}

// API Routes
app.use('/api/auth',      authRoutes);
app.use('/api/records',   recordRoutes);
app.use('/api/access',    accessRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/summary',   summaryRoutes);
app.use('/api/doctor',    doctorRoutes);
app.use('/api/profiles',  profileRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Health Record Manager API is running (MySQL)' });
});

// Error handler
app.use(errorHandler);

// Connect to MySQL and start server
const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
});

module.exports = app;
