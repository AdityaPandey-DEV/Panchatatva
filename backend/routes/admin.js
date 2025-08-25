const express = require('express');
const { body, query, validationResult, param } = require('express-validator');
const User = require('../models/User');
const Case = require('../models/Case');
const AuditLog = require('../models/AuditLog');
const assignmentService = require('../services/assignmentService');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { auth, authorize } = require('../middleware/auth');
const logger = require('../utils/logger');
const mongoose = require('mongoose');

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
// @desc    Get users list with filters
// @access  Private (Admin)
router.get('/users',
  [
    query('role').optional().isIn(['client', 'lawyer', 'judge', 'admin']),
    query('status').optional().isIn(['active', 'inactive', 'suspended']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('search').optional().trim().isLength({ max: 100 })
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
      role,
      status,
      page = 1,
      limit = 20,
      search
    } = req.query;

    // Build query
    let query = {};
    
    if (role) query.role = role;
    if (status) query.status = status;
    
    if (search) {
      query.$or = [
        { email: { $regex: search, $options: 'i' } },
        { 'profile.name': { $regex: search, $options: 'i' } }
      ];
    }

    // Execute query with pagination
    const skip = (page - 1) * limit;
    
    const [users, total] = await Promise.all([
      User.find(query)
        .select('-otpHash -otpExpiresAt -jwtSessions')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          page: parseInt(page),
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

// @route   GET /api/admin/cases
// @desc    Get cases list with filters
// @access  Private (Admin)
router.get('/cases',
  [
    query('status').optional().isIn(['intake', 'processing', 'classified', 'assigned', 'accepted', 'in_progress', 'completed', 'archived', 'error']),
    query('urgency').optional().isIn(['URGENT', 'MODERATE', 'LOW']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('sortBy').optional().isIn(['submittedAt', 'updatedAt', 'finalUrgency', 'status']),
    query('sortOrder').optional().isIn(['asc', 'desc'])
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
      status,
      urgency,
      page = 1,
      limit = 20,
      sortBy = 'submittedAt',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    let query = {};
    
    if (status) query.status = status;
    if (urgency) query.finalUrgency = urgency;

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query with pagination
    const skip = (page - 1) * limit;
    
    const [cases, total] = await Promise.all([
      Case.find(query)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .populate('clientId', 'email profile.name')
        .populate('assignment.judgeId', 'email profile.name')
        .populate('assignment.lawyerId', 'email profile.name')
        .select('-extractedText -accessLog -encryptedFields'),
      Case.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: {
        cases,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  })
);

// @route   POST /api/admin/cases/:id/reassign
// @desc    Manually reassign case
// @access  Private (Admin)
router.post('/cases/:id/reassign',
  [
    param('id').isMongoId().withMessage('Invalid case ID'),
    body('judgeId').optional().isMongoId().withMessage('Invalid judge ID'),
    body('lawyerId').optional().isMongoId().withMessage('Invalid lawyer ID'),
    body('reason').trim().isLength({ min: 10, max: 500 }).withMessage('Reason must be between 10 and 500 characters')
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

    const { id } = req.params;
    const { judgeId, lawyerId, reason } = req.body;

    const caseDoc = await Case.findById(id);
    if (!caseDoc) {
      throw new AppError('Case not found', 404, 'CASE_NOT_FOUND');
    }

    // Validate users exist and have correct roles
    if (judgeId) {
      const judge = await User.findById(judgeId);
      if (!judge || judge.role !== 'judge') {
        throw new AppError('Invalid judge ID', 400, 'INVALID_JUDGE');
      }
    }

    if (lawyerId) {
      const lawyer = await User.findById(lawyerId);
      if (!lawyer || lawyer.role !== 'lawyer') {
        throw new AppError('Invalid lawyer ID', 400, 'INVALID_LAWYER');
      }
    }

    // Update assignment
    if (judgeId) {
      caseDoc.assignment.judgeId = judgeId;
      caseDoc.assignment.acceptedByJudge = false;
      caseDoc.assignment.judgeAcceptedAt = undefined;
    }

    if (lawyerId) {
      caseDoc.assignment.lawyerId = lawyerId;
      caseDoc.assignment.acceptedByLawyer = false;
      caseDoc.assignment.lawyerAcceptedAt = undefined;
    }

    caseDoc.assignment.reassignmentRequested = false;
    caseDoc.assignment.reassignmentReason = undefined;
    caseDoc.status = 'assigned';
    caseDoc.assignedAt = new Date();

    await caseDoc.save();

    // Log reassignment
    await AuditLog.createEntry({
      actorId: req.user.id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'case_reassigned',
      targetType: 'case',
      targetId: caseDoc._id,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: {
        reason,
        judgeId: judgeId || caseDoc.assignment.judgeId,
        lawyerId: lawyerId || caseDoc.assignment.lawyerId,
        caseNumber: caseDoc.caseNumber
      },
      severity: 'medium'
    });

    res.status(200).json({
      success: true,
      message: 'Case reassigned successfully',
      data: {
        case: {
          id: caseDoc._id,
          status: caseDoc.status,
          assignment: caseDoc.assignment
        }
      }
    });
  })
);

// @route   GET /api/admin/audit-logs
// @desc    Get audit logs with filters
// @access  Private (Admin)
router.get('/audit-logs',
  [
    query('action').optional().isString(),
    query('actorRole').optional().isIn(['client', 'lawyer', 'judge', 'admin']),
    query('severity').optional().isIn(['low', 'medium', 'high', 'critical']),
    query('startDate').optional().isISO8601().withMessage('Start date must be valid ISO date'),
    query('endDate').optional().isISO8601().withMessage('End date must be valid ISO date'),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
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
      actorRole,
      severity,
      startDate,
      endDate,
      page = 1,
      limit = 50
    } = req.query;

    // Build query
    let query = {};
    
    if (action) query.action = { $regex: action, $options: 'i' };
    if (actorRole) query.actorRole = actorRole;
    if (severity) query.severity = severity;
    
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    // Execute query with pagination
    const skip = (page - 1) * limit;
    
    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('actorId', 'email profile.name')
        .populate('targetId', 'email profile.name'),
      AuditLog.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: {
        logs,
        pagination: {
          page: parseInt(page),
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

// @route   GET /api/admin/system/health
// @desc    Get detailed system health information
// @access  Private (Admin)
router.get('/system/health', asyncHandler(async (req, res) => {
  const health = {
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    database: {
      status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      host: mongoose.connection.host,
      port: mongoose.connection.port,
      name: mongoose.connection.name
    },
    environment: process.env.NODE_ENV || 'development'
  };

  res.status(200).json({
    success: true,
    data: health
  });
}));

// @route   POST /api/admin/system/maintenance
// @desc    Enable/disable maintenance mode
// @access  Private (Admin)
router.post('/system/maintenance',
  [
    body('enabled').isBoolean().withMessage('Maintenance mode must be boolean'),
    body('message').optional().trim().isLength({ max: 500 }).withMessage('Message too long'),
    body('estimatedDuration').optional().isInt({ min: 1 }).withMessage('Duration must be positive integer')
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

    const { enabled, message, estimatedDuration } = req.body;

    // TODO: Implement maintenance mode logic
    // This could involve setting environment variables or database flags
    
    // Log maintenance mode change
    await AuditLog.createEntry({
      actorId: req.user.id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'maintenance_mode_changed',
      targetType: 'system',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: {
        enabled,
        message,
        estimatedDuration
      },
      severity: 'high'
    });

    res.status(200).json({
      success: true,
      message: `Maintenance mode ${enabled ? 'enabled' : 'disabled'} successfully`,
      data: {
        maintenanceMode: enabled,
        message,
        estimatedDuration
      }
    });
  })
);

module.exports = router;
