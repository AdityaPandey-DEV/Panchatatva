const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const availabilitySlotSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  startTime: { type: String, required: true }, // "09:00"
  endTime: { type: String, required: true },   // "17:00"
  isAvailable: { type: Boolean, default: true },
  maxCases: { type: Number, default: 1 }
});

const jwtSessionSchema = new mongoose.Schema({
  tokenId: { type: String, required: true },
  device: { type: String },
  ip: { type: String },
  userAgent: { type: String },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  isRevoked: { type: Boolean, default: false }
});

const clientProfileSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String },
  region: { type: String },
  consentToDataPolicy: { type: Boolean, required: true, default: false },
  preferredLanguage: { type: String, default: 'en' }
});

const lawyerProfileSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String },
  practiceAreas: [{
    type: String,
    enum: ['criminal', 'civil', 'cyber', 'corporate', 'family', 'constitutional', 'tax', 'labor', 'environmental', 'intellectual_property'],
    required: true
  }],
  yearsOfExperience: { type: Number, required: true, min: 0 },
  barId: { type: String },
  maxConcurrentCases: { type: Number, default: 10, min: 1 },
  currentCaseLoad: { type: Number, default: 0 },
  conflicts: [{
    email: { type: String },
    caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Case' },
    reason: { type: String },
    addedAt: { type: Date, default: Date.now }
  }],
  rating: { type: Number, default: 0, min: 0, max: 5 },
  specializations: [{ type: String }],
  languages: [{ type: String, default: ['en'] }],
  courtPreferences: [{ type: String }]
});

const judgeProfileSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String },
  specializationTags: [{
    type: String,
    enum: ['criminal', 'civil', 'cyber', 'corporate', 'family', 'constitutional', 'tax', 'labor', 'environmental', 'intellectual_property'],
    required: true
  }],
  seniorityLevel: {
    type: String,
    enum: ['junior', 'senior', 'chief'],
    required: true,
    default: 'junior'
  },
  maxDailyIntake: { type: Number, default: 5, min: 1 },
  currentDailyLoad: { type: Number, default: 0 },
  conflicts: [{
    email: { type: String },
    caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Case' },
    reason: { type: String },
    addedAt: { type: Date, default: Date.now }
  }],
  rating: { type: Number, default: 0, min: 0, max: 5 },
  courtAssignment: { type: String },
  jurisdictions: [{ type: String }],
  languages: [{ type: String, default: ['en'] }]
});

const adminProfileSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String },
  department: { type: String },
  permissions: [{
    type: String,
    enum: ['user_management', 'case_management', 'system_config', 'audit_logs', 'reports'],
    default: ['user_management', 'case_management']
  }]
});

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  role: {
    type: String,
    required: true,
    enum: ['client', 'lawyer', 'judge', 'admin'],
    default: 'client'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  
  // OTP fields
  otpHash: { type: String },
  otpExpiresAt: { type: Date },
  otpAttempts: { type: Number, default: 0 },
  otpLockedUntil: { type: Date },
  
  // JWT sessions
  jwtSessions: [jwtSessionSchema],
  
  // Availability calendar (for lawyers and judges)
  availability: [availabilitySlotSchema],
  
  // Role-specific profiles
  clientProfile: clientProfileSchema,
  lawyerProfile: lawyerProfileSchema,
  judgeProfile: judgeProfileSchema,
  adminProfile: adminProfileSchema,
  
  // Audit fields
  lastLoginAt: { type: Date },
  loginAttempts: { type: Number, default: 0 },
  accountLockedUntil: { type: Date },
  
  // Metadata
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ 'lawyerProfile.practiceAreas': 1 });
userSchema.index({ 'judgeProfile.specializationTags': 1 });
userSchema.index({ 'availability.date': 1 });

// Virtual for getting profile based on role
userSchema.virtual('profile').get(function() {
  switch (this.role) {
    case 'client':
      return this.clientProfile;
    case 'lawyer':
      return this.lawyerProfile;
    case 'judge':
      return this.judgeProfile;
    case 'admin':
      return this.adminProfile;
    default:
      return null;
  }
});

// Hash OTP before saving
userSchema.pre('save', async function(next) {
  if (this.isModified('otpHash') && this.otpHash) {
    this.otpHash = await bcrypt.hash(this.otpHash, 12);
  }
  
  if (this.isModified()) {
    this.updatedAt = new Date();
  }
  
  next();
});

// Method to verify OTP
userSchema.methods.verifyOTP = async function(otp) {
  if (!this.otpHash || !this.otpExpiresAt) {
    return false;
  }
  
  if (new Date() > this.otpExpiresAt) {
    return false;
  }
  
  return await bcrypt.compare(otp, this.otpHash);
};

// Method to check if account is locked
userSchema.methods.isLocked = function() {
  return !!(this.accountLockedUntil && this.accountLockedUntil > Date.now());
};

// Method to check if OTP is locked
userSchema.methods.isOTPLocked = function() {
  return !!(this.otpLockedUntil && this.otpLockedUntil > Date.now());
};

// Method to increment login attempts
userSchema.methods.incLoginAttempts = function() {
  if (this.accountLockedUntil && this.accountLockedUntil < Date.now()) {
    return this.updateOne({
      $unset: { accountLockedUntil: 1, loginAttempts: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  if (this.loginAttempts + 1 >= 5 && !this.isLocked()) {
    updates.$set = {
      accountLockedUntil: Date.now() + 2 * 60 * 60 * 1000 // 2 hours
    };
  }
  
  return this.updateOne(updates);
};

// Method to add JWT session
userSchema.methods.addJWTSession = function(tokenId, device, ip, userAgent, expiresAt) {
  this.jwtSessions.push({
    tokenId,
    device,
    ip,
    userAgent,
    expiresAt
  });
  return this.save();
};

// Method to revoke JWT session
userSchema.methods.revokeJWTSession = function(tokenId) {
  const session = this.jwtSessions.id(tokenId);
  if (session) {
    session.isRevoked = true;
    return this.save();
  }
  return Promise.resolve();
};

// Method to clean expired sessions
userSchema.methods.cleanExpiredSessions = function() {
  this.jwtSessions = this.jwtSessions.filter(session => 
    !session.isRevoked && session.expiresAt > new Date()
  );
  return this.save();
};

// Method to get available slots for a date range
userSchema.methods.getAvailableSlots = function(startDate, endDate) {
  return this.availability.filter(slot => 
    slot.date >= startDate && 
    slot.date <= endDate && 
    slot.isAvailable
  );
};

// Static method to find available lawyers by expertise
userSchema.statics.findAvailableLawyers = function(practiceAreas, excludeConflicts = []) {
  const query = {
    role: 'lawyer',
    isActive: true,
    'lawyerProfile.practiceAreas': { $in: practiceAreas },
    $expr: { $lt: ['$lawyerProfile.currentCaseLoad', '$lawyerProfile.maxConcurrentCases'] }
  };
  
  if (excludeConflicts.length > 0) {
    query['lawyerProfile.conflicts.email'] = { $nin: excludeConflicts };
  }
  
  return this.find(query);
};

// Static method to find available judges by specialization
userSchema.statics.findAvailableJudges = function(specializationTags, excludeConflicts = []) {
  const query = {
    role: 'judge',
    isActive: true,
    'judgeProfile.specializationTags': { $in: specializationTags },
    $expr: { $lt: ['$judgeProfile.currentDailyLoad', '$judgeProfile.maxDailyIntake'] }
  };
  
  if (excludeConflicts.length > 0) {
    query['judgeProfile.conflicts.email'] = { $nin: excludeConflicts };
  }
  
  return this.find(query);
};

// Transform output to remove sensitive fields
userSchema.methods.toJSON = function() {
  const userObject = this.toObject();
  
  delete userObject.otpHash;
  delete userObject.jwtSessions;
  delete userObject.loginAttempts;
  delete userObject.accountLockedUntil;
  delete userObject.otpAttempts;
  delete userObject.otpLockedUntil;
  delete userObject.__v;
  
  return userObject;
};

module.exports = mongoose.model('User', userSchema);
