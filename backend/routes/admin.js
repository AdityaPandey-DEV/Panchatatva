const express = require('express');
const { body, query, validationResult } = require('express-validator');
const User = require('../models/User');
const Case = require('../models/Case');
const AuditLog = require('../models/AuditLog');
const assignmentService = require('../services/assignmentService');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { auth, authorize } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// All routes require admin authorization
router.use(auth);
router.use(authorize('admin'));

// @route   GET /api/admin/metrics
// @desc    Get system metrics
// @access  Private (Admin)
router.get('/metrics', asyncHandler(async (req, res) => {
  const now = new Date();
  const last24Hours = new Date(now - 24 * 60 * 60 * 1000);
  const last7Days = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const last30Days = new Date(now - 30 * 24 * 60 * 60 * 1000);
  
  // Case metrics
  const caseMetrics = {
    total: await Case.countDocuments(),
    last24Hours: await Case.countDocuments({ createdAt: { $gte: last24Hours } }),
    last7Days: await Case.countDocuments({ createdAt: { $gte: last7Days } }),
    last30Days: await Case.countDocuments({ createdAt: { $gte: last30Days } }),
    byStatus: await Case.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]),
    byUrgency: await Case.aggregate([
      { $group: { _id: '$finalUrgency', count: { $sum: 1 } } }
    ]),
    averageProcessingTime: await Case.aggregate([
      { 
        $match: { 
          assignedAt: { $exists: true }, 
          submittedAt: { $exists: true } 
        } 
      },
      {
        $project: {
          processingTime: {
            $subtract: ['$assignedAt', '$submittedAt']
          }
        }
      },
      {
        $group: {
          _id: null,
          avgTime: { $avg: '$processingTime' }
        }
      }
    ])
  };
  
  // User metrics
  const userMetrics = {
    total: await User.countDocuments(),
    byRole: await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]),
    active: await User.countDocuments({ isActive: true }),
    newUsers: await User.countDocuments({ createdAt: { $gte: last7Days } })
  };
  
  // Assignment metrics
  const assignmentMetrics = await assignmentService.getAssignmentStats(last30Days, now);
  
  // System health
  const systemHealth = {
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    nodeVersion: process.version
  };
  
  // Log metrics access
  await AuditLog.createEntry({
    actorId: req.user.id,
    actorEmail: req.user.email,
    actorRole: req.user.role,
    action: 'metrics_accessed',
    targetType: 'system',
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    metadata: { success: true },
    severity: 'low'
  });
  
  res.status(200).json({
    success: true,
    data: {
      cases: caseMetrics,
      users: userMetrics,
      assignments: assignmentMetrics,
      system: systemHealth
    }
  });
}));

// @route   GET /api/admin/users
// @desc    Get all users with filtering
// @access  Private (Admin)
router.get('/users',
  [
    query('role')
      .optional()
      .isIn(['client', 'lawyer', 'judge', 'admin'])
      .withMessage('Invalid role'),
    query('isActive')
      .optional()
      .isBoolean()
      .withMessage('isActive must be boolean'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
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
    
    const { role, isActive, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;
    
    const query = {};
    if (role) query.role = role;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    
    const users = await User.find(query)
      .select('-otpHash -jwtSessions -loginAttempts -accountLockedUntil')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await User.countDocuments(query);
    
    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          current: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  })
);

// @route   PUT /api/admin/users/:userId/status
// @desc    Activate/deactivate user
// @access  Private (Admin)
router.put('/users/:userId/status',
  [
    body('isActive')
      .isBoolean()
      .withMessage('isActive must be boolean'),
    body('reason')
      .optional()
      .trim()
      .isLength({ min: 5, max: 200 })
      .withMessage('Reason must be between 5 and 200 characters'),
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
    
    const { userId } = req.params;
    const { isActive, reason } = req.body;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const previousStatus = user.isActive;
    user.isActive = isActive;
    await user.save();
    
    // Log status change
    await AuditLog.createEntry({
      actorId: req.user.id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: isActive ? 'user_reactivated' : 'user_deactivated',
      targetType: 'user',
      targetId: user._id,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: { 
        success: true,
        previousStatus,
        newStatus: isActive,
        reason 
      },
      severity: 'medium'
    });
    
    res.status(200).json({
      success: true,
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: { user }
    });
  })
);

// @route   GET /api/admin/cases/pending
// @desc    Get cases pending assignment
// @access  Private (Admin)
router.get('/cases/pending', asyncHandler(async (req, res) => {
  const pendingCases = await Case.find({
    status: { $in: ['classified', 'error'] }
  })
  .populate('clientId', 'email clientProfile')
  .sort({ submittedAt: 1 });
  
  res.status(200).json({
    success: true,
    data: { cases: pendingCases }
  });
}));

// @route   POST /api/admin/cases/:caseId/reassign
// @desc    Manually reassign case
// @access  Private (Admin)
router.post('/cases/:caseId/reassign',
  [
    body('reason')
      .trim()
      .isLength({ min: 5, max: 200 })
      .withMessage('Reason must be between 5 and 200 characters'),
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
    
    const { caseId } = req.params;
    const { reason } = req.body;
    
    try {
      const result = await assignmentService.reassignCase(
        caseId,
        req.user,
        reason
      );
      
      res.status(200).json({
        success: true,
        message: 'Case reassigned successfully',
        data: result
      });
      
    } catch (error) {
      logger.error('Admin reassignment failed:', error);
      throw error;
    }
  })
);

// @route   GET /api/admin/audit-logs
// @desc    Get audit logs
// @access  Private (Admin)
router.get('/audit-logs',
  [
    query('action')
      .optional()
      .trim()
      .withMessage('Invalid action'),
    query('severity')
      .optional()
      .isIn(['low', 'medium', 'high', 'critical'])
      .withMessage('Invalid severity'),
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('Invalid start date'),
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('Invalid end date'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
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
    
    const { 
      action, 
      severity, 
      startDate, 
      endDate, 
      page = 1, 
      limit = 50 
    } = req.query;
    
    const skip = (page - 1) * limit;
    
    const query = {};
    if (action) query.action = action;
    if (severity) query.severity = severity;
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }
    
    const logs = await AuditLog.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await AuditLog.countDocuments(query);
    
    // Log audit log access
    await AuditLog.createEntry({
      actorId: req.user.id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'audit_log_accessed',
      targetType: 'system',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: { 
        success: true,
        filters: { action, severity, startDate, endDate },
        resultCount: logs.length
      },
      severity: 'medium'
    });
    
    res.status(200).json({
      success: true,
      data: {
        logs,
        pagination: {
          current: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  })
);

// @route   POST /api/admin/seed
// @desc    Seed demo data
// @access  Private (Admin)
router.post('/seed', asyncHandler(async (req, res) => {
  // This would be implemented to seed demo data
  // For security, this should only work in development
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      success: false,
      message: 'Seeding not allowed in production'
    });
  }
  
  // TODO: Implement demo data seeding
  
  res.status(200).json({
    success: true,
    message: 'Demo data seeding not yet implemented'
  });
}));

// @route   GET /api/admin/health
// @desc    Get system health status
// @access  Private (Admin)
router.get('/health', asyncHandler(async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date(),
    services: {
      database: 'healthy',
      ai: 'unknown',
      news: 'unknown',
      email: 'unknown'
    }
  };
  
  // Check database
  try {
    await User.findOne().limit(1);
    health.services.database = 'healthy';
  } catch (error) {
    health.services.database = 'unhealthy';
    health.status = 'degraded';
  }
  
  res.status(200).json({
    success: true,
    data: health
  });
}));

module.exports = router;
