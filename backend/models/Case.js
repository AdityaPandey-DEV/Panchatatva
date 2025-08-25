const mongoose = require('mongoose');

const partySchema = new mongoose.Schema({
  name: { type: String },
  type: {
    type: String,
    enum: ['petitioner', 'respondent', 'accused', 'victim', 'plaintiff', 'defendant'],
  },
  email: { type: String },
  representation: { type: String } // lawyer name if mentioned
});

const aiIntakeSchema = new mongoose.Schema({
  parties: [partySchema],
  subjectMatter: { type: String }, // e.g., "IPC 376", "property dispute"
  riskSignals: [{ type: String }], // threats, ongoing harm, public order
  jurisdictionSignals: [{ type: String }], // locations, courts mentioned
  urgency: {
    type: String,
    enum: ['URGENT', 'MODERATE', 'LOW'],
    required: true
  },
  confidence: { type: Number, min: 0, max: 1 },
  reasoningBrief: { type: String }, // 2-3 lines, internal use
  extractedAt: { type: Date, default: Date.now },
  aiModel: { type: String, default: 'gpt-3.5-turbo' },
  processingTime: { type: Number } // milliseconds
});

const newsSignalsSchema = new mongoose.Schema({
  sources: [{
    title: { type: String },
    url: { type: String },
    publishedAt: { type: Date },
    snippet: { type: String },
    relevanceScore: { type: Number, min: 0, max: 1 }
  }],
  score: { type: Number, min: 0, max: 100 }, // news sensitivity score
  lastCheckedAt: { type: Date, default: Date.now },
  keywords: [{ type: String }],
  geoMatch: { type: Boolean, default: false },
  politicalSensitivity: { type: Boolean, default: false },
  publicOrderConcern: { type: Boolean, default: false }
});

const scoreBreakdownSchema = new mongoose.Schema({
  expertiseMatch: { type: Number, min: 0, max: 60 },
  availability: { type: Number, min: 0, max: 20 },
  loadBalance: { type: Number, min: 0, max: 10 },
  seniorityWeight: { type: Number, min: 0, max: 5 },
  rating: { type: Number, min: 0, max: 5 },
  urgencyBonus: { type: Number, min: 0, max: 10 },
  newsSensitivityBonus: { type: Number, min: 0, max: 10 },
  total: { type: Number, min: 0, max: 120 }
});

const assignmentSchema = new mongoose.Schema({
  judgeId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true
  },
  lawyerId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true
  },
  judgeScore: scoreBreakdownSchema,
  lawyerScore: scoreBreakdownSchema,
  assignedAt: { type: Date, default: Date.now },
  acceptedByJudge: { type: Boolean, default: false },
  acceptedByLawyer: { type: Boolean, default: false },
  judgeAcceptedAt: { type: Date },
  lawyerAcceptedAt: { type: Date },
  reassignmentRequested: { type: Boolean, default: false },
  reassignmentReason: { type: String },
  scheduledSlot: {
    date: { type: Date },
    startTime: { type: String },
    endTime: { type: String }
  }
});

const processingStageSchema = new mongoose.Schema({
  stage: {
    type: String,
    enum: ['upload', 'text_extraction', 'ocr_processing', 'ai_classification', 'news_check', 'assignment', 'notification'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'failed'],
    default: 'pending'
  },
  startedAt: { type: Date },
  completedAt: { type: Date },
  error: { type: String },
  metadata: { type: mongoose.Schema.Types.Mixed }
});

const caseSchema = new mongoose.Schema({
  // Basic case information
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: { 
    type: String,
    required: true,
    trim: true
  },
  caseNumber: {
    type: String,
    unique: true,
    sparse: true // allows multiple null values
  },
  jurisdiction: { type: String }, // parsed from document if available
  
  // File storage
  sourcePDF: {
    gridFSId: { type: mongoose.Schema.Types.ObjectId },
    filename: { type: String },
    originalName: { type: String },
    size: { type: Number },
    mimeType: { type: String },
    uploadedAt: { type: Date, default: Date.now }
  },
  
  // Text extraction
  extractedText: { 
    type: String,
    required: true
  },
  textExtractionMethod: {
    type: String,
    enum: ['pdf-parse', 'ocr', 'hybrid'],
    default: 'pdf-parse'
  },
  ocrConfidence: { type: Number, min: 0, max: 1 },
  
  // Processing stages
  processingStages: [processingStageSchema],
  
  // Case status
  status: {
    type: String,
    enum: ['intake', 'processing', 'classified', 'assigned', 'accepted', 'in_progress', 'completed', 'archived', 'error'],
    default: 'intake'
  },
  
  // AI analysis
  aiIntake: aiIntakeSchema,
  
  // News sensitivity
  newsSignals: newsSignalsSchema,
  
  // Final urgency (may be escalated from AI classification)
  finalUrgency: {
    type: String,
    enum: ['URGENT', 'MODERATE', 'LOW'],
    required: true
  },
  urgencyEscalated: { type: Boolean, default: false },
  escalationReason: { type: String },
  
  // Assignment
  assignment: assignmentSchema,
  
  // Case timeline
  submittedAt: { type: Date, default: Date.now },
  classifiedAt: { type: Date },
  assignedAt: { type: Date },
  acceptedAt: { type: Date },
  completedAt: { type: Date },
  
  // Privacy and retention
  encryptedFields: [{ type: String }], // list of fields that are encrypted
  retentionPolicy: {
    deleteAfter: { type: Date },
    archiveAfter: { type: Date },
    reason: { type: String }
  },
  
  // Additional metadata
  tags: [{ type: String }],
  priority: { type: Number, default: 0 }, // for internal sorting
  isPublicInterest: { type: Boolean, default: false },
  isSensitive: { type: Boolean, default: false },
  
  // Audit trail
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  lastAccessedAt: { type: Date },
  accessLog: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    action: { type: String },
    timestamp: { type: Date, default: Date.now },
    ip: { type: String }
  }]
}, {
  timestamps: true
});

// Indexes for performance
caseSchema.index({ clientId: 1, status: 1 });
caseSchema.index({ 'assignment.judgeId': 1, status: 1 });
caseSchema.index({ 'assignment.lawyerId': 1, status: 1 });
caseSchema.index({ finalUrgency: 1, submittedAt: -1 });
caseSchema.index({ status: 1, submittedAt: -1 });
caseSchema.index({ 'aiIntake.urgency': 1, 'newsSignals.score': -1 });
caseSchema.index({ caseNumber: 1 }, { unique: true, sparse: true });

// Auto-generate case number
caseSchema.pre('save', async function(next) {
  if (this.isNew && !this.caseNumber) {
    const year = new Date().getFullYear();
    const count = await this.constructor.countDocuments({
      createdAt: {
        $gte: new Date(year, 0, 1),
        $lt: new Date(year + 1, 0, 1)
      }
    });
    this.caseNumber = `PJA${year}${String(count + 1).padStart(6, '0')}`;
  }
  
  if (this.isModified()) {
    this.updatedAt = new Date();
  }
  
  next();
});

// Virtual for processing time
caseSchema.virtual('totalProcessingTime').get(function() {
  if (!this.submittedAt || !this.assignedAt) return null;
  return this.assignedAt - this.submittedAt;
});

// Method to add processing stage
caseSchema.methods.addProcessingStage = function(stage, status = 'pending', metadata = {}) {
  this.processingStages.push({
    stage,
    status,
    startedAt: status === 'in_progress' ? new Date() : undefined,
    completedAt: status === 'completed' ? new Date() : undefined,
    metadata
  });
  return this.save();
};

// Method to update processing stage
caseSchema.methods.updateProcessingStage = function(stage, status, error = null, metadata = {}) {
  const stageDoc = this.processingStages.find(s => s.stage === stage);
  if (stageDoc) {
    stageDoc.status = status;
    if (status === 'in_progress' && !stageDoc.startedAt) {
      stageDoc.startedAt = new Date();
    }
    if (status === 'completed' || status === 'failed') {
      stageDoc.completedAt = new Date();
    }
    if (error) {
      stageDoc.error = error;
    }
    Object.assign(stageDoc.metadata, metadata);
  }
  return this.save();
};

// Method to check if case is time-sensitive
caseSchema.methods.isTimeSensitive = function() {
  return this.finalUrgency === 'URGENT' || 
         (this.newsSignals && this.newsSignals.score >= 70) ||
         (this.aiIntake && this.aiIntake.riskSignals && this.aiIntake.riskSignals.length > 0);
};

// Method to get case summary for display
caseSchema.methods.getSummary = function(userRole) {
  const summary = {
    _id: this._id,
    caseNumber: this.caseNumber,
    title: this.title,
    status: this.status,
    finalUrgency: this.finalUrgency,
    submittedAt: this.submittedAt,
    assignedAt: this.assignedAt
  };
  
  // Role-based field access
  switch (userRole) {
    case 'client':
      if (this.assignment) {
        summary.assignedJudge = this.assignment.judgeId;
        summary.assignedLawyer = this.assignment.lawyerId;
      }
      break;
    case 'lawyer':
    case 'judge':
      summary.aiIntake = this.aiIntake;
      summary.newsSignals = this.newsSignals;
      summary.assignment = this.assignment;
      break;
    case 'admin':
      return this.toObject(); // Full access
  }
  
  return summary;
};

// Method to log access
caseSchema.methods.logAccess = function(userId, action, ip) {
  this.accessLog.push({
    userId,
    action,
    ip,
    timestamp: new Date()
  });
  this.lastAccessedAt = new Date();
  return this.save();
};

// Static method to find cases by urgency and assignment status
caseSchema.statics.findByUrgencyAndStatus = function(urgency, status) {
  return this.find({
    finalUrgency: urgency,
    status: status
  }).sort({ submittedAt: 1 });
};

// Static method to find unassigned urgent cases
caseSchema.statics.findUnassignedUrgent = function() {
  return this.find({
    finalUrgency: 'URGENT',
    status: { $in: ['classified', 'processing'] },
    assignment: { $exists: false }
  }).sort({ submittedAt: 1 });
};

// Transform output based on user role
caseSchema.methods.toJSON = function() {
  const caseObject = this.toObject();
  
  // Remove sensitive internal fields by default
  delete caseObject.encryptedFields;
  delete caseObject.accessLog;
  delete caseObject.__v;
  
  return caseObject;
};

module.exports = mongoose.model('Case', caseSchema);
