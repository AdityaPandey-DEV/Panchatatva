const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const caseRoutes = require('./routes/cases');
const adminRoutes = require('./routes/admin');
const dashboardRoutes = require('./routes/dashboard');
const fileRoutes = require('./routes/files');
const { errorHandler } = require('./middleware/errorHandler');
const { auditLogger } = require('./middleware/auditLogger');
const logger = require('./utils/logger');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: [process.env.FRONTEND_URL || 'http://localhost:3000', 'http://localhost:3003', 'http://localhost:3004'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: (process.env.API_RATE_LIMIT_WINDOW || 15) * 60 * 1000,
  max: process.env.API_RATE_LIMIT_MAX || 100,
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Data sanitization
app.use(mongoSanitize());

// Audit logging middleware
app.use(auditLogger);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/files', fileRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Global error handler
app.use(errorHandler);

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/panchtatva-justice', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  logger.info('Connected to MongoDB');
})
.catch((error) => {
  logger.error('MongoDB connection error:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down gracefully...');
  await mongoose.connection.close();
  process.exit(0);
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
});

module.exports = app;
