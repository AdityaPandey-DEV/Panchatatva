const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const jwtService = require('../utils/jwt');
const emailService = require('../utils/email');
const encryptionService = require('../utils/encryption');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { auth, sensitiveOpAuth } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Rate limiting for OTP requests
const otpLimiter = rateLimit({
  windowMs: (process.env.OTP_RATE_LIMIT_WINDOW || 15) * 60 * 1000, // 15 minutes
  max: process.env.OTP_RATE_LIMIT_MAX || 5, // 5 requests per window
  message: {
    success: false,
    message: 'Too many OTP requests. Please try again later.'
  },
  keyGenerator: (req) => req.body.email || req.ip,
  skip: (req) => process.env.NODE_ENV === 'test'
});

// Rate limiting for login attempts
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  message: {
    success: false,
    message: 'Too many login attempts. Please try again later.'
  },
  keyGenerator: (req) => req.body.email || req.ip,
  skip: (req) => process.env.NODE_ENV === 'test'
});

// @route   POST /api/auth/send-otp
// @desc    Send OTP to email for authentication
// @access  Public
router.post('/send-otp', 
  otpLimiter,
  [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email address'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    
    const { email } = req.body;
    
    try {
      // Find or create user
      let user = await User.findOne({ email });
      
      if (!user) {
        // Create new user with minimal info
        user = new User({
          email,
          role: 'client', // Default role, can be changed later
          isVerified: false
        });
        await user.save();
        
        logger.info(`New user created: ${email}`);
      }
      
      // Check if user is locked
      if (user.isLocked()) {
        return res.status(423).json({
          success: false,
          message: 'Account is temporarily locked. Please try again later.'
        });
      }
      
      // Check OTP rate limiting
      if (user.isOTPLocked()) {
        return res.status(429).json({
          success: false,
          message: 'Too many OTP requests. Please try again later.'
        });
      }
      
      // Generate OTP
      const otp = encryptionService.generateOTP(6);
      const otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
      
      // Save OTP (will be hashed by pre-save middleware)
      user.otpHash = otp;
      user.otpExpiresAt = otpExpiry;
      user.otpAttempts = 0;
      await user.save();
      
      // Send OTP via email
      const emailResult = await emailService.sendOTP(email, otp, user.profile?.name);
      
      if (!emailResult.success) {
        throw new AppError('Failed to send OTP email', 500, 'EMAIL_SEND_FAILED');
      }
      
      // Log OTP sent
      await AuditLog.createEntry({
        actorId: user._id,
        actorEmail: email,
        actorRole: user.role,
        action: 'otp_sent',
        targetType: 'user',
        targetId: user._id,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: { 
          success: true,
          messageId: emailResult.messageId 
        },
        severity: 'low'
      });
      
      res.status(200).json({
        success: true,
        message: 'OTP sent successfully',
        data: {
          email,
          expiresIn: 300 // 5 minutes in seconds
        }
      });
      
    } catch (error) {
      logger.error('Send OTP error:', error);
      
      // Log failed attempt
      await AuditLog.createEntry({
        actorId: user?._id || null,
        actorEmail: email,
        actorRole: user?.role || 'unknown',
        action: 'otp_sent',
        targetType: 'user',
        targetId: user?._id || null,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: { 
          success: false,
          error: error.message 
        },
        severity: 'medium'
      });
      
      throw error;
    }
  })
);

// @route   POST /api/auth/verify-otp
// @desc    Verify OTP and get JWT tokens
// @access  Public
router.post('/verify-otp',
  loginLimiter,
  [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email address'),
    body('otp')
      .isLength({ min: 6, max: 6 })
      .isNumeric()
      .withMessage('OTP must be a 6-digit number'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    
    const { email, otp } = req.body;
    
    try {
      const user = await User.findOne({ email });
      
      if (!user) {
        // Log failed attempt
        await AuditLog.createEntry({
          actorId: null,
          actorEmail: email,
          actorRole: 'unknown',
          action: 'login_failed',
          targetType: 'user',
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          metadata: { 
            reason: 'user_not_found',
            email 
          },
          severity: 'medium'
        });
        
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }
      
      // Check if account is locked
      if (user.isLocked()) {
        await AuditLog.createEntry({
          actorId: user._id,
          actorEmail: email,
          actorRole: user.role,
          action: 'login_failed',
          targetType: 'user',
          targetId: user._id,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          metadata: { reason: 'account_locked' },
          severity: 'high'
        });
        
        return res.status(423).json({
          success: false,
          message: 'Account is temporarily locked'
        });
      }
      
      // Verify OTP
      const isValidOTP = await user.verifyOTP(otp);
      
      if (!isValidOTP) {
        // Increment failed attempts
        user.otpAttempts += 1;
        
        // Lock OTP after 5 failed attempts
        if (user.otpAttempts >= 5) {
          user.otpLockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
        }
        
        await user.save();
        
        // Log failed attempt
        await AuditLog.createEntry({
          actorId: user._id,
          actorEmail: email,
          actorRole: user.role,
          action: 'login_failed',
          targetType: 'user',
          targetId: user._id,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          metadata: { 
            reason: 'invalid_otp',
            attempts: user.otpAttempts 
          },
          severity: user.otpAttempts >= 3 ? 'high' : 'medium'
        });
        
        return res.status(401).json({
          success: false,
          message: 'Invalid OTP',
          attemptsRemaining: Math.max(0, 5 - user.otpAttempts)
        });
      }
      
      // Clear OTP data
      user.otpHash = undefined;
      user.otpExpiresAt = undefined;
      user.otpAttempts = 0;
      user.otpLockedUntil = undefined;
      user.isVerified = true;
      user.lastLoginAt = new Date();
      
      // Reset login attempts
      user.loginAttempts = 0;
      user.accountLockedUntil = undefined;
      
      // Generate JWT tokens
      const tokenPayload = {
        userId: user._id,
        email: user.email,
        role: user.role
      };
      
      const { 
        accessToken, 
        refreshToken, 
        tokenId, 
        refreshTokenExpiry 
      } = jwtService.generateTokens(tokenPayload);
      
      // Add session to user
      await user.addJWTSession(
        tokenId,
        req.get('User-Agent'),
        req.ip,
        req.get('User-Agent'),
        refreshTokenExpiry
      );
      
      // Clean expired sessions
      await user.cleanExpiredSessions();
      
      // Log successful login
      await AuditLog.createEntry({
        actorId: user._id,
        actorEmail: email,
        actorRole: user.role,
        action: 'login_success',
        targetType: 'user',
        targetId: user._id,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        sessionId: tokenId,
        metadata: { 
          success: true,
          isNewUser: !user.profile 
        },
        severity: 'low'
      });
      
      logger.info(`User logged in successfully: ${email}`);
      
      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: user._id,
            email: user.email,
            role: user.role,
            profile: user.profile,
            isVerified: user.isVerified,
            hasProfile: !!user.profile
          },
          tokens: {
            accessToken,
            refreshToken,
            expiresIn: jwtService.parseExpiry(jwtService.accessTokenExpiry) / 1000
          }
        }
      });
      
    } catch (error) {
      logger.error('Verify OTP error:', error);
      throw error;
    }
  })
);

// @route   POST /api/auth/refresh
// @desc    Refresh access token using refresh token
// @access  Public
router.post('/refresh',
  [
    body('refreshToken')
      .notEmpty()
      .withMessage('Refresh token is required'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    
    const { refreshToken } = req.body;
    
    const { valid, decoded, error } = jwtService.verifyRefreshToken(refreshToken);
    
    if (!valid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token',
        error
      });
    }
    
    // Find user and verify session
    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'User not found or inactive'
      });
    }
    
    // Verify session exists and is not revoked
    const session = user.jwtSessions.find(s => 
      s.tokenId === decoded.tokenId && 
      !s.isRevoked && 
      s.expiresAt > new Date()
    );
    
    if (!session) {
      return res.status(401).json({
        success: false,
        message: 'Session not found or expired'
      });
    }
    
    // Generate new tokens
    const tokenPayload = {
      userId: user._id,
      email: user.email,
      role: user.role
    };
    
    const newTokens = jwtService.generateTokens(tokenPayload);
    
    // Update session with new token ID
    session.tokenId = newTokens.tokenId;
    session.expiresAt = newTokens.refreshTokenExpiry;
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Tokens refreshed successfully',
      data: {
        tokens: {
          accessToken: newTokens.accessToken,
          refreshToken: newTokens.refreshToken,
          expiresIn: jwtService.parseExpiry(jwtService.accessTokenExpiry) / 1000
        }
      }
    });
  })
);

// @route   POST /api/auth/logout
// @desc    Logout user and revoke tokens
// @access  Private
router.post('/logout', auth, asyncHandler(async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (user) {
      // Revoke current session
      await user.revokeJWTSession(req.user.tokenId);
      
      // Blacklist the token
      jwtService.blacklistToken(req.user.tokenId);
    }
    
    // Log logout
    await AuditLog.createEntry({
      actorId: req.user.id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'logout',
      targetType: 'session',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      sessionId: req.user.sessionId,
      metadata: { success: true },
      severity: 'low'
    });
    
    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
    
  } catch (error) {
    logger.error('Logout error:', error);
    throw error;
  }
}));

// @route   POST /api/auth/logout-all
// @desc    Logout from all devices
// @access  Private
router.post('/logout-all', sensitiveOpAuth, asyncHandler(async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (user) {
      // Revoke all sessions
      user.jwtSessions.forEach(session => {
        session.isRevoked = true;
        jwtService.blacklistToken(session.tokenId);
      });
      
      await user.save();
    }
    
    // Log logout from all devices
    await AuditLog.createEntry({
      actorId: req.user.id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'logout_all_devices',
      targetType: 'user',
      targetId: req.user.id,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: { 
        success: true,
        sessionsRevoked: user.jwtSessions.length 
      },
      severity: 'medium'
    });
    
    res.status(200).json({
      success: true,
      message: 'Logged out from all devices successfully'
    });
    
  } catch (error) {
    logger.error('Logout all error:', error);
    throw error;
  }
}));

// @route   GET /api/auth/sessions
// @desc    Get active sessions
// @access  Private
router.get('/sessions', auth, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  
  const activeSessions = user.jwtSessions
    .filter(session => !session.isRevoked && session.expiresAt > new Date())
    .map(session => ({
      id: session._id,
      device: session.device,
      ip: session.ip,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      isCurrent: session.tokenId === req.user.tokenId
    }));
  
  res.status(200).json({
    success: true,
    data: { sessions: activeSessions }
  });
}));

// @route   DELETE /api/auth/sessions/:sessionId
// @desc    Revoke specific session
// @access  Private
router.delete('/sessions/:sessionId', sensitiveOpAuth, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  const session = user.jwtSessions.id(req.params.sessionId);
  
  if (!session) {
    return res.status(404).json({
      success: false,
      message: 'Session not found'
    });
  }
  
  // Revoke session
  session.isRevoked = true;
  jwtService.blacklistToken(session.tokenId);
  await user.save();
  
  // Log session revocation
  await AuditLog.createEntry({
    actorId: req.user.id,
    actorEmail: req.user.email,
    actorRole: req.user.role,
    action: 'session_revoked',
    targetType: 'session',
    targetId: session._id,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    metadata: { 
      success: true,
      revokedSessionId: session._id 
    },
    severity: 'low'
  });
  
  res.status(200).json({
    success: true,
    message: 'Session revoked successfully'
  });
}));

module.exports = router;
