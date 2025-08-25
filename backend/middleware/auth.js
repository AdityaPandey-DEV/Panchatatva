const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const jwtService = require('../utils/jwt');
const logger = require('../utils/logger');

const auth = async (req, res, next) => {
  try {
    const token = jwtService.extractTokenFromHeader(req.header('Authorization'));
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }
    
    const { valid, decoded, error } = jwtService.verifyAccessToken(token);
    
    if (!valid) {
      // Log failed authentication attempt
      await AuditLog.createEntry({
        actorId: null,
        actorEmail: 'unknown',
        actorRole: 'unknown',
        action: 'unauthorized_access',
        targetType: 'system',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: { error, endpoint: req.originalUrl },
        severity: 'medium'
      });
      
      return res.status(401).json({
        success: false,
        message: 'Invalid token.',
        error: error
      });
    }
    
    // Check if token is blacklisted
    if (jwtService.isTokenBlacklisted(decoded.tokenId)) {
      return res.status(401).json({
        success: false,
        message: 'Token has been revoked.'
      });
    }
    
    // Get user and verify token exists in their sessions
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found.'
      });
    }
    
    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated.'
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
        message: 'Session not found or expired.'
      });
    }
    
    // Attach user info to request
    req.user = {
      id: user._id,
      email: user.email,
      role: user.role,
      profile: user.profile,
      tokenId: decoded.tokenId,
      sessionId: session._id
    };
    
    // Update last access time
    user.lastLoginAt = new Date();
    await user.save();
    
    next();
  } catch (error) {
    logger.error('Authentication middleware error:', error);
    
    // Log the error
    await AuditLog.createEntry({
      actorId: null,
      actorEmail: 'unknown',
      actorRole: 'unknown',
      action: 'unauthorized_access',
      targetType: 'system',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: { error: error.message, endpoint: req.originalUrl },
      severity: 'high'
    });
    
    res.status(500).json({
      success: false,
      message: 'Authentication error.'
    });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }
    
    if (!roles.includes(req.user.role)) {
      // Log unauthorized access attempt
      AuditLog.createEntry({
        actorId: req.user.id,
        actorEmail: req.user.email,
        actorRole: req.user.role,
        action: 'unauthorized_access',
        targetType: 'system',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: { 
          requiredRoles: roles, 
          userRole: req.user.role,
          endpoint: req.originalUrl 
        },
        severity: 'medium'
      });
      
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions.'
      });
    }
    
    next();
  };
};

// Optional authentication - doesn't fail if no token
const optionalAuth = async (req, res, next) => {
  try {
    const token = jwtService.extractTokenFromHeader(req.header('Authorization'));
    
    if (!token) {
      return next();
    }
    
    const { valid, decoded } = jwtService.verifyAccessToken(token);
    
    if (valid && !jwtService.isTokenBlacklisted(decoded.tokenId)) {
      const user = await User.findById(decoded.userId);
      if (user && user.isActive) {
        req.user = {
          id: user._id,
          email: user.email,
          role: user.role,
          profile: user.profile,
          tokenId: decoded.tokenId
        };
      }
    }
    
    next();
  } catch (error) {
    // Don't fail on optional auth errors
    logger.debug('Optional auth error:', error);
    next();
  }
};

// Rate limiting for sensitive operations
const sensitiveOpAuth = async (req, res, next) => {
  // First run normal auth
  await new Promise((resolve, reject) => {
    auth(req, res, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
  
  if (!req.user) {
    return; // Auth already handled the response
  }
  
  // Additional checks for sensitive operations
  const user = await User.findById(req.user.id);
  
  // Check if account is locked
  if (user.isLocked()) {
    return res.status(423).json({
      success: false,
      message: 'Account is temporarily locked due to suspicious activity.'
    });
  }
  
  // Check for recent failed attempts
  if (user.loginAttempts >= 3) {
    return res.status(429).json({
      success: false,
      message: 'Too many recent failed attempts. Please try again later.'
    });
  }
  
  next();
};

module.exports = {
  auth,
  authorize,
  optionalAuth,
  sensitiveOpAuth
};
