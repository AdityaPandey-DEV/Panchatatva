const User = require('../models/User');
const Case = require('../models/Case');
const AuditLog = require('../models/AuditLog');
const emailService = require('../utils/email');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');

class AssignmentService {
  constructor() {
    // Scoring weights (total should be 100)
    this.scoringWeights = {
      expertiseMatch: 60,    // 0-60 points
      availability: 20,      // 0-20 points
      loadBalance: 10,       // 0-10 points
      seniorityWeight: 5,    // 0-5 points
      rating: 5,             // 0-5 points
      urgencyBonus: 10,      // 0-10 bonus points
      newsSensitivityBonus: 10 // 0-10 bonus points
    };
    
    // Minimum scores for assignment
    this.minScoreThresholds = {
      judge: 40,
      lawyer: 35
    };
  }
  
  // Main assignment method
  async assignCase(caseId) {
    const startTime = Date.now();
    
    try {
      // Get case details
      const caseDoc = await Case.findById(caseId).populate('clientId');
      if (!caseDoc) {
        throw new AppError('Case not found', 404, 'CASE_NOT_FOUND');
      }
      
      // Extract assignment criteria from AI intake
      const criteria = this.extractAssignmentCriteria(caseDoc);
      
      // Find available judges and lawyers
      const [availableJudges, availableLawyers] = await Promise.all([
        this.findAvailableJudges(criteria),
        this.findAvailableLawyers(criteria)
      ]);
      
      // Score and rank candidates
      const rankedJudges = await this.scoreAndRankJudges(availableJudges, caseDoc, criteria);
      const rankedLawyers = await this.scoreAndRankLawyers(availableLawyers, caseDoc, criteria);
      
      // Select best candidates
      const selectedJudge = this.selectBestCandidate(rankedJudges, 'judge');
      const selectedLawyer = this.selectBestCandidate(rankedLawyers, 'lawyer');
      
      if (!selectedJudge || !selectedLawyer) {
        // No suitable candidates found - escalate to admin
        await this.escalateToAdmin(caseDoc, rankedJudges, rankedLawyers);
        return {
          success: false,
          reason: 'No suitable candidates found',
          escalated: true
        };
      }
      
      // Create assignment
      const assignment = {
        judgeId: selectedJudge.user._id,
        lawyerId: selectedLawyer.user._id,
        judgeScore: selectedJudge.scoreBreakdown,
        lawyerScore: selectedLawyer.scoreBreakdown,
        assignedAt: new Date()
      };
      
      // Update case
      caseDoc.assignment = assignment;
      caseDoc.status = 'assigned';
      caseDoc.assignedAt = new Date();
      await caseDoc.save();
      
      // Update user loads
      await this.updateUserLoads(selectedJudge.user, selectedLawyer.user);
      
      // Send notifications
      await this.sendAssignmentNotifications(caseDoc, selectedJudge.user, selectedLawyer.user);
      
      // Log assignment
      await this.logAssignment(caseDoc, selectedJudge, selectedLawyer);
      
      const processingTime = Date.now() - startTime;
      
      logger.info(`Case assigned successfully: ${caseDoc.caseNumber}`, {
        judge: selectedJudge.user.email,
        lawyer: selectedLawyer.user.email,
        processingTime
      });
      
      return {
        success: true,
        assignment: {
          judge: {
            id: selectedJudge.user._id,
            email: selectedJudge.user.email,
            name: selectedJudge.user.judgeProfile.name,
            score: selectedJudge.totalScore
          },
          lawyer: {
            id: selectedLawyer.user._id,
            email: selectedLawyer.user.email,
            name: selectedLawyer.user.lawyerProfile.name,
            score: selectedLawyer.totalScore
          }
        },
        processingTime
      };
      
    } catch (error) {
      logger.error(`Assignment failed for case ${caseId}:`, error);
      throw error;
    }
  }
  
  // Extract assignment criteria from case
  extractAssignmentCriteria(caseDoc) {
    const criteria = {
      practiceAreas: [],
      specializationTags: [],
      urgency: caseDoc.finalUrgency,
      newsSensitivityScore: caseDoc.newsSignals?.score || 0,
      jurisdiction: caseDoc.jurisdiction,
      complexity: caseDoc.aiIntake?.estimatedComplexity || 'medium',
      conflictEmails: []
    };
    
    // Extract practice areas from AI classification
    if (caseDoc.aiIntake?.suggestedExpertise) {
      criteria.practiceAreas = caseDoc.aiIntake.suggestedExpertise;
      criteria.specializationTags = caseDoc.aiIntake.suggestedExpertise;
    }
    
    // Map subject matter to practice areas
    if (caseDoc.aiIntake?.subjectMatter) {
      const mappedAreas = this.mapSubjectToPracticeAreas(caseDoc.aiIntake.subjectMatter);
      criteria.practiceAreas.push(...mappedAreas);
      criteria.specializationTags.push(...mappedAreas);
    }
    
    // Add conflict emails from parties
    if (caseDoc.aiIntake?.parties) {
      criteria.conflictEmails = caseDoc.aiIntake.parties
        .map(party => party.email)
        .filter(email => email);
    }
    
    // Add client email to conflicts
    if (caseDoc.clientId?.email) {
      criteria.conflictEmails.push(caseDoc.clientId.email);
    }
    
    // Remove duplicates
    criteria.practiceAreas = [...new Set(criteria.practiceAreas)];
    criteria.specializationTags = [...new Set(criteria.specializationTags)];
    criteria.conflictEmails = [...new Set(criteria.conflictEmails)];
    
    return criteria;
  }
  
  // Map subject matter to practice areas
  mapSubjectToPracticeAreas(subjectMatter) {
    const mapping = {
      'criminal': ['IPC', 'CrPC', 'murder', 'rape', 'theft', 'fraud', 'assault'],
      'civil': ['property', 'contract', 'tort', 'recovery', 'possession'],
      'cyber': ['IT Act', 'cyber', 'online', 'digital', 'computer'],
      'corporate': ['company', 'corporate', 'merger', 'acquisition', 'securities'],
      'family': ['marriage', 'divorce', 'custody', 'maintenance', 'dowry'],
      'constitutional': ['fundamental rights', 'PIL', 'writ', 'constitutional'],
      'tax': ['income tax', 'GST', 'customs', 'excise', 'tax'],
      'labor': ['employment', 'labor', 'industrial', 'workman'],
      'environmental': ['environment', 'pollution', 'forest', 'wildlife'],
      'intellectual_property': ['patent', 'trademark', 'copyright', 'IP']
    };
    
    const areas = [];
    const lowerSubject = subjectMatter.toLowerCase();
    
    for (const [area, keywords] of Object.entries(mapping)) {
      if (keywords.some(keyword => lowerSubject.includes(keyword))) {
        areas.push(area);
      }
    }
    
    return areas.length > 0 ? areas : ['civil']; // Default to civil
  }
  
  // Find available judges
  async findAvailableJudges(criteria) {
    const query = {
      role: 'judge',
      isActive: true,
      $expr: { $lt: ['$judgeProfile.currentDailyLoad', '$judgeProfile.maxDailyIntake'] }
    };
    
    // Add specialization filter
    if (criteria.specializationTags.length > 0) {
      query['judgeProfile.specializationTags'] = { $in: criteria.specializationTags };
    }
    
    // Exclude conflicts
    if (criteria.conflictEmails.length > 0) {
      query['judgeProfile.conflicts.email'] = { $nin: criteria.conflictEmails };
    }
    
    return await User.find(query);
  }
  
  // Find available lawyers
  async findAvailableLawyers(criteria) {
    const query = {
      role: 'lawyer',
      isActive: true,
      $expr: { $lt: ['$lawyerProfile.currentCaseLoad', '$lawyerProfile.maxConcurrentCases'] }
    };
    
    // Add practice area filter
    if (criteria.practiceAreas.length > 0) {
      query['lawyerProfile.practiceAreas'] = { $in: criteria.practiceAreas };
    }
    
    // Exclude conflicts
    if (criteria.conflictEmails.length > 0) {
      query['lawyerProfile.conflicts.email'] = { $nin: criteria.conflictEmails };
    }
    
    return await User.find(query);
  }
  
  // Score and rank judges
  async scoreAndRankJudges(judges, caseDoc, criteria) {
    const scoredJudges = [];
    
    for (const judge of judges) {
      const score = await this.scoreJudge(judge, caseDoc, criteria);
      if (score.totalScore >= this.minScoreThresholds.judge) {
        scoredJudges.push({
          user: judge,
          ...score
        });
      }
    }
    
    return scoredJudges.sort((a, b) => b.totalScore - a.totalScore);
  }
  
  // Score and rank lawyers
  async scoreAndRankLawyers(lawyers, caseDoc, criteria) {
    const scoredLawyers = [];
    
    for (const lawyer of lawyers) {
      const score = await this.scoreLawyer(lawyer, caseDoc, criteria);
      if (score.totalScore >= this.minScoreThresholds.lawyer) {
        scoredLawyers.push({
          user: lawyer,
          ...score
        });
      }
    }
    
    return scoredLawyers.sort((a, b) => b.totalScore - a.totalScore);
  }
  
  // Score individual judge
  async scoreJudge(judge, caseDoc, criteria) {
    const profile = judge.judgeProfile;
    const scoreBreakdown = {};
    
    // Expertise match (0-60)
    scoreBreakdown.expertiseMatch = this.calculateExpertiseMatch(
      profile.specializationTags,
      criteria.specializationTags,
      this.scoringWeights.expertiseMatch
    );
    
    // Availability (0-20)
    scoreBreakdown.availability = this.calculateAvailability(
      profile.currentDailyLoad,
      profile.maxDailyIntake,
      this.scoringWeights.availability
    );
    
    // Load balance (0-10)
    scoreBreakdown.loadBalance = this.calculateLoadBalance(
      profile.currentDailyLoad,
      profile.maxDailyIntake,
      this.scoringWeights.loadBalance
    );
    
    // Seniority weight (0-5)
    scoreBreakdown.seniorityWeight = this.calculateSeniorityWeight(
      profile.seniorityLevel,
      criteria.urgency,
      this.scoringWeights.seniorityWeight
    );
    
    // Rating (0-5)
    scoreBreakdown.rating = Math.min(profile.rating || 0, this.scoringWeights.rating);
    
    // Urgency bonus (0-10)
    scoreBreakdown.urgencyBonus = this.calculateUrgencyBonus(
      criteria.urgency,
      profile.seniorityLevel,
      this.scoringWeights.urgencyBonus
    );
    
    // News sensitivity bonus (0-10)
    scoreBreakdown.newsSensitivityBonus = this.calculateNewsSensitivityBonus(
      criteria.newsSensitivityScore,
      profile.seniorityLevel,
      this.scoringWeights.newsSensitivityBonus
    );
    
    const totalScore = Object.values(scoreBreakdown).reduce((sum, score) => sum + score, 0);
    
    return {
      scoreBreakdown,
      totalScore: Math.round(totalScore)
    };
  }
  
  // Score individual lawyer
  async scoreLawyer(lawyer, caseDoc, criteria) {
    const profile = lawyer.lawyerProfile;
    const scoreBreakdown = {};
    
    // Expertise match (0-60)
    scoreBreakdown.expertiseMatch = this.calculateExpertiseMatch(
      profile.practiceAreas,
      criteria.practiceAreas,
      this.scoringWeights.expertiseMatch
    );
    
    // Availability (0-20)
    scoreBreakdown.availability = this.calculateAvailability(
      profile.currentCaseLoad,
      profile.maxConcurrentCases,
      this.scoringWeights.availability
    );
    
    // Load balance (0-10)
    scoreBreakdown.loadBalance = this.calculateLoadBalance(
      profile.currentCaseLoad,
      profile.maxConcurrentCases,
      this.scoringWeights.loadBalance
    );
    
    // Experience weight (using seniority weight slot) (0-5)
    scoreBreakdown.seniorityWeight = this.calculateExperienceWeight(
      profile.yearsOfExperience,
      criteria.complexity,
      this.scoringWeights.seniorityWeight
    );
    
    // Rating (0-5)
    scoreBreakdown.rating = Math.min(profile.rating || 0, this.scoringWeights.rating);
    
    // Urgency bonus (0-10)
    scoreBreakdown.urgencyBonus = this.calculateUrgencyBonus(
      criteria.urgency,
      profile.yearsOfExperience > 10 ? 'senior' : 'junior',
      this.scoringWeights.urgencyBonus
    );
    
    // News sensitivity bonus (0-10)
    scoreBreakdown.newsSensitivityBonus = this.calculateNewsSensitivityBonus(
      criteria.newsSensitivityScore,
      profile.yearsOfExperience > 10 ? 'senior' : 'junior',
      this.scoringWeights.newsSensitivityBonus
    );
    
    const totalScore = Object.values(scoreBreakdown).reduce((sum, score) => sum + score, 0);
    
    return {
      scoreBreakdown,
      totalScore: Math.round(totalScore)
    };
  }
  
  // Calculate expertise match score
  calculateExpertiseMatch(userExpertise, requiredExpertise, maxScore) {
    if (!requiredExpertise || requiredExpertise.length === 0) {
      return maxScore * 0.5; // Give half points if no specific requirement
    }
    
    const matches = requiredExpertise.filter(req => 
      userExpertise.some(exp => exp.toLowerCase() === req.toLowerCase())
    );
    
    const matchRatio = matches.length / requiredExpertise.length;
    return Math.round(matchRatio * maxScore);
  }
  
  // Calculate availability score
  calculateAvailability(currentLoad, maxLoad, maxScore) {
    if (maxLoad === 0) return 0;
    
    const availabilityRatio = (maxLoad - currentLoad) / maxLoad;
    return Math.round(availabilityRatio * maxScore);
  }
  
  // Calculate load balance score (favor less loaded users)
  calculateLoadBalance(currentLoad, maxLoad, maxScore) {
    if (maxLoad === 0) return 0;
    
    const loadRatio = currentLoad / maxLoad;
    const balanceScore = (1 - loadRatio) * maxScore;
    return Math.round(balanceScore);
  }
  
  // Calculate seniority weight
  calculateSeniorityWeight(seniorityLevel, urgency, maxScore) {
    const seniorityScores = {
      'junior': 1,
      'senior': 3,
      'chief': 5
    };
    
    let baseScore = seniorityScores[seniorityLevel] || 1;
    
    // Boost for urgent cases
    if (urgency === 'URGENT') {
      baseScore *= 1.5;
    }
    
    return Math.min(Math.round(baseScore), maxScore);
  }
  
  // Calculate experience weight for lawyers
  calculateExperienceWeight(yearsOfExperience, complexity, maxScore) {
    const complexityMultipliers = {
      'low': 0.5,
      'medium': 1,
      'high': 1.5,
      'very_high': 2
    };
    
    const multiplier = complexityMultipliers[complexity] || 1;
    const experienceScore = Math.min(yearsOfExperience / 20, 1) * maxScore * multiplier;
    
    return Math.round(experienceScore);
  }
  
  // Calculate urgency bonus
  calculateUrgencyBonus(urgency, seniorityLevel, maxScore) {
    if (urgency !== 'URGENT') return 0;
    
    const seniorityMultipliers = {
      'junior': 0.5,
      'senior': 1,
      'chief': 1.5
    };
    
    const multiplier = seniorityMultipliers[seniorityLevel] || 0.5;
    return Math.round(maxScore * multiplier);
  }
  
  // Calculate news sensitivity bonus
  calculateNewsSensitivityBonus(newsScore, seniorityLevel, maxScore) {
    if (newsScore < 50) return 0;
    
    const sensitivityRatio = (newsScore - 50) / 50; // 0-1 scale for scores 50-100
    const seniorityMultipliers = {
      'junior': 0.5,
      'senior': 1,
      'chief': 1.5
    };
    
    const multiplier = seniorityMultipliers[seniorityLevel] || 0.5;
    return Math.round(sensitivityRatio * maxScore * multiplier);
  }
  
  // Select best candidate
  selectBestCandidate(rankedCandidates, type) {
    if (!rankedCandidates || rankedCandidates.length === 0) {
      return null;
    }
    
    // Return highest scoring candidate
    return rankedCandidates[0];
  }
  
  // Update user loads after assignment
  async updateUserLoads(judge, lawyer) {
    // Update judge daily load
    judge.judgeProfile.currentDailyLoad += 1;
    await judge.save();
    
    // Update lawyer case load
    lawyer.lawyerProfile.currentCaseLoad += 1;
    await lawyer.save();
  }
  
  // Send assignment notifications
  async sendAssignmentNotifications(caseDoc, judge, lawyer) {
    const caseDetails = {
      caseNumber: caseDoc.caseNumber,
      title: caseDoc.title,
      finalUrgency: caseDoc.finalUrgency,
      submittedAt: caseDoc.submittedAt,
      jurisdiction: caseDoc.jurisdiction
    };
    
    // Send to judge
    await emailService.sendCaseAssignmentNotification(
      judge.email,
      caseDetails,
      'judge',
      judge.judgeProfile.name
    );
    
    // Send to lawyer
    await emailService.sendCaseAssignmentNotification(
      lawyer.email,
      caseDetails,
      'lawyer',
      lawyer.lawyerProfile.name
    );
    
    // Send status update to client
    await emailService.sendCaseStatusUpdate(
      caseDoc.clientId.email,
      caseDetails,
      'assigned',
      caseDoc.clientId.clientProfile?.name
    );
  }
  
  // Log assignment for audit
  async logAssignment(caseDoc, selectedJudge, selectedLawyer) {
    await AuditLog.createEntry({
      actorId: null, // System action
      actorEmail: 'system',
      actorRole: 'system',
      action: 'case_assigned',
      targetType: 'case',
      targetId: caseDoc._id,
      ip: '127.0.0.1',
      metadata: {
        success: true,
        caseNumber: caseDoc.caseNumber,
        judgeId: selectedJudge.user._id,
        judgeEmail: selectedJudge.user.email,
        judgeScore: selectedJudge.totalScore,
        lawyerId: selectedLawyer.user._id,
        lawyerEmail: selectedLawyer.user.email,
        lawyerScore: selectedLawyer.totalScore,
        urgency: caseDoc.finalUrgency,
        newsSensitivityScore: caseDoc.newsSignals?.score || 0
      },
      severity: 'low'
    });
  }
  
  // Escalate to admin when no suitable candidates found
  async escalateToAdmin(caseDoc, rankedJudges, rankedLawyers) {
    caseDoc.status = 'error';
    await caseDoc.save();
    
    // Log escalation
    await AuditLog.createEntry({
      actorId: null,
      actorEmail: 'system',
      actorRole: 'system',
      action: 'assignment_escalated',
      targetType: 'case',
      targetId: caseDoc._id,
      ip: '127.0.0.1',
      metadata: {
        caseNumber: caseDoc.caseNumber,
        reason: 'No suitable candidates found',
        availableJudges: rankedJudges.length,
        availableLawyers: rankedLawyers.length,
        urgency: caseDoc.finalUrgency
      },
      severity: 'high'
    });
    
    logger.warn(`Case escalated to admin: ${caseDoc.caseNumber}`);
  }
  
  // Manual reassignment (admin/judge/lawyer request)
  async reassignCase(caseId, requestedBy, reason) {
    const caseDoc = await Case.findById(caseId);
    if (!caseDoc || !caseDoc.assignment) {
      throw new AppError('Case not found or not assigned', 404, 'CASE_NOT_FOUND');
    }
    
    // Clear current assignment
    const oldAssignment = caseDoc.assignment;
    caseDoc.assignment = undefined;
    caseDoc.status = 'classified';
    
    // Decrease load counts
    if (oldAssignment.judgeId) {
      const judge = await User.findById(oldAssignment.judgeId);
      if (judge) {
        judge.judgeProfile.currentDailyLoad = Math.max(0, judge.judgeProfile.currentDailyLoad - 1);
        await judge.save();
      }
    }
    
    if (oldAssignment.lawyerId) {
      const lawyer = await User.findById(oldAssignment.lawyerId);
      if (lawyer) {
        lawyer.lawyerProfile.currentCaseLoad = Math.max(0, lawyer.lawyerProfile.currentCaseLoad - 1);
        await lawyer.save();
      }
    }
    
    await caseDoc.save();
    
    // Log reassignment request
    await AuditLog.createEntry({
      actorId: requestedBy.id,
      actorEmail: requestedBy.email,
      actorRole: requestedBy.role,
      action: 'case_reassigned',
      targetType: 'case',
      targetId: caseDoc._id,
      ip: '127.0.0.1',
      metadata: {
        caseNumber: caseDoc.caseNumber,
        reason,
        previousJudge: oldAssignment.judgeId,
        previousLawyer: oldAssignment.lawyerId
      },
      severity: 'medium'
    });
    
    // Reassign
    return await this.assignCase(caseId);
  }
  
  // Get assignment statistics
  async getAssignmentStats(startDate, endDate) {
    const stats = await Case.aggregate([
      {
        $match: {
          assignedAt: { $gte: startDate, $lte: endDate },
          assignment: { $exists: true }
        }
      },
      {
        $group: {
          _id: null,
          totalAssignments: { $sum: 1 },
          urgentCases: {
            $sum: { $cond: [{ $eq: ['$finalUrgency', 'URGENT'] }, 1, 0] }
          },
          moderateCases: {
            $sum: { $cond: [{ $eq: ['$finalUrgency', 'MODERATE'] }, 1, 0] }
          },
          lowCases: {
            $sum: { $cond: [{ $eq: ['$finalUrgency', 'LOW'] }, 1, 0] }
          },
          avgJudgeScore: { $avg: '$assignment.judgeScore.total' },
          avgLawyerScore: { $avg: '$assignment.lawyerScore.total' }
        }
      }
    ]);
    
    return stats[0] || {
      totalAssignments: 0,
      urgentCases: 0,
      moderateCases: 0,
      lowCases: 0,
      avgJudgeScore: 0,
      avgLawyerScore: 0
    };
  }
}

module.exports = new AssignmentService();
