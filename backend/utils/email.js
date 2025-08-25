const nodemailer = require('nodemailer');
const logger = require('./logger');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransporter({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT) || 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_HOST_USER,
        pass: process.env.EMAIL_HOST_PASSWORD, // App password for Gmail
      },
      tls: {
        rejectUnauthorized: process.env.NODE_ENV === 'production'
      }
    });
    
    // Verify connection on startup
    this.verifyConnection();
  }
  
  async verifyConnection() {
    try {
      await this.transporter.verify();
      logger.info('Email service connected successfully');
    } catch (error) {
      logger.error('Email service connection failed:', error);
    }
  }
  
  async sendOTP(email, otp, name = null) {
    const mailOptions = {
      from: {
        name: 'Panchtatva Justice System',
        address: process.env.EMAIL_HOST_USER
      },
      to: email,
      subject: 'Your Login OTP - Panchtatva Justice System',
      html: this.getOTPTemplate(otp, name),
      text: `Your OTP for Panchtatva Justice System login is: ${otp}. This OTP will expire in 5 minutes. Do not share this code with anyone.`
    };
    
    try {
      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`OTP sent successfully to ${email}`, { messageId: info.messageId });
      return { success: true, messageId: info.messageId };
    } catch (error) {
      logger.error(`Failed to send OTP to ${email}:`, error);
      return { success: false, error: error.message };
    }
  }
  
  async sendCaseAssignmentNotification(email, caseDetails, userRole, name = null) {
    const subject = `New Case Assignment - ${caseDetails.caseNumber}`;
    const html = this.getCaseAssignmentTemplate(caseDetails, userRole, name);
    
    const mailOptions = {
      from: {
        name: 'Panchtatva Justice System',
        address: process.env.EMAIL_HOST_USER
      },
      to: email,
      subject,
      html,
    };
    
    try {
      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`Case assignment notification sent to ${email}`, { 
        messageId: info.messageId,
        caseNumber: caseDetails.caseNumber 
      });
      return { success: true, messageId: info.messageId };
    } catch (error) {
      logger.error(`Failed to send case assignment notification to ${email}:`, error);
      return { success: false, error: error.message };
    }
  }
  
  async sendCaseStatusUpdate(email, caseDetails, status, name = null) {
    const subject = `Case Status Update - ${caseDetails.caseNumber}`;
    const html = this.getCaseStatusTemplate(caseDetails, status, name);
    
    const mailOptions = {
      from: {
        name: 'Panchtatva Justice System',
        address: process.env.EMAIL_HOST_USER
      },
      to: email,
      subject,
      html,
    };
    
    try {
      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`Case status update sent to ${email}`, { 
        messageId: info.messageId,
        caseNumber: caseDetails.caseNumber,
        status 
      });
      return { success: true, messageId: info.messageId };
    } catch (error) {
      logger.error(`Failed to send case status update to ${email}:`, error);
      return { success: false, error: error.message };
    }
  }
  
  getOTPTemplate(otp, name) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your OTP - Panchtatva Justice System</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .otp-code { background: #667eea; color: white; font-size: 32px; font-weight: bold; text-align: center; padding: 20px; margin: 20px 0; border-radius: 8px; letter-spacing: 8px; }
            .warning { background: #fff3cd; border: 1px solid #ffeaa7; color: #856404; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>⚖️ Panchtatva Justice System</h1>
                <p>AI-powered legal case management</p>
            </div>
            <div class="content">
                ${name ? `<p>Hello ${name},</p>` : '<p>Hello,</p>'}
                
                <p>You have requested to log in to the Panchtatva Justice System. Please use the following OTP to complete your authentication:</p>
                
                <div class="otp-code">${otp}</div>
                
                <div class="warning">
                    <strong>⚠️ Security Notice:</strong>
                    <ul>
                        <li>This OTP will expire in <strong>5 minutes</strong></li>
                        <li>Do not share this code with anyone</li>
                        <li>If you didn't request this OTP, please ignore this email</li>
                    </ul>
                </div>
                
                <p>If you're having trouble logging in, please contact system administration.</p>
                
                <p>Best regards,<br>Panchtatva Justice System</p>
            </div>
            <div class="footer">
                <p>This is an automated message. Please do not reply to this email.</p>
                <p>&copy; 2024 Panchtatva Justice System. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }
  
  getCaseAssignmentTemplate(caseDetails, userRole, name) {
    const urgencyColors = {
      'URGENT': '#dc3545',
      'MODERATE': '#fd7e14',
      'LOW': '#28a745'
    };
    
    const urgencyColor = urgencyColors[caseDetails.finalUrgency] || '#6c757d';
    
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Case Assignment</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .case-info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }
            .urgency-badge { display: inline-block; padding: 8px 16px; border-radius: 20px; color: white; font-weight: bold; background-color: ${urgencyColor}; }
            .action-button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>⚖️ New Case Assignment</h1>
            </div>
            <div class="content">
                ${name ? `<p>Dear ${name},</p>` : '<p>Dear Colleague,</p>'}
                
                <p>You have been assigned a new case in the Panchtatva Justice System:</p>
                
                <div class="case-info">
                    <h3>${caseDetails.title}</h3>
                    <p><strong>Case Number:</strong> ${caseDetails.caseNumber}</p>
                    <p><strong>Urgency:</strong> <span class="urgency-badge">${caseDetails.finalUrgency}</span></p>
                    <p><strong>Submitted:</strong> ${new Date(caseDetails.submittedAt).toLocaleString()}</p>
                    ${caseDetails.jurisdiction ? `<p><strong>Jurisdiction:</strong> ${caseDetails.jurisdiction}</p>` : ''}
                </div>
                
                <p>Please log in to the system to review the case details and ${userRole === 'judge' ? 'accept or decline' : 'begin working on'} this assignment.</p>
                
                <a href="${process.env.FRONTEND_URL}/dashboard" class="action-button">View Case Details</a>
                
                <p>Best regards,<br>Panchtatva Justice System</p>
            </div>
            <div class="footer">
                <p>This is an automated message. Please do not reply to this email.</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }
  
  getCaseStatusTemplate(caseDetails, status, name) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Case Status Update</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .case-info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745; }
            .status-badge { display: inline-block; padding: 8px 16px; border-radius: 20px; color: white; font-weight: bold; background-color: #28a745; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>📋 Case Status Update</h1>
            </div>
            <div class="content">
                ${name ? `<p>Dear ${name},</p>` : '<p>Dear Client,</p>'}
                
                <p>Your case status has been updated:</p>
                
                <div class="case-info">
                    <h3>${caseDetails.title}</h3>
                    <p><strong>Case Number:</strong> ${caseDetails.caseNumber}</p>
                    <p><strong>New Status:</strong> <span class="status-badge">${status.toUpperCase()}</span></p>
                    <p><strong>Updated:</strong> ${new Date().toLocaleString()}</p>
                </div>
                
                <p>You can log in to view more details about your case progress.</p>
                
                <p>Best regards,<br>Panchtatva Justice System</p>
            </div>
            <div class="footer">
                <p>This is an automated message. Please do not reply to this email.</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }
}

module.exports = new EmailService();
