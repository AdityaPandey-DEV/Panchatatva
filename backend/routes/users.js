const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { auth, authorize } = require('../middleware/auth');
const logger = require('../utils/logger');

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

module.exports = router;
