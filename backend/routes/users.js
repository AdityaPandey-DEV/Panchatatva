const express = require('express');
const { body, validationResult, query, param } = require('express-validator');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { auth, authorize } = require('../middleware/auth');
const logger = require('../utils/logger');
const Case = require('../models/Case'); // Added missing import for Case

const router = express.Router();

// @route   GET /api/users/profile
// @desc    Get user profile
// @access  Private
router.get('/profile', auth, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  
  res.status(200).json({
    success: true,
    data: { user }
  });
}));

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile',
  auth,
  [
    // Common validations
    body('name')
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Name must be between 2 and 100 characters'),
    body('phone')
      .optional()
      .isMobilePhone('en-IN')
      .withMessage('Please provide a valid Indian phone number'),
    
    // Role-specific validations
    body('practiceAreas')
      .optional()
      .isArray()
      .withMessage('Practice areas must be an array'),
    body('yearsOfExperience')
      .optional()
      .isInt({ min: 0, max: 50 })
      .withMessage('Years of experience must be between 0 and 50'),
    body('specializationTags')
      .optional()
      .isArray()
      .withMessage('Specialization tags must be an array'),
    body('seniorityLevel')
      .optional()
      .isIn(['junior', 'senior', 'chief'])
      .withMessage('Invalid seniority level'),
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
    
    const user = await User.findById(req.user.id);
    const updates = req.body;
    
    // Update role-specific profile
    switch (user.role) {
      case 'client':
        if (!user.clientProfile) user.clientProfile = {};
        Object.assign(user.clientProfile, {
          name: updates.name,
          phone: updates.phone,
          region: updates.region,
          preferredLanguage: updates.preferredLanguage
        });
        break;
        
      case 'lawyer':
        if (!user.lawyerProfile) user.lawyerProfile = {};
        Object.assign(user.lawyerProfile, {
          name: updates.name,
          phone: updates.phone,
          practiceAreas: updates.practiceAreas,
          yearsOfExperience: updates.yearsOfExperience,
          barId: updates.barId,
          maxConcurrentCases: updates.maxConcurrentCases,
          specializations: updates.specializations,
          languages: updates.languages,
          courtPreferences: updates.courtPreferences
        });
        break;
        
      case 'judge':
        if (!user.judgeProfile) user.judgeProfile = {};
        Object.assign(user.judgeProfile, {
          name: updates.name,
          phone: updates.phone,
          specializationTags: updates.specializationTags,
          seniorityLevel: updates.seniorityLevel,
          maxDailyIntake: updates.maxDailyIntake,
          courtAssignment: updates.courtAssignment,
          jurisdictions: updates.jurisdictions,
          languages: updates.languages
        });
        break;
        
      case 'admin':
        if (!user.adminProfile) user.adminProfile = {};
        Object.assign(user.adminProfile, {
          name: updates.name,
          phone: updates.phone,
          department: updates.department,
          permissions: updates.permissions
        });
        break;
    }
    
    await user.save();
    
    // Log profile update
    await AuditLog.createEntry({
      actorId: req.user.id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'profile_updated',
      targetType: 'user',
      targetId: user._id,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: { success: true },
      severity: 'low'
    });
    
    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: { user }
    });
  })
);

// @route   POST /api/users/availability
// @desc    Set availability schedule
// @access  Private (Lawyer, Judge)
router.post('/availability',
  auth,
  authorize('lawyer', 'judge'),
  [
    body('slots')
      .isArray({ min: 1 })
      .withMessage('At least one availability slot is required'),
    body('slots.*.date')
      .isISO8601()
      .withMessage('Invalid date format'),
    body('slots.*.startTime')
      .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('Invalid start time format (HH:MM)'),
    body('slots.*.endTime')
      .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('Invalid end time format (HH:MM)'),
    body('slots.*.maxCases')
      .optional()
      .isInt({ min: 1, max: 10 })
      .withMessage('Max cases must be between 1 and 10'),
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
    
    const user = await User.findById(req.user.id);
    const { slots } = req.body;
    
    // Clear existing availability
    user.availability = [];
    
    // Add new slots
    for (const slot of slots) {
      user.availability.push({
        date: new Date(slot.date),
        startTime: slot.startTime,
        endTime: slot.endTime,
        isAvailable: slot.isAvailable !== false,
        maxCases: slot.maxCases || 1
      });
    }
    
    await user.save();
    
    // Log availability update
    await AuditLog.createEntry({
      actorId: req.user.id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'availability_updated',
      targetType: 'user',
      targetId: user._id,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: { 
        success: true,
        slotsCount: slots.length 
      },
      severity: 'low'
    });
    
    res.status(200).json({
      success: true,
      message: 'Availability updated successfully',
      data: { availability: user.availability }
    });
  })
);

// @route   POST /api/users/conflicts
// @desc    Add conflict of interest
// @access  Private (Lawyer, Judge)
router.post('/conflicts',
  auth,
  authorize('lawyer', 'judge'),
  [
    body('email')
      .optional()
      .isEmail()
      .withMessage('Invalid email format'),
    body('caseId')
      .optional()
      .isMongoId()
      .withMessage('Invalid case ID'),
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
    
    const user = await User.findById(req.user.id);
    const { email, caseId, reason } = req.body;
    
    if (!email && !caseId) {
      return res.status(400).json({
        success: false,
        message: 'Either email or case ID is required'
      });
    }
    
    const conflict = {
      email,
      caseId,
      reason,
      addedAt: new Date()
    };
    
    // Add to appropriate profile
    if (user.role === 'lawyer') {
      user.lawyerProfile.conflicts.push(conflict);
    } else if (user.role === 'judge') {
      user.judgeProfile.conflicts.push(conflict);
    }
    
    await user.save();
    
    // Log conflict addition
    await AuditLog.createEntry({
      actorId: req.user.id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'conflicts_updated',
      targetType: 'user',
      targetId: user._id,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: { 
        success: true,
        conflictEmail: email,
        conflictCaseId: caseId,
        reason 
      },
      severity: 'medium'
    });
    
    res.status(200).json({
      success: true,
      message: 'Conflict added successfully'
    });
  })
);

// @route   GET /api/users/dashboard-stats
// @desc    Get dashboard statistics for user
// @access  Private
router.get('/dashboard-stats', auth, asyncHandler(async (req, res) => {
  const stats = {};
  
  switch (req.user.role) {
    case 'client':
      stats.totalCases = await Case.countDocuments({ clientId: req.user.id });
      stats.activeCases = await Case.countDocuments({ 
        clientId: req.user.id, 
        status: { $in: ['assigned', 'accepted', 'in_progress'] } 
      });
      stats.urgentCases = await Case.countDocuments({ 
        clientId: req.user.id, 
        finalUrgency: 'URGENT' 
      });
      break;
      
    case 'lawyer':
      stats.assignedCases = await Case.countDocuments({ 
        'assignment.lawyerId': req.user.id 
      });
      stats.activeCases = await Case.countDocuments({ 
        'assignment.lawyerId': req.user.id,
        status: { $in: ['assigned', 'accepted', 'in_progress'] }
      });
      stats.urgentCases = await Case.countDocuments({ 
        'assignment.lawyerId': req.user.id,
        finalUrgency: 'URGENT' 
      });
      break;
      
    case 'judge':
      stats.assignedCases = await Case.countDocuments({ 
        'assignment.judgeId': req.user.id 
      });
      stats.pendingAcceptance = await Case.countDocuments({ 
        'assignment.judgeId': req.user.id,
        'assignment.acceptedByJudge': false
      });
      stats.urgentCases = await Case.countDocuments({ 
        'assignment.judgeId': req.user.id,
        finalUrgency: 'URGENT' 
      });
      break;
      
    case 'admin':
      stats.totalCases = await Case.countDocuments();
      stats.pendingAssignment = await Case.countDocuments({ 
        status: 'classified' 
      });
      stats.urgentCases = await Case.countDocuments({ 
        finalUrgency: 'URGENT' 
      });
      stats.errorCases = await Case.countDocuments({ 
        status: 'error' 
      });
      break;
  }
  
  res.status(200).json({
    success: true,
    data: { stats }
  });
}));

// @route   GET /api/users
// @desc    Get users list (admin only)
// @access  Private (Admin)
router.get('/',
  auth,
  authorize('admin'),
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

// @route   GET /api/users/:id
// @desc    Get user by ID (admin only)
// @access  Private (Admin)
router.get('/:id',
  auth,
  authorize('admin'),
  [
    param('id').isMongoId().withMessage('Invalid user ID')
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
    const user = await User.findById(id).select('-otpHash -otpExpiresAt -jwtSessions');
    
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    res.status(200).json({
      success: true,
      data: { user }
    });
  })
);

// @route   PUT /api/users/:id/role
// @desc    Update user role (admin only)
// @access  Private (Admin)
router.put('/:id/role',
  auth,
  authorize('admin'),
  [
    param('id').isMongoId().withMessage('Invalid user ID'),
    body('role').isIn(['client', 'lawyer', 'judge', 'admin']).withMessage('Invalid role'),
    body('reason').optional().trim().isLength({ max: 500 }).withMessage('Reason too long')
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
    const { role: newRole, reason } = req.body;

    const user = await User.findById(id);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    const oldRole = user.role;
    user.role = newRole;

    // Clear role-specific profiles when changing roles
    if (oldRole !== newRole) {
      user.clientProfile = undefined;
      user.lawyerProfile = undefined;
      user.judgeProfile = undefined;
    }

    await user.save();

    // Log role change
    await AuditLog.createEntry({
      actorId: req.user.id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'user_role_updated',
      targetType: 'user',
      targetId: user._id,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: {
        oldRole,
        newRole,
        reason
      },
      severity: 'high'
    });

    res.status(200).json({
      success: true,
      message: 'User role updated successfully',
      data: {
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          updatedAt: user.updatedAt
        }
      }
    });
  })
);

// @route   PUT /api/users/:id/status
// @desc    Update user status (admin only)
// @access  Private (Admin)
router.put('/:id/status',
  auth,
  authorize('admin'),
  [
    param('id').isMongoId().withMessage('Invalid user ID'),
    body('status').isIn(['active', 'inactive', 'suspended']).withMessage('Invalid status'),
    body('reason').optional().trim().isLength({ max: 500 }).withMessage('Reason too long')
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
    const { status: newStatus, reason } = req.body;

    const user = await User.findById(id);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    const oldStatus = user.status || 'active';
    user.status = newStatus;

    // If suspending, clear JWT sessions
    if (newStatus === 'suspended') {
      user.jwtSessions = [];
    }

    await user.save();

    // Log status change
    await AuditLog.createEntry({
      actorId: req.user.id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'user_status_updated',
      targetType: 'user',
      targetId: user._id,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: {
        oldStatus,
        newStatus,
        reason
      },
      severity: 'high'
    });

    res.status(200).json({
      success: true,
      message: 'User status updated successfully',
      data: {
        user: {
          id: user._id,
          email: user.email,
          status: user.status,
          updatedAt: user.updatedAt
        }
      }
    });
  })
);

// @route   DELETE /api/users/:id
// @desc    Delete user (admin only)
// @access  Private (Admin)
router.delete('/:id',
  auth,
  authorize('admin'),
  [
    param('id').isMongoId().withMessage('Invalid user ID'),
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
    const { reason } = req.body;

    const user = await User.findById(id);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    // Check if user has active cases
    const activeCases = await Case.countDocuments({
      $or: [
        { clientId: user._id, status: { $nin: ['completed', 'archived'] } },
        { 'assignment.judgeId': user._id, status: { $nin: ['completed', 'archived'] } },
        { 'assignment.lawyerId': user._id, status: { $nin: ['completed', 'archived'] } }
      ]
    });

    if (activeCases > 0) {
      throw new AppError(`Cannot delete user with ${activeCases} active cases`, 400, 'ACTIVE_CASES_EXIST');
    }

    // Log deletion
    await AuditLog.createEntry({
      actorId: req.user.id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'user_deleted',
      targetType: 'user',
      targetId: user._id,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      metadata: {
        deletedUserEmail: user.email,
        deletedUserRole: user.role,
        reason
      },
      severity: 'high'
    });

    // Delete user
    await User.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  })
);

// @route   GET /api/users/stats/overview
// @desc    Get user statistics overview
// @access  Private (Admin)
router.get('/stats/overview',
  auth,
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const now = new Date();
    const last7Days = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const last30Days = new Date(now - 30 * 24 * 60 * 60 * 1000);

    const stats = await User.aggregate([
      {
        $facet: {
          totalUsers: [{ $count: 'count' }],
          byRole: [
            { $group: { _id: '$role', count: { $sum: 1 } } }
          ],
          byStatus: [
            { $group: { _id: '$status', count: { $sum: 1 } } }
          ],
          newUsers: [
            { $match: { createdAt: { $gte: last7Days } } },
            { $count: 'count' }
          ],
          verifiedUsers: [
            { $match: { isVerified: true } },
            { $count: 'count' }
          ],
          activeUsers: [
            { $match: { lastLoginAt: { $gte: last30Days } } },
            { $count: 'count' }
          ]
        }
      }
    ]);

    const result = {
      totalUsers: stats[0].totalUsers[0]?.count || 0,
      byRole: stats[0].byRole.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      byStatus: stats[0].byStatus.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      newUsers: stats[0].newUsers[0]?.count || 0,
      verifiedUsers: stats[0].verifiedUsers[0]?.count || 0,
      activeUsers: stats[0].activeUsers[0]?.count || 0
    };

    res.status(200).json({
      success: true,
      data: result
    });
  })
);

module.exports = router;
