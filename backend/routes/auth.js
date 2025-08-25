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
      try {
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
      } catch (auditError) {
        logger.error('Audit logging failed for successful OTP:', auditError);
        // Don't fail the OTP send if audit logging fails
      }
      
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
      
      // Log failed attempt only if user exists and has valid ID
      if (user && user._id) {
        try {
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
              success: false,
              error: error.message 
            },
            severity: 'medium'
          });
        } catch (auditError) {
          logger.error('Audit logging failed for failed OTP:', auditError);
        }
      }
      
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
        // Log failed attempt - skip audit logging since we don't have a valid user ID
        logger.warn(`Login attempt failed for non-existent user: ${email}`);
        
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }
      
      // Check if account is locked
      if (user.isLocked()) {
        try {
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
        } catch (auditError) {
          logger.error('Audit logging failed for locked account:', auditError);
        }
        
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
        try {
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
        } catch (auditError) {
          logger.error('Audit logging failed for invalid OTP:', auditError);
        }
        
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

// @route   POST /api/auth/register
// @desc    Register new user with OTP verification
// @access  Public
router.post('/register',
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
    body('profile.name')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Name must be between 2 and 100 characters'),
    body('profile.role')
      .isIn(['client', 'lawyer', 'judge'])
      .withMessage('Role must be client, lawyer, or judge'),
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
    
    const { email, otp, profile } = req.body;
    
    try {
      const user = await User.findOne({ email });
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }
      
      // Check if user already has profile (already registered)
      if (user.profile && user.profile.name) {
        return res.status(409).json({
          success: false,
          message: 'User already registered. Please sign in instead.'
        });
      }
      
      // Verify OTP
      const isValidOTP = await user.verifyOTP(otp);
      
      if (!isValidOTP) {
        user.otpAttempts += 1;
        if (user.otpAttempts >= 5) {
          user.otpLockedUntil = new Date(Date.now() + 30 * 60 * 1000);
        }
        await user.save();
        
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired OTP'
        });
      }
      
      // Update user with profile information
      user.profile = {
        name: profile.name,
        role: profile.role,
        createdAt: new Date()
      };
      user.role = profile.role;
      user.isVerified = true;
      user.hasProfile = true;
      
      // Clear OTP data
      user.otpHash = undefined;
      user.otpExpiresAt = undefined;
      user.otpAttempts = 0;
      user.otpLockedUntil = undefined;
      
      await user.save();
      
      // Generate JWT tokens
      const tokens = jwtService.generateTokens(user._id);
      
      // Add JWT session
      await user.addJWTSession(
        tokens.tokenId || 'default-token-id',
        req.get('User-Agent'),
        req.ip,
        req.get('User-Agent'),
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      );
      
      // Log successful registration
      await AuditLog.createEntry({
        actorId: user._id,
        actorEmail: user.email,
        actorRole: user.role,
        action: 'user_created',
        targetType: 'user',
        targetId: user._id,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: { 
          role: profile.role,
          name: profile.name
        },
        severity: 'low'
      });
      
      // Return user data and tokens
      const userData = {
        id: user._id,
        email: user.email,
        role: user.role,
        profile: user.profile,
        isVerified: user.isVerified,
        hasProfile: user.hasProfile
      };
      
      res.status(201).json({
        success: true,
        message: 'Registration successful',
        data: {
          user: userData,
          tokens
        }
      });
      
    } catch (error) {
      logger.error('Registration error:', error);
      
      // Don't log failed registration attempts to avoid validation errors
      logger.error('Registration failed:', { email, error: error.message });
      
      throw error;
    }
  })
);

// @route   POST /api/auth/reset-password
// @desc    Reset password with OTP verification
// @access  Public
router.post('/reset-password',
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
    body('newPassword')
      .isLength({ min: 8, max: 128 })
      .withMessage('Password must be between 8 and 128 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'),
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
    
    const { email, otp, newPassword } = req.body;
    
    try {
      const user = await User.findOne({ email });
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }
      
      // Verify OTP
      const isValidOTP = await user.verifyOTP(otp);
      
      if (!isValidOTP) {
        user.otpAttempts += 1;
        if (user.otpAttempts >= 5) {
          user.otpLockedUntil = new Date(Date.now() + 30 * 60 * 1000);
        }
        await user.save();
        
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired OTP'
        });
      }
      
      // Update password (will be hashed by pre-save middleware)
      user.password = newPassword;
      
      // Clear OTP data
      user.otpHash = undefined;
      user.otpExpiresAt = undefined;
      user.otpAttempts = 0;
      user.otpLockedUntil = undefined;
      
      // Revoke all existing sessions for security
      user.sessions = [];
      
      await user.save();
      
      // Log password reset
      await AuditLog.createEntry({
        actorId: user._id,
        actorEmail: user.email,
        actorRole: user.role,
        action: 'user_updated',
        targetType: 'user',
        targetId: user._id,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: { success: true, action: 'password_reset' },
        severity: 'medium'
      });
      
      res.status(200).json({
        success: true,
        message: 'Password reset successful. Please sign in with your new password.'
      });
      
    } catch (error) {
      logger.error('Password reset error:', error);
      
      // Don't log failed password reset attempts to avoid validation errors
      logger.error('Password reset failed:', { email, error: error.message });
      
      throw error;
    }
  })
);

module.exports = router;
