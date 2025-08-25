const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Basic middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Basic auth routes
app.post('/api/auth/send-otp', (req, res) => {
  const { email } = req.body;
  console.log(`OTP request for: ${email}`);
  res.json({
    success: true,
    message: 'OTP sent successfully (demo mode)',
    otpCode: '123456' // Demo OTP
  });
});

app.post('/api/auth/verify-otp', (req, res) => {
  const { email, otp } = req.body;
  console.log(`OTP verification for: ${email}, OTP: ${otp}`);
  
  // Demo verification - accept any OTP
  res.json({
    success: true,
    message: 'Login successful',
    user: {
      id: '1',
      email: email,
      role: 'Client',
      name: 'Demo User'
    },
    tokens: {
      accessToken: 'demo-access-token',
      refreshToken: 'demo-refresh-token'
    }
  });
});

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/panchtatva-justice', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('Connected to MongoDB');
})
.catch((error) => {
  console.error('MongoDB connection error:', error);
});

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`🚀 Panchtatva Backend running on port ${PORT}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/health`);
  console.log(`📡 API base: http://localhost:${PORT}/api`);
});

module.exports = app;
