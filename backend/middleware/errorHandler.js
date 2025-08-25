const logger = require('../utils/logger');
const AuditLog = require('../models/AuditLog');

const errorHandler = async (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  
  // Log error
  logger.error(`Error ${err.message}`, {
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    user: req.user?.email || 'anonymous'
  });
  
  // Default error
  let statusCode = 500;
  let message = 'Server Error';
  let code = 'INTERNAL_ERROR';
  
  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid resource ID';
    code = 'INVALID_ID';
  }
  
  // Mongoose duplicate key
  if (err.code === 11000) {
    statusCode = 400;
    message = 'Duplicate field value entered';
    code = 'DUPLICATE_VALUE';
    
    // Extract field name from error
    const field = Object.keys(err.keyValue)[0];
    message = `${field} already exists`;
  }
  
  // Mongoose validation error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors).map(val => val.message).join(', ');
    code = 'VALIDATION_ERROR';
  }
  
  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
    code = 'INVALID_TOKEN';
  }
  
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
    code = 'TOKEN_EXPIRED';
  }
  
  // Multer errors (file upload)
  if (err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 400;
    message = 'File too large';
    code = 'FILE_TOO_LARGE';
  }
  
  if (err.code === 'LIMIT_FILE_COUNT') {
    statusCode = 400;
    message = 'Too many files';
    code = 'TOO_MANY_FILES';
  }
  
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    statusCode = 400;
    message = 'Unexpected file field';
    code = 'UNEXPECTED_FILE';
  }
  
  // Rate limiting errors
  if (err.status === 429) {
    statusCode = 429;
    message = 'Too many requests';
    code = 'RATE_LIMITED';
  }
  
  // Custom application errors
  if (err.isOperational) {
    statusCode = err.statusCode || 400;
    message = err.message;
    code = err.code || 'APPLICATION_ERROR';
  }
  
  // Security-related errors
  const securityErrors = [
    'UNAUTHORIZED',
    'FORBIDDEN',
    'INVALID_TOKEN',
    'TOKEN_EXPIRED',
    'ACCOUNT_LOCKED',
    'SUSPICIOUS_ACTIVITY'
  ];
  
  const severity = securityErrors.includes(code) ? 'high' : 'medium';
  
  // Log to audit trail for security-related errors
  if (securityErrors.includes(code) || statusCode === 401 || statusCode === 403) {
    try {
      await AuditLog.createEntry({
        actorId: req.user?.id || null,
        actorEmail: req.user?.email || 'anonymous',
        actorRole: req.user?.role || 'anonymous',
        action: 'security_error',
        targetType: 'system',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          errorCode: code,
          errorMessage: message,
          statusCode,
          endpoint: req.originalUrl,
          method: req.method
        },
        severity
      });
    } catch (auditError) {
      logger.error('Failed to create audit log entry:', auditError);
    }
  }
  
  // Don't leak error details in production
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    message = 'Something went wrong';
  }
  
  res.status(statusCode).json({
    success: false,
    error: {
      message,
      code,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
};

// Custom error class for operational errors
class AppError extends Error {
  constructor(message, statusCode, code = 'APPLICATION_ERROR') {
    super(message);
    
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

// Async error wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Not found middleware
const notFound = (req, res, next) => {
  const error = new AppError(`Not found - ${req.originalUrl}`, 404, 'NOT_FOUND');
  next(error);
};

module.exports = {
  errorHandler,
  AppError,
  asyncHandler,
  notFound
};
