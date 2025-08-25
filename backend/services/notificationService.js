const User = require('../models/User');
const emailService = require('../utils/email');
const logger = require('../utils/logger');

class NotificationService {
  constructor() {
    this.notificationTypes = {
      CASE_ASSIGNED: 'case_assigned',
      CASE_ACCEPTED: 'case_accepted',
      CASE_REJECTED: 'case_rejected',
      CASE_COMPLETED: 'case_completed',
      CASE_ESCALATED: 'case_escalated',
      SYSTEM_MAINTENANCE: 'system_maintenance',
      ACCOUNT_VERIFIED: 'account_verified',
      ROLE_CHANGED: 'role_changed',
      STATUS_CHANGED: 'status_changed'
    };
  }

  // Send notification to a specific user
  async sendNotification(userId, type, data, options = {}) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        logger.warn(`User not found for notification: ${userId}`);
        return { success: false, error: 'User not found' };
      }

      // Check if user is active
      if (user.status !== 'active') {
        logger.info(`Skipping notification for inactive user: ${user.email}`);
        return { success: false, error: 'User inactive' };
      }

      // Send email notification
      const emailResult = await this.sendEmailNotification(user, type, data, options);
      
      // TODO: Add in-app notifications, push notifications, SMS, etc.
      
      logger.info(`Notification sent to ${user.email}: ${type}`, {
        userId: user._id,
        type,
        emailSuccess: emailResult.success
      });

      return { success: true, emailResult };
    } catch (error) {
      logger.error('Notification sending failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Send email notification
  async sendEmailNotification(user, type, data, options = {}) {
    try {
      const emailData = this.buildEmailData(type, data, user);
      
      if (!emailData) {
        logger.warn(`No email template for notification type: ${type}`);
        return { success: false, error: 'No email template' };
      }

      const emailResult = await emailService.sendEmail(
        user.email,
        emailData.subject,
        emailData.html,
        emailData.text
      );

      return { success: true, result: emailResult };
    } catch (error) {
      logger.error('Email notification failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Build email data based on notification type
  buildEmailData(type, data, user) {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    
    switch (type) {
      case this.notificationTypes.CASE_ASSIGNED:
        return {
          subject: 'New Case Assignment',
          html: `
            <h2>New Case Assignment</h2>
            <p>Hello ${user.profile?.name || user.email},</p>
            <p>You have been assigned a new case:</p>
            <ul>
              <li><strong>Case Number:</strong> ${data.caseNumber}</li>
              <li><strong>Title:</strong> ${data.title}</li>
              <li><strong>Urgency:</strong> ${data.urgency}</li>
              <li><strong>Client:</strong> ${data.clientName}</li>
            </ul>
            <p>Please review and accept the case assignment.</p>
            <a href="${baseUrl}/cases/${data.caseId}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Case</a>
            <p>Best regards,<br>Panchtatva Justice System</p>
          `,
          text: `
            New Case Assignment
            
            Hello ${user.profile?.name || user.email},
            
            You have been assigned a new case:
            - Case Number: ${data.caseNumber}
            - Title: ${data.title}
            - Urgency: ${data.urgency}
            - Client: ${data.clientName}
            
            Please review and accept the case assignment.
            View case: ${baseUrl}/cases/${data.caseId}
            
            Best regards,
            Panchtatva Justice System
          `
        };

      case this.notificationTypes.CASE_ACCEPTED:
        return {
          subject: 'Case Accepted',
          html: `
            <h2>Case Accepted</h2>
            <p>Hello ${user.profile?.name || user.email},</p>
            <p>Your case has been accepted:</p>
            <ul>
              <li><strong>Case Number:</strong> ${data.caseNumber}</li>
              <li><strong>Title:</strong> ${data.title}</li>
              <li><strong>Status:</strong> Accepted</li>
            </ul>
            <p>The case is now in progress.</p>
            <a href="${baseUrl}/cases/${data.caseId}" style="background: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Case</a>
            <p>Best regards,<br>Panchtatva Justice System</p>
          `,
          text: `
            Case Accepted
            
            Hello ${user.profile?.name || user.email},
            
            Your case has been accepted:
            - Case Number: ${data.caseNumber}
            - Title: ${data.title}
            - Status: Accepted
            
            The case is now in progress.
            View case: ${baseUrl}/cases/${data.caseId}
            
            Best regards,
            Panchtatva Justice System
          `
        };

      case this.notificationTypes.CASE_REJECTED:
        return {
          subject: 'Case Assignment Rejected',
          html: `
            <h2>Case Assignment Rejected</h2>
            <p>Hello ${user.profile?.name || user.email},</p>
            <p>A case assignment has been rejected:</p>
            <ul>
              <li><strong>Case Number:</strong> ${data.caseNumber}</li>
              <li><strong>Title:</strong> ${data.title}</li>
              <li><strong>Reason:</strong> ${data.reason}</li>
            </ul>
            <p>The case will be reassigned to another professional.</p>
            <p>Best regards,<br>Panchtatva Justice System</p>
          `,
          text: `
            Case Assignment Rejected
            
            Hello ${user.profile?.name || user.email},
            
            A case assignment has been rejected:
            - Case Number: ${data.caseNumber}
            - Title: ${data.title}
            - Reason: ${data.reason}
            
            The case will be reassigned to another professional.
            
            Best regards,
            Panchtatva Justice System
          `
        };

      case this.notificationTypes.ACCOUNT_VERIFIED:
        return {
          subject: 'Account Verified',
          html: `
            <h2>Account Verification Complete</h2>
            <p>Hello ${user.profile?.name || user.email},</p>
            <p>Your account has been successfully verified!</p>
            <p>You can now access all features of the Panchtatva Justice System.</p>
            <a href="${baseUrl}/dashboard" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Go to Dashboard</a>
            <p>Best regards,<br>Panchtatva Justice System</p>
          `,
          text: `
            Account Verification Complete
            
            Hello ${user.profile?.name || user.email},
            
            Your account has been successfully verified!
            You can now access all features of the Panchtatva Justice System.
            
            Go to Dashboard: ${baseUrl}/dashboard
            
            Best regards,
            Panchtatva Justice System
          `
        };

      case this.notificationTypes.ROLE_CHANGED:
        return {
          subject: 'Role Updated',
          html: `
            <h2>Role Update</h2>
            <p>Hello ${user.profile?.name || user.email},</p>
            <p>Your role has been updated:</p>
            <ul>
              <li><strong>Previous Role:</strong> ${data.oldRole}</li>
              <li><strong>New Role:</strong> ${data.newRole}</li>
              <li><strong>Reason:</strong> ${data.reason || 'Administrative update'}</li>
            </ul>
            <p>Please log in again to see the updated interface.</p>
            <a href="${baseUrl}/auth" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Login</a>
            <p>Best regards,<br>Panchtatva Justice System</p>
          `,
          text: `
            Role Update
            
            Hello ${user.profile?.name || user.email},
            
            Your role has been updated:
            - Previous Role: ${data.oldRole}
            - New Role: ${data.newRole}
            - Reason: ${data.reason || 'Administrative update'}
            
            Please log in again to see the updated interface.
            Login: ${baseUrl}/auth
            
            Best regards,
            Panchtatva Justice System
          `
        };

      case this.notificationTypes.SYSTEM_MAINTENANCE:
        return {
          subject: 'System Maintenance Notice',
          html: `
            <h2>System Maintenance</h2>
            <p>Hello ${user.profile?.name || user.email},</p>
            <p>The Panchtatva Justice System will be undergoing maintenance:</p>
            <ul>
              <li><strong>Duration:</strong> ${data.estimatedDuration} minutes</li>
              <li><strong>Message:</strong> ${data.message}</li>
            </ul>
            <p>We apologize for any inconvenience. The system will be back online shortly.</p>
            <p>Best regards,<br>Panchtatva Justice System</p>
          `,
          text: `
            System Maintenance
            
            Hello ${user.profile?.name || user.email},
            
            The Panchtatva Justice System will be undergoing maintenance:
            - Duration: ${data.estimatedDuration} minutes
            - Message: ${data.message}
            
            We apologize for any inconvenience. The system will be back online shortly.
            
            Best regards,
            Panchtatva Justice System
          `
        };

      default:
        return null;
    }
  }

  // Send bulk notifications
  async sendBulkNotifications(userIds, type, data, options = {}) {
    const results = [];
    
    for (const userId of userIds) {
      const result = await this.sendNotification(userId, type, data, options);
      results.push({ userId, result });
    }
    
    return results;
  }

  // Send notification to users by role
  async sendNotificationByRole(role, type, data, options = {}) {
    try {
      const users = await User.find({ role, status: 'active' });
      const userIds = users.map(user => user._id);
      
      return await this.sendBulkNotifications(userIds, type, data, options);
    } catch (error) {
      logger.error('Role-based notification failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Send case assignment notifications
  async sendCaseAssignmentNotifications(caseData, judgeId, lawyerId) {
    try {
      const notifications = [];
      
      // Notify judge
      if (judgeId) {
        const judgeNotification = await this.sendNotification(
          judgeId,
          this.notificationTypes.CASE_ASSIGNED,
          {
            caseId: caseData._id,
            caseNumber: caseData.caseNumber,
            title: caseData.title,
            urgency: caseData.finalUrgency,
            clientName: caseData.clientId?.profile?.name || 'Unknown'
          }
        );
        notifications.push({ type: 'judge', result: judgeNotification });
      }
      
      // Notify lawyer
      if (lawyerId) {
        const lawyerNotification = await this.sendNotification(
          lawyerId,
          this.notificationTypes.CASE_ASSIGNED,
          {
            caseId: caseData._id,
            caseNumber: caseData.caseNumber,
            title: caseData.title,
            urgency: caseData.finalUrgency,
            clientName: caseData.clientId?.profile?.name || 'Unknown'
          }
        );
        notifications.push({ type: 'lawyer', result: lawyerNotification });
      }
      
      return notifications;
    } catch (error) {
      logger.error('Case assignment notifications failed:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new NotificationService();
