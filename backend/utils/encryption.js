const crypto = require('crypto');

class EncryptionService {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32; // 256 bits
    this.ivLength = 16;  // 128 bits
    this.tagLength = 16; // 128 bits
    
    // Get encryption key from environment
    this.encryptionKey = process.env.ENCRYPTION_KEY;
    
    if (!this.encryptionKey) {
      throw new Error('ENCRYPTION_KEY not configured');
    }
    
    // Ensure key is the right length
    if (this.encryptionKey.length !== this.keyLength) {
      // Hash the key to ensure consistent length
      this.encryptionKey = crypto.createHash('sha256').update(this.encryptionKey).digest();
    } else {
      this.encryptionKey = Buffer.from(this.encryptionKey, 'utf8');
    }
  }
  
  encrypt(text) {
    if (!text) return null;
    
    try {
      // Generate random IV for each encryption
      const iv = crypto.randomBytes(this.ivLength);
      
      // Create cipher
      const cipher = crypto.createCipher(this.algorithm, this.encryptionKey, iv);
      
      // Encrypt the text
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Get the authentication tag
      const tag = cipher.getAuthTag();
      
      // Combine IV, tag, and encrypted data
      const result = {
        iv: iv.toString('hex'),
        tag: tag.toString('hex'),
        data: encrypted
      };
      
      // Return as base64 encoded string for easy storage
      return Buffer.from(JSON.stringify(result)).toString('base64');
    } catch (error) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }
  
  decrypt(encryptedData) {
    if (!encryptedData) return null;
    
    try {
      // Parse the encrypted data
      const parsed = JSON.parse(Buffer.from(encryptedData, 'base64').toString('utf8'));
      const { iv, tag, data } = parsed;
      
      // Create decipher
      const decipher = crypto.createDecipher(
        this.algorithm, 
        this.encryptionKey, 
        Buffer.from(iv, 'hex')
      );
      
      // Set the authentication tag
      decipher.setAuthTag(Buffer.from(tag, 'hex'));
      
      // Decrypt the data
      let decrypted = decipher.update(data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }
  
  hash(text, salt = null) {
    if (!text) return null;
    
    const saltToUse = salt || crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(text, saltToUse, 10000, 64, 'sha512').toString('hex');
    
    return {
      hash,
      salt: saltToUse
    };
  }
  
  verifyHash(text, hash, salt) {
    if (!text || !hash || !salt) return false;
    
    try {
      const computedHash = crypto.pbkdf2Sync(text, salt, 10000, 64, 'sha512').toString('hex');
      return computedHash === hash;
    } catch (error) {
      return false;
    }
  }
  
  generateSecureRandom(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }
  
  generateOTP(length = 6) {
    const digits = '0123456789';
    let otp = '';
    
    for (let i = 0; i < length; i++) {
      const randomIndex = crypto.randomInt(0, digits.length);
      otp += digits[randomIndex];
    }
    
    return otp;
  }
  
  // Encrypt sensitive fields in a document
  encryptFields(document, fieldsToEncrypt) {
    const encrypted = { ...document };
    const encryptedFieldsList = [];
    
    for (const field of fieldsToEncrypt) {
      if (encrypted[field]) {
        encrypted[field] = this.encrypt(encrypted[field]);
        encryptedFieldsList.push(field);
      }
    }
    
    encrypted.encryptedFields = encryptedFieldsList;
    return encrypted;
  }
  
  // Decrypt sensitive fields in a document
  decryptFields(document) {
    if (!document.encryptedFields || document.encryptedFields.length === 0) {
      return document;
    }
    
    const decrypted = { ...document };
    
    for (const field of document.encryptedFields) {
      if (decrypted[field]) {
        try {
          decrypted[field] = this.decrypt(decrypted[field]);
        } catch (error) {
          // Log error but don't throw - might be unencrypted legacy data
          console.warn(`Failed to decrypt field ${field}:`, error.message);
        }
      }
    }
    
    return decrypted;
  }
  
  // Create a secure hash for data integrity verification
  createIntegrityHash(data) {
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);
    return crypto.createHmac('sha256', this.encryptionKey).update(dataString).digest('hex');
  }
  
  // Verify data integrity
  verifyIntegrity(data, hash) {
    const computedHash = this.createIntegrityHash(data);
    return computedHash === hash;
  }
}

module.exports = new EncryptionService();
