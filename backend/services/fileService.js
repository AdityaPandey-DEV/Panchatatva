const multer = require('multer');
const GridFSBucket = require('mongodb').GridFSBucket;
const mongoose = require('mongoose');
const path = require('path');
const crypto = require('crypto');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');

class FileService {
  constructor() {
    this.bucket = null;
    this.initGridFS();
  }
  
  initGridFS() {
    mongoose.connection.once('open', () => {
      this.bucket = new GridFSBucket(mongoose.connection.db, {
        bucketName: 'uploads'
      });
      logger.info('GridFS initialized');
    });
  }
  
  // Configure multer for memory storage
  getMulterConfig() {
    const storage = multer.memoryStorage();
    
    const fileFilter = (req, file, cb) => {
      // Only allow PDF files
      if (file.mimetype === 'application/pdf') {
        cb(null, true);
      } else {
        cb(new AppError('Only PDF files are allowed', 400, 'INVALID_FILE_TYPE'), false);
      }
    };
    
    return multer({
      storage,
      fileFilter,
      limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 25 * 1024 * 1024, // 25MB
        files: 1 // Only one file at a time
      }
    });
  }
  
  // Upload file to GridFS
  async uploadToGridFS(buffer, filename, metadata = {}) {
    return new Promise((resolve, reject) => {
      if (!this.bucket) {
        return reject(new AppError('GridFS not initialized', 500, 'GRIDFS_NOT_READY'));
      }
      
      // Generate unique filename
      const fileId = new mongoose.Types.ObjectId();
      const ext = path.extname(filename);
      const uniqueFilename = `${fileId}${ext}`;
      
      const uploadStream = this.bucket.openUploadStream(uniqueFilename, {
        metadata: {
          originalName: filename,
          uploadedAt: new Date(),
          ...metadata
        }
      });
      
      uploadStream.on('finish', () => {
        logger.info(`File uploaded to GridFS: ${uniqueFilename}`);
        resolve({
          id: uploadStream.id,
          filename: uniqueFilename,
          originalName: filename,
          size: buffer.length,
          uploadedAt: new Date()
        });
      });
      
      uploadStream.on('error', (error) => {
        logger.error('GridFS upload error:', error);
        reject(new AppError('File upload failed', 500, 'UPLOAD_FAILED'));
      });
      
      uploadStream.end(buffer);
    });
  }
  
  // Download file from GridFS
  async downloadFromGridFS(fileId) {
    return new Promise((resolve, reject) => {
      if (!this.bucket) {
        return reject(new AppError('GridFS not initialized', 500, 'GRIDFS_NOT_READY'));
      }
      
      const chunks = [];
      
      const downloadStream = this.bucket.openDownloadStream(fileId);
      
      downloadStream.on('data', (chunk) => {
        chunks.push(chunk);
      });
      
      downloadStream.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve(buffer);
      });
      
      downloadStream.on('error', (error) => {
        logger.error('GridFS download error:', error);
        reject(new AppError('File download failed', 500, 'DOWNLOAD_FAILED'));
      });
    });
  }
  
  // Get file info from GridFS
  async getFileInfo(fileId) {
    try {
      if (!this.bucket) {
        throw new AppError('GridFS not initialized', 500, 'GRIDFS_NOT_READY');
      }
      
      const files = await this.bucket.find({ _id: fileId }).toArray();
      
      if (files.length === 0) {
        throw new AppError('File not found', 404, 'FILE_NOT_FOUND');
      }
      
      return files[0];
    } catch (error) {
      if (error.isOperational) throw error;
      throw new AppError('Failed to get file info', 500, 'FILE_INFO_FAILED');
    }
  }
  
  // Delete file from GridFS
  async deleteFromGridFS(fileId) {
    try {
      if (!this.bucket) {
        throw new AppError('GridFS not initialized', 500, 'GRIDFS_NOT_READY');
      }
      
      await this.bucket.delete(fileId);
      logger.info(`File deleted from GridFS: ${fileId}`);
    } catch (error) {
      logger.error('GridFS delete error:', error);
      throw new AppError('File deletion failed', 500, 'DELETE_FAILED');
    }
  }
  
  // Stream file from GridFS (for downloads)
  streamFromGridFS(fileId) {
    if (!this.bucket) {
      throw new AppError('GridFS not initialized', 500, 'GRIDFS_NOT_READY');
    }
    
    return this.bucket.openDownloadStream(fileId);
  }
  
  // Validate file buffer
  validatePDFBuffer(buffer) {
    // Check PDF magic number
    const pdfMagic = Buffer.from([0x25, 0x50, 0x44, 0x46]); // %PDF
    
    if (!buffer.subarray(0, 4).equals(pdfMagic)) {
      throw new AppError('Invalid PDF file', 400, 'INVALID_PDF');
    }
    
    // Basic size validation
    if (buffer.length < 1024) {
      throw new AppError('PDF file is too small', 400, 'PDF_TOO_SMALL');
    }
    
    const maxSize = parseInt(process.env.MAX_FILE_SIZE) || 25 * 1024 * 1024;
    if (buffer.length > maxSize) {
      throw new AppError('PDF file is too large', 400, 'PDF_TOO_LARGE');
    }
    
    return true;
  }
  
  // Generate file hash for integrity checking
  generateFileHash(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }
  
  // Clean up orphaned files (to be called by cron job)
  async cleanupOrphanedFiles(olderThanDays = 7) {
    try {
      const cutoffDate = new Date(Date.now() - (olderThanDays * 24 * 60 * 60 * 1000));
      
      // Find files older than cutoff date that are not referenced in any case
      const orphanedFiles = await this.bucket.find({
        'uploadDate': { $lt: cutoffDate },
        'metadata.isReferenced': { $ne: true }
      }).toArray();
      
      let deletedCount = 0;
      
      for (const file of orphanedFiles) {
        try {
          await this.deleteFromGridFS(file._id);
          deletedCount++;
        } catch (error) {
          logger.error(`Failed to delete orphaned file ${file._id}:`, error);
        }
      }
      
      logger.info(`Cleaned up ${deletedCount} orphaned files`);
      return deletedCount;
    } catch (error) {
      logger.error('Cleanup orphaned files error:', error);
      throw error;
    }
  }
  
  // Mark file as referenced to prevent cleanup
  async markFileAsReferenced(fileId) {
    try {
      if (!this.bucket) {
        throw new AppError('GridFS not initialized', 500, 'GRIDFS_NOT_READY');
      }
      
      // Update file metadata
      await mongoose.connection.db.collection('uploads.files').updateOne(
        { _id: fileId },
        { $set: { 'metadata.isReferenced': true } }
      );
    } catch (error) {
      logger.error('Mark file as referenced error:', error);
      throw error;
    }
  }
  
  // Get storage statistics
  async getStorageStats() {
    try {
      if (!this.bucket) {
        throw new AppError('GridFS not initialized', 500, 'GRIDFS_NOT_READY');
      }
      
      const stats = await mongoose.connection.db.collection('uploads.files').aggregate([
        {
          $group: {
            _id: null,
            totalFiles: { $sum: 1 },
            totalSize: { $sum: '$length' },
            avgSize: { $avg: '$length' }
          }
        }
      ]).toArray();
      
      return stats[0] || {
        totalFiles: 0,
        totalSize: 0,
        avgSize: 0
      };
    } catch (error) {
      logger.error('Get storage stats error:', error);
      throw error;
    }
  }
}

module.exports = new FileService();
