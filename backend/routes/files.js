const express = require('express');
const { param, query, validationResult } = require('express-validator');
const fileService = require('../services/fileService');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { auth, authorize } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// All routes require authentication
router.use(auth);

// @route   GET /api/files/:id
// @desc    Download file by ID
// @access  Private (Role-based)
router.get('/:id',
  [
    param('id').isMongoId().withMessage('Invalid file ID')
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

    const { id } = req.params;
    
    try {
      const fileInfo = await fileService.getFileInfo(id);
      if (!fileInfo) {
        throw new AppError('File not found', 404, 'FILE_NOT_FOUND');
      }

      // Check permissions - only case participants can download
      const hasAccess = await fileService.checkFileAccess(id, req.user.id, req.user.role);
      if (!hasAccess) {
        throw new AppError('Access denied', 403, 'ACCESS_DENIED');
      }

      // Stream file to response
      const fileStream = await fileService.downloadFile(id);
      
      res.set({
        'Content-Type': fileInfo.mimeType,
        'Content-Disposition': `attachment; filename="${fileInfo.originalName}"`,
        'Content-Length': fileInfo.size
      });

      fileStream.pipe(res);
      
    } catch (error) {
      logger.error('File download failed:', error);
      throw error;
    }
  })
);

// @route   GET /api/files/:id/info
// @desc    Get file information
// @access  Private (Role-based)
router.get('/:id/info',
  [
    param('id').isMongoId().withMessage('Invalid file ID')
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

    const { id } = req.params;
    
    try {
      const fileInfo = await fileService.getFileInfo(id);
      if (!fileInfo) {
        throw new AppError('File not found', 404, 'FILE_NOT_FOUND');
      }

      // Check permissions
      const hasAccess = await fileService.checkFileAccess(id, req.user.id, req.user.role);
      if (!hasAccess) {
        throw new AppError('Access denied', 403, 'ACCESS_DENIED');
      }

      res.status(200).json({
        success: true,
        data: {
          file: {
            id: fileInfo._id,
            filename: fileInfo.filename,
            originalName: fileInfo.originalName,
            size: fileInfo.size,
            mimeType: fileInfo.mimeType,
            uploadedAt: fileInfo.uploadedAt,
            metadata: fileInfo.metadata
          }
        }
      });
      
    } catch (error) {
      logger.error('File info fetch failed:', error);
      throw error;
    }
  })
);

// @route   DELETE /api/files/:id
// @desc    Delete file by ID
// @access  Private (Admin, File Owner)
router.delete('/:id',
  [
    param('id').isMongoId().withMessage('Invalid file ID')
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

    const { id } = req.params;
    
    try {
      const fileInfo = await fileService.getFileInfo(id);
      if (!fileInfo) {
        throw new AppError('File not found', 404, 'FILE_NOT_FOUND');
      }

      // Check permissions - only admin or file owner can delete
      const canDelete = req.user.role === 'admin' || 
                       fileInfo.metadata?.clientId?.toString() === req.user.id;
      
      if (!canDelete) {
        throw new AppError('Access denied', 403, 'ACCESS_DENIED');
      }

      // Delete file
      await fileService.deleteFile(id);
      
      res.status(200).json({
        success: true,
        message: 'File deleted successfully'
      });
      
    } catch (error) {
      logger.error('File deletion failed:', error);
      throw error;
    }
  })
);

// @route   GET /api/files
// @desc    List files with filters
// @access  Private (Role-based)
router.get('/',
  [
    query('caseId').optional().isMongoId().withMessage('Invalid case ID'),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('type').optional().isIn(['pdf', 'image', 'document', 'other']),
    query('sortBy').optional().isIn(['uploadedAt', 'size', 'originalName']),
    query('sortOrder').optional().isIn(['asc', 'desc'])
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

    const {
      caseId,
      page = 1,
      limit = 20,
      type,
      sortBy = 'uploadedAt',
      sortOrder = 'desc'
    } = req.query;

    try {
      // Build query based on user role and permissions
      let query = {};
      
      if (caseId) {
        query.metadata = { caseId };
      }
      
      if (type) {
        query.mimeType = { $regex: `^${type}`, $options: 'i' };
      }

      // Role-based filtering
      if (req.user.role === 'client') {
        query['metadata.clientId'] = req.user.id;
      } else if (req.user.role === 'lawyer') {
        // Lawyers can see files from cases they're assigned to
        query['metadata.caseId'] = { $in: await getAssignedCaseIds(req.user.id, 'lawyer') };
      } else if (req.user.role === 'judge') {
        // Judges can see files from cases they're assigned to
        query['metadata.caseId'] = { $in: await getAssignedCaseIds(req.user.id, 'judge') };
      }
      // Admin can see all files

      // Build sort object
      const sort = {};
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

      // Execute query with pagination
      const skip = (page - 1) * limit;
      
      const [files, total] = await Promise.all([
        fileService.listFiles(query, sort, skip, parseInt(limit)),
        fileService.countFiles(query)
      ]);

      res.status(200).json({
        success: true,
        data: {
          files,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });
      
    } catch (error) {
      logger.error('File listing failed:', error);
      throw error;
    }
  })
);

// Helper function to get assigned case IDs for a user
async function getAssignedCaseIds(userId, role) {
  const Case = require('../models/Case');
  const field = role === 'lawyer' ? 'assignment.lawyerId' : 'assignment.judgeId';
  
  const cases = await Case.find({ [field]: userId })
    .select('_id')
    .lean();
  
  return cases.map(c => c._id);
}

// @route   POST /api/files/:id/validate
// @desc    Validate file integrity
// @access  Private (Admin, File Owner)
router.post('/:id/validate',
  [
    param('id').isMongoId().withMessage('Invalid file ID')
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

    const { id } = req.params;
    
    try {
      const fileInfo = await fileService.getFileInfo(id);
      if (!fileInfo) {
        throw new AppError('File not found', 404, 'FILE_NOT_FOUND');
      }

      // Check permissions
      const canValidate = req.user.role === 'admin' || 
                         fileInfo.metadata?.clientId?.toString() === req.user.id;
      
      if (!canValidate) {
        throw new AppError('Access denied', 403, 'ACCESS_DENIED');
      }

      // Validate file integrity
      const validationResult = await fileService.validateFileIntegrity(id);
      
      res.status(200).json({
        success: true,
        data: {
          validation: validationResult
        }
      });
      
    } catch (error) {
      logger.error('File validation failed:', error);
      throw error;
    }
  })
);

module.exports = router;
