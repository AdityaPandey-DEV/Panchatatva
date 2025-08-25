const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, param, query, validationResult } = require('express-validator');
const Case = require('../models/Case');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const fileService = require('../services/fileService');
const textExtractionService = require('../services/textExtractionService');
const encryptionService = require('../utils/encryption');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { auth, authorize } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Rate limiting for file uploads
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 uploads per window
  message: {
    success: false,
    message: 'Too many file uploads. Please try again later.'
  },
  keyGenerator: (req) => req.user?.id || req.ip
});

// Configure multer
const upload = fileService.getMulterConfig().single('pdf');

// @route   POST /api/cases/upload
// @desc    Upload PDF case file
// @access  Private (Client, Admin)
router.post('/upload',
  auth,
  authorize('client', 'admin'),
  uploadLimiter,
  [
    body('title')
      .trim()
      .isLength({ min: 3, max: 200 })
      .withMessage('Title must be between 3 and 200 characters'),
    body('jurisdiction')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('Jurisdiction must be less than 100 characters'),
  ],
  asyncHandler(async (req, res) => {
    // Handle file upload with multer
    upload(req, res, async (err) => {
      if (err) {
        logger.error('File upload error:', err);
        return res.status(400).json({
          success: false,
          message: err.message || 'File upload failed',
          code: err.code || 'UPLOAD_ERROR'
        });
      }
      
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }
      
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'PDF file is required'
        });
      }
      
      try {
        const { title, jurisdiction } = req.body;
        const pdfBuffer = req.file.buffer;
        
        // Validate PDF file
        fileService.validatePDFBuffer(pdfBuffer);
        
        // Create initial case record
        const caseData = {
          clientId: req.user.id,
          title,
          jurisdiction,
          status: 'intake',
          finalUrgency: 'LOW', // Will be updated by AI classification
        };
        
        const newCase = new Case(caseData);
        
        // Add initial processing stage
        await newCase.addProcessingStage('upload', 'in_progress');
        
        // Save case to get ID
        await newCase.save();
        
        // Upload PDF to GridFS
        const fileInfo = await fileService.uploadToGridFS(
          pdfBuffer,
          req.file.originalname,
          {
            caseId: newCase._id,
            clientId: req.user.id,
            mimeType: req.file.mimetype,
            hash: fileService.generateFileHash(pdfBuffer)
          }
        );
        
        // Update case with file info
        newCase.sourcePDF = {
          gridFSId: fileInfo.id,
          filename: fileInfo.filename,
          originalName: fileInfo.originalName,
          size: fileInfo.size,
          mimeType: req.file.mimetype,
          uploadedAt: fileInfo.uploadedAt
        };
        
        // Mark file as referenced
        await fileService.markFileAsReferenced(fileInfo.id);
        
        // Update upload stage as completed
        await newCase.updateProcessingStage('upload', 'completed', null, {
          fileId: fileInfo.id,
          fileSize: fileInfo.size
        });
        
        await newCase.save();
        
        // Log case upload
        await AuditLog.createEntry({
          actorId: req.user.id,
          actorEmail: req.user.email,
          actorRole: req.user.role,
          action: 'case_uploaded',
          targetType: 'case',
          targetId: newCase._id,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          metadata: {
            success: true,
            caseNumber: newCase.caseNumber,
            fileSize: fileInfo.size,
            fileName: fileInfo.originalName
          },
          severity: 'low'
        });
        
        logger.info(`Case uploaded successfully: ${newCase.caseNumber} by ${req.user.email}`);
        
        // Start text extraction process asynchronously
        setImmediate(() => {
          processCase(newCase._id).catch(error => {
            logger.error(`Case processing failed for ${newCase.caseNumber}:`, error);
          });
        });
        
        res.status(201).json({
          success: true,
          message: 'Case uploaded successfully',
          data: {
            case: {
              id: newCase._id,
              caseNumber: newCase.caseNumber,
              title: newCase.title,
              status: newCase.status,
              submittedAt: newCase.submittedAt
            }
          }
        });
        
      } catch (error) {
        logger.error('Case upload error:', error);
        throw error;
      }
    });
  })
);

// @route   GET /api/cases/:id
// @desc    Get case details
// @access  Private (Role-based access)
router.get('/:id',
  auth,
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid case ID'),
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
    
    const caseId = req.params.id;
    
    // Find case
    const caseDoc = await Case.findById(caseId)
      .populate('clientId', 'email clientProfile')
      .populate('assignment.judgeId', 'email judgeProfile')
      .populate('assignment.lawyerId', 'email lawyerProfile');
    
    if (!caseDoc) {
      return res.status(404).json({
        success: false,
        message: 'Case not found'
      });
    }
    
    // Check access permissions
    const hasAccess = checkCaseAccess(caseDoc, req.user);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    // Get role-filtered view
    const caseData = caseDoc.getSummary(req.user.role);
    
    // Decrypt sensitive fields if user has access
    if (['lawyer', 'judge', 'admin'].includes(req.user.role)) {
      if (caseDoc.encryptedFields && caseDoc.encryptedFields.length > 0) {
        const decrypted = encryptionService.decryptFields(caseData);
        Object.assign(caseData, decrypted);
      }
    }
    
    // Log case access
    await caseDoc.logAccess(req.user.id, 'case_viewed', req.ip);
    
    res.status(200).json({
      success: true,
      data: { case: caseData }
    });
  })
);

// @route   GET /api/cases
// @desc    Get cases list (role-based)
// @access  Private
router.get('/',
  auth,
  [
    query('status')
      .optional()
      .isIn(['intake', 'processing', 'classified', 'assigned', 'accepted', 'in_progress', 'completed', 'archived'])
      .withMessage('Invalid status'),
    query('urgency')
      .optional()
      .isIn(['URGENT', 'MODERATE', 'LOW'])
      .withMessage('Invalid urgency'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
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
    
    const { status, urgency, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;
    
    // Build query based on user role
    let query = {};
    
    switch (req.user.role) {
      case 'client':
        query.clientId = req.user.id;
        break;
      case 'lawyer':
        query['assignment.lawyerId'] = req.user.id;
        break;
      case 'judge':
        query['assignment.judgeId'] = req.user.id;
        break;
      case 'admin':
        // No additional filters for admin
        break;
      default:
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
    }
    
    // Add optional filters
    if (status) query.status = status;
    if (urgency) query.finalUrgency = urgency;
    
    // Execute query
    const cases = await Case.find(query)
      .populate('clientId', 'email clientProfile')
      .populate('assignment.judgeId', 'email judgeProfile')
      .populate('assignment.lawyerId', 'email lawyerProfile')
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Case.countDocuments(query);
    
    // Filter cases based on role permissions
    const filteredCases = cases.map(caseDoc => caseDoc.getSummary(req.user.role));
    
    res.status(200).json({
      success: true,
      data: {
        cases: filteredCases,
        pagination: {
          current: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  })
);

// @route   GET /api/cases/:id/download
// @desc    Download original PDF
// @access  Private (Role-based access)
router.get('/:id/download',
  auth,
  [
    param('id')
      .isMongoId()
      .withMessage('Invalid case ID'),
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
    
    const caseId = req.params.id;
    
    // Find case
    const caseDoc = await Case.findById(caseId);
    
    if (!caseDoc) {
      return res.status(404).json({
        success: false,
        message: 'Case not found'
      });
    }
    
    // Check access permissions
    const hasAccess = checkCaseAccess(caseDoc, req.user);
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    // Only lawyers, judges, and admins can download files
    if (!['lawyer', 'judge', 'admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'File download not allowed for your role'
      });
    }
    
    if (!caseDoc.sourcePDF || !caseDoc.sourcePDF.gridFSId) {
      return res.status(404).json({
        success: false,
        message: 'PDF file not found'
      });
    }
    
    try {
      // Get file info
      const fileInfo = await fileService.getFileInfo(caseDoc.sourcePDF.gridFSId);
      
      // Set response headers
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${caseDoc.sourcePDF.originalName}"`,
        'Content-Length': fileInfo.length
      });
      
      // Stream file
      const downloadStream = fileService.streamFromGridFS(caseDoc.sourcePDF.gridFSId);
      
      downloadStream.on('error', (error) => {
        logger.error('File download error:', error);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: 'File download failed'
          });
        }
      });
      
      downloadStream.pipe(res);
      
      // Log file download
      await caseDoc.logAccess(req.user.id, 'file_downloaded', req.ip);
      
    } catch (error) {
      logger.error('File download error:', error);
      throw error;
    }
  })
);

// Helper function to check case access permissions
function checkCaseAccess(caseDoc, user) {
  switch (user.role) {
    case 'client':
      return caseDoc.clientId.toString() === user.id;
    case 'lawyer':
      return caseDoc.assignment && caseDoc.assignment.lawyerId && 
             caseDoc.assignment.lawyerId.toString() === user.id;
    case 'judge':
      return caseDoc.assignment && caseDoc.assignment.judgeId && 
             caseDoc.assignment.judgeId.toString() === user.id;
    case 'admin':
      return true;
    default:
      return false;
  }
}

// Import required services
const aiClassificationService = require('../services/aiClassificationService');
const newsSensitivityService = require('../services/newsSensitivityService');
const assignmentService = require('../services/assignmentService');

// Async function to process case after upload
async function processCase(caseId) {
  try {
    const caseDoc = await Case.findById(caseId);
    if (!caseDoc) {
      logger.error(`Case not found for processing: ${caseId}`);
      return;
    }
    
    logger.info(`Starting processing for case: ${caseDoc.caseNumber}`);
    
    // Update status to processing
    caseDoc.status = 'processing';
    await caseDoc.save();
    
    // Stage 1: Text extraction
    await caseDoc.addProcessingStage('text_extraction', 'in_progress');
    
    try {
      // Download PDF from GridFS
      const pdfBuffer = await fileService.downloadFromGridFS(caseDoc.sourcePDF.gridFSId);
      
      // Extract text
      const extractionResult = await textExtractionService.extractText(pdfBuffer, {
        fallbackToOCR: true
      });
      
      // Encrypt and store extracted text
      const encryptedText = encryptionService.encrypt(extractionResult.text);
      caseDoc.extractedText = encryptedText;
      caseDoc.textExtractionMethod = extractionResult.method;
      caseDoc.ocrConfidence = extractionResult.confidence;
      
      // Update processing stage
      await caseDoc.updateProcessingStage('text_extraction', 'completed', null, {
        method: extractionResult.method,
        confidence: extractionResult.confidence,
        processingTime: extractionResult.processingTime,
        wordsCount: extractionResult.metadata.wordsCount
      });
      
      logger.info(`Text extraction completed for case: ${caseDoc.caseNumber}`);
      
      // Stage 2: AI Classification
      await caseDoc.addProcessingStage('ai_classification', 'in_progress');
      
      try {
        const classificationResult = await aiClassificationService.classifyCase(
          extractionResult.text,
          caseDoc.title,
          caseDoc.jurisdiction
        );
        
        // Store AI intake results
        caseDoc.aiIntake = classificationResult;
        caseDoc.finalUrgency = classificationResult.urgency;
        caseDoc.classifiedAt = new Date();
        
        await caseDoc.updateProcessingStage('ai_classification', 'completed', null, {
          urgency: classificationResult.urgency,
          confidence: classificationResult.confidence,
          processingTime: classificationResult.metadata.processingTime
        });
        
        logger.info(`AI classification completed for case: ${caseDoc.caseNumber}`, {
          urgency: classificationResult.urgency,
          confidence: classificationResult.confidence
        });
        
        // Stage 3: News sensitivity check
        await caseDoc.addProcessingStage('news_check', 'in_progress');
        
        try {
          const newsSignals = await newsSensitivityService.checkNewsSensitivity(
            classificationResult,
            caseDoc.jurisdiction
          );
          
          caseDoc.newsSignals = newsSignals;
          
          // Check if urgency should be escalated based on news
          const escalationResult = newsSensitivityService.shouldEscalateUrgency(
            newsSignals,
            caseDoc.finalUrgency
          );
          
          if (escalationResult.shouldEscalate) {
            caseDoc.finalUrgency = escalationResult.newUrgency;
            caseDoc.urgencyEscalated = true;
            caseDoc.escalationReason = escalationResult.reason;
            
            logger.info(`Urgency escalated for case: ${caseDoc.caseNumber}`, {
              from: classificationResult.urgency,
              to: escalationResult.newUrgency,
              reason: escalationResult.reason
            });
          }
          
          await caseDoc.updateProcessingStage('news_check', 'completed', null, {
            score: newsSignals.score,
            escalated: escalationResult.shouldEscalate,
            processingTime: newsSignals.processingTime
          });
          
          logger.info(`News sensitivity check completed for case: ${caseDoc.caseNumber}`, {
            score: newsSignals.score,
            escalated: escalationResult.shouldEscalate
          });
          
          // Stage 4: Assignment
          await caseDoc.addProcessingStage('assignment', 'in_progress');
          
          try {
            caseDoc.status = 'classified';
            await caseDoc.save();
            
            const assignmentResult = await assignmentService.assignCase(caseId);
            
            if (assignmentResult.success) {
              await caseDoc.updateProcessingStage('assignment', 'completed', null, {
                judgeId: assignmentResult.assignment.judge.id,
                lawyerId: assignmentResult.assignment.lawyer.id,
                judgeScore: assignmentResult.assignment.judge.score,
                lawyerScore: assignmentResult.assignment.lawyer.score,
                processingTime: assignmentResult.processingTime
              });
              
              logger.info(`Assignment completed for case: ${caseDoc.caseNumber}`, {
                judge: assignmentResult.assignment.judge.email,
                lawyer: assignmentResult.assignment.lawyer.email
              });
              
              // Stage 5: Notification
              await caseDoc.addProcessingStage('notification', 'completed');
              
            } else {
              await caseDoc.updateProcessingStage('assignment', 'failed', 
                assignmentResult.reason || 'Assignment failed');
              
              if (assignmentResult.escalated) {
                logger.warn(`Case escalated to admin: ${caseDoc.caseNumber}`);
              }
            }
            
          } catch (assignmentError) {
            logger.error(`Assignment failed for case ${caseDoc.caseNumber}:`, assignmentError);
            await caseDoc.updateProcessingStage('assignment', 'failed', assignmentError.message);
          }
          
        } catch (newsError) {
          logger.error(`News check failed for case ${caseDoc.caseNumber}:`, newsError);
          await caseDoc.updateProcessingStage('news_check', 'failed', newsError.message);
          
          // Continue with assignment even if news check fails
          caseDoc.status = 'classified';
          await caseDoc.save();
          
          try {
            await assignmentService.assignCase(caseId);
          } catch (assignmentError) {
            logger.error(`Assignment after news failure for case ${caseDoc.caseNumber}:`, assignmentError);
          }
        }
        
      } catch (classificationError) {
        logger.error(`AI classification failed for case ${caseDoc.caseNumber}:`, classificationError);
        await caseDoc.updateProcessingStage('ai_classification', 'failed', classificationError.message);
        caseDoc.status = 'error';
        await caseDoc.save();
      }
      
    } catch (extractionError) {
      logger.error(`Text extraction failed for case ${caseDoc.caseNumber}:`, extractionError);
      await caseDoc.updateProcessingStage('text_extraction', 'failed', extractionError.message);
      caseDoc.status = 'error';
      await caseDoc.save();
    }
    
  } catch (error) {
    logger.error(`Case processing failed for ${caseId}:`, error);
  }
}

module.exports = router;
