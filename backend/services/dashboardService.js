const User = require('../models/User');
const Case = require('../models/Case');
const AuditLog = require('../models/AuditLog');
const logger = require('../utils/logger');

class DashboardService {
  constructor() {
    this.timeRanges = {
      last24Hours: 24 * 60 * 60 * 1000,
      last7Days: 7 * 24 * 60 * 60 * 1000,
      last30Days: 30 * 24 * 60 * 60 * 1000,
      last90Days: 90 * 24 * 60 * 60 * 1000
    };
  }

  // Get client dashboard data
  async getClientDashboard(userId) {
    try {
      const now = new Date();
      const last30Days = new Date(now - this.timeRanges.last30Days);

      const [cases, recentActivity] = await Promise.all([
        Case.find({ clientId: userId })
          .sort({ updatedAt: -1 })
          .limit(10)
          .select('caseNumber title status finalUrgency submittedAt updatedAt'),
        
        AuditLog.find({
          targetId: userId,
          timestamp: { $gte: last30Days }
        })
          .sort({ timestamp: -1 })
          .limit(20)
          .select('action timestamp metadata')
      ]);

      const stats = {
        totalCases: await Case.countDocuments({ clientId: userId }),
        activeCases: await Case.countDocuments({ 
          clientId: userId, 
          status: { $in: ['intake', 'processing', 'classified', 'assigned', 'accepted', 'in_progress'] }
        }),
        completedCases: await Case.countDocuments({ 
          clientId: userId, 
          status: 'completed' 
        }),
        urgentCases: await Case.countDocuments({ 
          clientId: userId, 
          finalUrgency: 'URGENT',
          status: { $nin: ['completed', 'archived'] }
        })
      };

      return {
        success: true,
        data: {
          stats,
          recentCases: cases,
          recentActivity,
          quickActions: [
            { name: 'Upload New Case', action: 'upload_case', url: '/cases/upload' },
            { name: 'View All Cases', action: 'view_cases', url: '/cases' },
            { name: 'Update Profile', action: 'update_profile', url: '/profile' }
          ]
        }
      };
    } catch (error) {
      logger.error('Client dashboard data fetch failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Get lawyer dashboard data
  async getLawyerDashboard(userId) {
    try {
      const now = new Date();
      const last30Days = new Date(now - this.timeRanges.last30Days);

      const [assignedCases, completedCases, recentActivity] = await Promise.all([
        Case.find({ 
          'assignment.lawyerId': userId,
          status: { $in: ['assigned', 'accepted', 'in_progress'] }
        })
          .populate('clientId', 'email profile.name')
          .sort({ updatedAt: -1 })
          .limit(10)
          .select('caseNumber title status finalUrgency clientId submittedAt'),
        
        Case.find({ 
          'assignment.lawyerId': userId,
          status: 'completed',
          completedAt: { $gte: last30Days }
        })
          .populate('clientId', 'email profile.name')
          .sort({ completedAt: -1 })
          .limit(5)
          .select('caseNumber title clientId completedAt'),
        
        AuditLog.find({
          actorId: userId,
          timestamp: { $gte: last30Days }
        })
          .sort({ timestamp: -1 })
          .limit(20)
          .select('action timestamp targetType targetId metadata')
      ]);

      const stats = {
        totalAssigned: await Case.countDocuments({ 
          'assignment.lawyerId': userId,
          status: { $in: ['assigned', 'accepted', 'in_progress'] }
        }),
        pendingAcceptance: await Case.countDocuments({ 
          'assignment.lawyerId': userId,
          status: 'assigned',
          'assignment.acceptedByLawyer': false
        }),
        completedThisMonth: await Case.countDocuments({ 
          'assignment.lawyerId': userId,
          status: 'completed',
          completedAt: { $gte: last30Days }
        }),
        averageProcessingTime: await this.calculateAverageProcessingTime(userId, 'lawyer')
      };

      return {
        success: true,
        data: {
          stats,
          assignedCases,
          completedCases,
          recentActivity,
          quickActions: [
            { name: 'Accept Cases', action: 'accept_cases', url: '/cases?status=assigned' },
            { name: 'Update Case Status', action: 'update_status', url: '/cases' },
            { name: 'View Schedule', action: 'view_schedule', url: '/schedule' }
          ]
        }
      };
    } catch (error) {
      logger.error('Lawyer dashboard data fetch failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Get judge dashboard data
  async getJudgeDashboard(userId) {
    try {
      const now = new Date();
      const last30Days = new Date(now - this.timeRanges.last30Days);

      const [assignedCases, completedCases, recentActivity] = await Promise.all([
        Case.find({ 
          'assignment.judgeId': userId,
          status: { $in: ['assigned', 'accepted', 'in_progress'] }
        })
          .populate('clientId', 'email profile.name')
          .populate('assignment.lawyerId', 'email profile.name')
          .sort({ finalUrgency: -1, submittedAt: 1 })
          .limit(10)
          .select('caseNumber title status finalUrgency clientId assignment.lawyerId submittedAt'),
        
        Case.find({ 
          'assignment.judgeId': userId,
          status: 'completed',
          completedAt: { $gte: last30Days }
        })
          .populate('clientId', 'email profile.name')
          .populate('assignment.lawyerId', 'email profile.name')
          .sort({ completedAt: -1 })
          .limit(5)
          .select('caseNumber title clientId assignment.lawyerId completedAt'),
        
        AuditLog.find({
          actorId: userId,
          timestamp: { $gte: last30Days }
        })
          .sort({ timestamp: -1 })
          .limit(20)
          .select('action timestamp targetType targetId metadata')
      ]);

      const stats = {
        totalAssigned: await Case.countDocuments({ 
          'assignment.judgeId': userId,
          status: { $in: ['assigned', 'accepted', 'in_progress'] }
        }),
        pendingAcceptance: await Case.countDocuments({ 
          'assignment.judgeId': userId,
          status: 'assigned',
          'assignment.acceptedByJudge': false
        }),
        urgentCases: await Case.countDocuments({ 
          'assignment.judgeId': userId,
          finalUrgency: 'URGENT',
          status: { $in: ['assigned', 'accepted', 'in_progress'] }
        }),
        completedThisMonth: await Case.countDocuments({ 
          'assignment.judgeId': userId,
          status: 'completed',
          completedAt: { $gte: last30Days }
        })
      };

      return {
        success: true,
        data: {
          stats,
          assignedCases,
          completedCases,
          recentActivity,
          quickActions: [
            { name: 'Accept Cases', action: 'accept_cases', url: '/cases?status=assigned' },
            { name: 'Review Urgent Cases', action: 'review_urgent', url: '/cases?urgency=URGENT' },
            { name: 'Update Case Status', action: 'update_status', url: '/cases' }
          ]
        }
      };
    } catch (error) {
      logger.error('Judge dashboard data fetch failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Get admin dashboard data
  async getAdminDashboard() {
    try {
      const now = new Date();
      const last24Hours = new Date(now - this.timeRanges.last24Hours);
      const last7Days = new Date(now - this.timeRanges.last7Days);
      const last30Days = new Date(now - this.timeRanges.last30Days);

      const [userStats, caseStats, systemStats, recentActivity] = await Promise.all([
        this.getUserStatistics(last7Days, last30Days),
        this.getCaseStatistics(last24Hours, last7Days, last30Days),
        this.getSystemStatistics(),
        AuditLog.find({ timestamp: { $gte: last24Hours } })
          .sort({ timestamp: -1 })
          .limit(50)
          .populate('actorId', 'email profile.name')
          .select('action timestamp actorId actorRole targetType targetId severity')
      ]);

      return {
        success: true,
        data: {
          userStats,
          caseStats,
          systemStats,
          recentActivity,
          quickActions: [
            { name: 'User Management', action: 'manage_users', url: '/admin/users' },
            { name: 'Case Management', action: 'manage_cases', url: '/admin/cases' },
            { name: 'System Health', action: 'system_health', url: '/admin/system/health' },
            { name: 'Audit Logs', action: 'view_logs', url: '/admin/audit-logs' }
          ]
        }
      };
    } catch (error) {
      logger.error('Admin dashboard data fetch failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Get user statistics
  async getUserStatistics(last7Days, last30Days) {
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
          activeUsers: [
            { $match: { lastLoginAt: { $gte: last30Days } } },
            { $count: 'count' }
          ]
        }
      }
    ]);

    return {
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
      activeUsers: stats[0].activeUsers[0]?.count || 0
    };
  }

  // Get case statistics
  async getCaseStatistics(last24Hours, last7Days, last30Days) {
    const stats = await Case.aggregate([
      {
        $facet: {
          totalCases: [{ $count: 'count' }],
          byStatus: [
            { $group: { _id: '$status', count: { $sum: 1 } } }
          ],
          byUrgency: [
            { $group: { _id: '$finalUrgency', count: { $sum: 1 } } }
          ],
          newCases: [
            { $match: { createdAt: { $gte: last24Hours } } },
            { $count: 'count' }
          ],
          completedCases: [
            { $match: { 
              status: 'completed',
              completedAt: { $gte: last7Days }
            }},
            { $count: 'count' }
          ],
          averageProcessingTime: [
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
          ]
        }
      }
    ]);

    return {
      totalCases: stats[0].totalCases[0]?.count || 0,
      byStatus: stats[0].byStatus.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      byUrgency: stats[0].byUrgency.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      newCases: stats[0].newCases[0]?.count || 0,
      completedCases: stats[0].completedCases[0]?.count || 0,
      averageProcessingTime: stats[0].averageProcessingTime[0]?.avgTime || 0
    };
  }

  // Get system statistics
  async getSystemStatistics() {
    return {
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || 'development',
      databaseStatus: 'connected', // TODO: Add actual DB health check
      lastBackup: null, // TODO: Add backup tracking
      systemLoad: 'normal' // TODO: Add actual system load monitoring
    };
  }

  // Calculate average processing time for a user
  async calculateAverageProcessingTime(userId, userRole) {
    try {
      const field = userRole === 'lawyer' ? 'assignment.lawyerId' : 'assignment.judgeId';
      
      const result = await Case.aggregate([
        { 
          $match: { 
            [field]: userId,
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
      ]);

      return result[0]?.avgTime || 0;
    } catch (error) {
      logger.error('Processing time calculation failed:', error);
      return 0;
    }
  }
}

module.exports = new DashboardService();
