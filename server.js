const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const { connectDatabase } = require('./config/database');
const { initializeCronJobs } = require('./services/cronJobs');

// Load environment variables
dotenv.config();

// Initialize app
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'http://tahmincim.info',
    'http://www.tahmincim.info'
  ],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically
app.use('/uploads', express.static('uploads'));

// Routes
app.get('/', (req, res) => {
  res.json({
    message: 'Tahminci.info API Server',
    version: '1.0.0',
    status: 'running'
  });
});

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/leagues', require('./routes/leagues'));
app.use('/api/teams', require('./routes/teams'));
app.use('/api/users', require('./routes/users'));
app.use('/api/predictions', require('./routes/predictions'));
app.use('/api/coupons', require('./routes/coupons'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/stats', require('./routes/stats'));
// app.use('/api/settings', require('./routes/settings'));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.all('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 Tahminci.info API Server running on port ${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
  
  // Connect to database
  await connectDatabase();
  
  // Initialize cron jobs
  initializeCronJobs();
});

module.exports = app; 
