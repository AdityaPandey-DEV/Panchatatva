const express = require('express');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { auth, authorize } = require('../middleware/auth');
const dashboardService = require('../services/dashboardService');
const logger = require('../utils/logger');

const router = express.Router();

// All routes require authentication
router.use(auth);

// @route   GET /api/dashboard
// @desc    Get dashboard data based on user role
// @access  Private
router.get('/', asyncHandler(async (req, res) => {
  try {
    let dashboardData;
    
    switch (req.user.role) {
      case 'client':
        dashboardData = await dashboardService.getClientDashboard(req.user.id);
        break;
      case 'lawyer':
        dashboardData = await dashboardService.getLawyerDashboard(req.user.id);
        break;
      case 'judge':
        dashboardData = await dashboardService.getJudgeDashboard(req.user.id);
        break;
      case 'admin':
        dashboardData = await dashboardService.getAdminDashboard();
        break;
      default:
        throw new AppError('Invalid user role', 400, 'INVALID_ROLE');
    }
    
    if (!dashboardData.success) {
      throw new AppError(dashboardData.error || 'Failed to fetch dashboard data', 500, 'DASHBOARD_FETCH_FAILED');
    }
    
    res.status(200).json(dashboardData);
  } catch (error) {
    logger.error('Dashboard data fetch failed:', error);
    throw error;
  }
}));

// @route   GET /api/dashboard/stats
// @desc    Get dashboard statistics
// @access  Private
router.get('/stats', asyncHandler(async (req, res) => {
  try {
    let stats;
    
    switch (req.user.role) {
      case 'client':
        stats = await dashboardService.getClientDashboard(req.user.id);
        break;
      case 'lawyer':
        stats = await dashboardService.getLawyerDashboard(req.user.id);
        break;
      case 'judge':
        stats = await dashboardService.getJudgeDashboard(req.user.id);
        break;
      case 'admin':
        stats = await dashboardService.getAdminDashboard();
        break;
      default:
        throw new AppError('Invalid user role', 400, 'INVALID_ROLE');
    }
    
    if (!stats.success) {
      throw new AppError(stats.error || 'Failed to fetch statistics', 500, 'STATS_FETCH_FAILED');
    }
    
    res.status(200).json({
      success: true,
      data: {
        stats: stats.data.stats
      }
    });
  } catch (error) {
    logger.error('Dashboard stats fetch failed:', error);
    throw error;
  }
}));

// @route   GET /api/dashboard/recent-activity
// @desc    Get recent activity for the user
// @access  Private
router.get('/recent-activity', asyncHandler(async (req, res) => {
  try {
    let dashboardData;
    
    switch (req.user.role) {
      case 'client':
        dashboardData = await dashboardService.getClientDashboard(req.user.id);
        break;
      case 'lawyer':
        dashboardData = await dashboardService.getLawyerDashboard(req.user.id);
        break;
      case 'judge':
        dashboardData = await dashboardService.getJudgeDashboard(req.user.id);
        break;
      case 'admin':
        dashboardData = await dashboardService.getAdminDashboard();
        break;
      default:
        throw new AppError('Invalid user role', 400, 'INVALID_ROLE');
    }
    
    if (!dashboardData.success) {
      throw new AppError(dashboardData.error || 'Failed to fetch recent activity', 500, 'ACTIVITY_FETCH_FAILED');
    }
    
    res.status(200).json({
      success: true,
      data: {
        recentActivity: dashboardData.data.recentActivity
      }
    });
  } catch (error) {
    logger.error('Recent activity fetch failed:', error);
    throw error;
  }
}));

// @route   GET /api/dashboard/quick-actions
// @desc    Get quick actions for the user
// @access  Private
router.get('/quick-actions', asyncHandler(async (req, res) => {
  try {
    let dashboardData;
    
    switch (req.user.role) {
      case 'client':
        dashboardData = await dashboardService.getClientDashboard(req.user.id);
        break;
      case 'lawyer':
        dashboardData = await dashboardService.getLawyerDashboard(req.user.id);
        break;
      case 'judge':
        dashboardData = await dashboardService.getJudgeDashboard(req.user.id);
        break;
      case 'admin':
        dashboardData = await dashboardService.getAdminDashboard();
        break;
      default:
        throw new AppError('Invalid user role', 400, 'INVALID_ROLE');
    }
    
    if (!dashboardData.success) {
      throw new AppError(dashboardData.error || 'Failed to fetch quick actions', 500, 'ACTIONS_FETCH_FAILED');
    }
    
    res.status(200).json({
      success: true,
      data: {
        quickActions: dashboardData.data.quickActions
      }
    });
  } catch (error) {
    logger.error('Quick actions fetch failed:', error);
    throw error;
  }
}));

module.exports = router;
