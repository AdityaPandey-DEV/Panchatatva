const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  // Actor information
  actorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  actorEmail: { type: String, required: true }, // Denormalized for performance
  actorRole: { type: String, required: true },
  
  // Action details
  action: {
    type: String,
    required: true,
    enum: [
      // Authentication actions
      'login_attempt', 'login_success', 'login_failed', 'logout',
      'otp_sent', 'otp_verified', 'otp_failed', 'account_locked',
      
      // Case actions
      'case_uploaded', 'case_viewed', 'case_assigned', 'case_accepted',
      'case_declined', 'case_reassigned', 'case_completed', 'case_archived',
      
      // User management
      'user_created', 'user_updated', 'user_deactivated', 'user_reactivated',
      'profile_updated', 'availability_updated', 'conflicts_updated',
      
      // Admin actions
      'system_config_updated', 'user_role_changed', 'assignment_overridden',
      'data_exported', 'audit_log_accessed', 'metrics_accessed',
      
      // Security events
      'unauthorized_access', 'token_revoked', 'suspicious_activity',
      'data_breach_attempt', 'rate_limit_exceeded'
    ]
  },
  
  // Target information
  targetType: {
    type: String,
    enum: ['user', 'case', 'system', 'file', 'session'],
    required: true
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    required: function() {
      return this.targetType !== 'system';
    }
  },
  
  // Request context
  ip: { type: String, required: true },
  userAgent: { type: String },
  sessionId: { type: String },
  requestId: { type: String }, // For tracing requests
  
  // Action metadata (redacted for privacy)
  metadata: {
    success: { type: Boolean },
    errorCode: { type: String },
    errorMessage: { type: String },
    duration: { type: Number }, // milliseconds
    dataSize: { type: Number }, // bytes for file operations
    previousValue: { type: String }, // for update operations (redacted)
    newValue: { type: String }, // for update operations (redacted)
    additionalInfo: { type: mongoose.Schema.Types.Mixed }
  },
  
  // Severity and risk assessment
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'low'
  },
  riskScore: { type: Number, min: 0, max: 100, default: 0 },
  
  // Compliance and retention
  complianceCategory: {
    type: String,
    enum: ['authentication', 'data_access', 'data_modification', 'system_admin', 'security'],
    required: true
  },
  retentionPolicy: {
    deleteAfter: { type: Date },
    archiveAfter: { type: Date }
  },
  
  // Geolocation (if available)
  location: {
    country: { type: String },
    region: { type: String },
    city: { type: String },
    coordinates: {
      lat: { type: Number },
      lng: { type: Number }
    }
  },
  
  // Timestamps
  timestamp: { type: Date, default: Date.now, required: true },
  createdAt: { type: Date, default: Date.now }
}, {
  timestamps: false, // Using custom timestamp field
  collection: 'audit_logs'
});

// Indexes for performance and compliance
auditLogSchema.index({ actorId: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ targetId: 1, targetType: 1, timestamp: -1 });
auditLogSchema.index({ ip: 1, timestamp: -1 });
auditLogSchema.index({ severity: 1, timestamp: -1 });
auditLogSchema.index({ complianceCategory: 1, timestamp: -1 });
auditLogSchema.index({ timestamp: -1 }); // For time-based queries
auditLogSchema.index({ 'retentionPolicy.deleteAfter': 1 }); // For cleanup jobs

// TTL index for automatic cleanup based on retention policy
auditLogSchema.index({ 'retentionPolicy.deleteAfter': 1 }, { expireAfterSeconds: 0 });

// Prevent modification after creation (immutable)
auditLogSchema.pre('save', function(next) {
  if (!this.isNew) {
    return next(new Error('Audit logs cannot be modified after creation'));
  }
  
  // Set default retention policy
  if (!this.retentionPolicy.deleteAfter) {
    const retentionDays = process.env.AUDIT_LOG_RETENTION_DAYS || 365;
    this.retentionPolicy.deleteAfter = new Date(Date.now() + (retentionDays * 24 * 60 * 60 * 1000));
  }
  
  // Set archive date (90% of retention period)
  if (!this.retentionPolicy.archiveAfter) {
    const archiveDays = Math.floor((process.env.AUDIT_LOG_RETENTION_DAYS || 365) * 0.9);
    this.retentionPolicy.archiveAfter = new Date(Date.now() + (archiveDays * 24 * 60 * 60 * 1000));
  }
  
  // Auto-assign risk score based on action and severity
  if (!this.riskScore) {
    this.riskScore = this.calculateRiskScore();
  }
  
  next();
});

// Prevent updates and deletes (immutable audit trail)
auditLogSchema.pre(['updateOne', 'updateMany', 'findOneAndUpdate'], function(next) {
  next(new Error('Audit logs cannot be modified'));
});

auditLogSchema.pre(['deleteOne', 'deleteMany', 'findOneAndDelete'], function(next) {
  next(new Error('Audit logs cannot be manually deleted'));
});

// Method to calculate risk score
auditLogSchema.methods.calculateRiskScore = function() {
  let score = 0;
  
  // Base score by action type
  const actionScores = {
    'login_failed': 20,
    'account_locked': 30,
    'unauthorized_access': 80,
    'data_breach_attempt': 100,
    'suspicious_activity': 70,
    'rate_limit_exceeded': 40,
    'case_assigned': 10,
    'user_role_changed': 50,
    'assignment_overridden': 40,
    'data_exported': 60
  };
  
  score += actionScores[this.action] || 5;
  
  // Severity multiplier
  const severityMultipliers = {
    'low': 1,
    'medium': 1.5,
    'high': 2,
    'critical': 3
  };
  
  score *= severityMultipliers[this.severity] || 1;
  
  // Failed actions increase score
  if (this.metadata && this.metadata.success === false) {
    score *= 1.5;
  }
  
  // Cap at 100
  return Math.min(Math.round(score), 100);
};

// Static method to create audit log entry
auditLogSchema.statics.createEntry = function(params) {
  const {
    actorId,
    actorEmail,
    actorRole,
    action,
    targetType,
    targetId,
    ip,
    userAgent,
    sessionId,
    requestId,
    metadata = {},
    severity = 'low',
    complianceCategory,
    location
  } = params;
  
  return this.create({
    actorId,
    actorEmail,
    actorRole,
    action,
    targetType,
    targetId,
    ip,
    userAgent,
    sessionId,
    requestId,
    metadata,
    severity,
    complianceCategory: complianceCategory || this.getComplianceCategory(action),
    location
  });
};

// Static method to get compliance category from action
auditLogSchema.statics.getComplianceCategory = function(action) {
  const categoryMap = {
    'login_attempt': 'authentication',
    'login_success': 'authentication',
    'login_failed': 'authentication',
    'logout': 'authentication',
    'otp_sent': 'authentication',
    'otp_verified': 'authentication',
    'otp_failed': 'authentication',
    'account_locked': 'security',
    'case_viewed': 'data_access',
    'case_uploaded': 'data_modification',
    'case_assigned': 'data_modification',
    'user_created': 'system_admin',
    'user_updated': 'data_modification',
    'system_config_updated': 'system_admin',
    'unauthorized_access': 'security',
    'data_breach_attempt': 'security'
  };
  
  return categoryMap[action] || 'data_access';
};

// Static method to find suspicious patterns
auditLogSchema.statics.findSuspiciousActivity = function(timeWindow = 24) {
  const since = new Date(Date.now() - (timeWindow * 60 * 60 * 1000));
  
  return this.aggregate([
    { $match: { timestamp: { $gte: since }, riskScore: { $gte: 50 } } },
    {
      $group: {
        _id: { actorId: '$actorId', ip: '$ip' },
        count: { $sum: 1 },
        totalRisk: { $sum: '$riskScore' },
        actions: { $push: '$action' },
        timestamps: { $push: '$timestamp' }
      }
    },
    { $match: { $or: [{ count: { $gte: 5 } }, { totalRisk: { $gte: 200 } }] } },
    { $sort: { totalRisk: -1 } }
  ]);
};

// Static method for compliance reporting
auditLogSchema.statics.getComplianceReport = function(startDate, endDate, category) {
  const match = {
    timestamp: { $gte: startDate, $lte: endDate }
  };
  
  if (category) {
    match.complianceCategory = category;
  }
  
  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          category: '$complianceCategory',
          action: '$action',
          severity: '$severity'
        },
        count: { $sum: 1 },
        avgRiskScore: { $avg: '$riskScore' },
        maxRiskScore: { $max: '$riskScore' }
      }
    },
    { $sort: { '_id.category': 1, '_id.severity': -1, count: -1 } }
  ]);
};

// Transform output to remove sensitive fields
auditLogSchema.methods.toJSON = function() {
  const logObject = this.toObject();
  
  // Redact sensitive metadata
  if (logObject.metadata) {
    delete logObject.metadata.previousValue;
    delete logObject.metadata.newValue;
  }
  
  delete logObject.__v;
  
  return logObject;
};

module.exports = mongoose.model('AuditLog', auditLogSchema);
