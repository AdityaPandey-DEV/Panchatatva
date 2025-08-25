const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const logger = require('./logger');

class JWTService {
  constructor() {
    this.accessTokenSecret = process.env.JWT_SECRET;
    this.refreshTokenSecret = process.env.JWT_REFRESH_SECRET;
    this.accessTokenExpiry = process.env.JWT_EXPIRES_IN || '15m';
    this.refreshTokenExpiry = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
    
    if (!this.accessTokenSecret || !this.refreshTokenSecret) {
      throw new Error('JWT secrets not configured');
    }
  }
  
  generateTokenId() {
    return crypto.randomBytes(16).toString('hex');
  }
  
  generateTokens(payload) {
    const tokenId = this.generateTokenId();
    const accessTokenPayload = {
      ...payload,
      tokenId,
      type: 'access'
    };
    
    const refreshTokenPayload = {
      userId: payload.userId,
      email: payload.email,
      tokenId,
      type: 'refresh'
    };
    
    const accessToken = jwt.sign(accessTokenPayload, this.accessTokenSecret, {
      expiresIn: this.accessTokenExpiry,
      issuer: 'panchtatva-justice',
      audience: 'panchtatva-users'
    });
    
    const refreshToken = jwt.sign(refreshTokenPayload, this.refreshTokenSecret, {
      expiresIn: this.refreshTokenExpiry,
      issuer: 'panchtatva-justice',
      audience: 'panchtatva-users'
    });
    
    // Calculate expiry dates
    const accessTokenExpiry = new Date(Date.now() + this.parseExpiry(this.accessTokenExpiry));
    const refreshTokenExpiry = new Date(Date.now() + this.parseExpiry(this.refreshTokenExpiry));
    
    return {
      accessToken,
      refreshToken,
      tokenId,
      accessTokenExpiry,
      refreshTokenExpiry
    };
  }
  
  verifyAccessToken(token) {
    try {
      const decoded = jwt.verify(token, this.accessTokenSecret, {
        issuer: 'panchtatva-justice',
        audience: 'panchtatva-users'
      });
      
      if (decoded.type !== 'access') {
        throw new Error('Invalid token type');
      }
      
      return { valid: true, decoded };
    } catch (error) {
      logger.debug('Access token verification failed:', error.message);
      return { valid: false, error: error.message };
    }
  }
  
  verifyRefreshToken(token) {
    try {
      const decoded = jwt.verify(token, this.refreshTokenSecret, {
        issuer: 'panchtatva-justice',
        audience: 'panchtatva-users'
      });
      
      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }
      
      return { valid: true, decoded };
    } catch (error) {
      logger.debug('Refresh token verification failed:', error.message);
      return { valid: false, error: error.message };
    }
  }
  
  extractTokenFromHeader(authHeader) {
    if (!authHeader) {
      return null;
    }
    
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null;
    }
    
    return parts[1];
  }
  
  parseExpiry(expiry) {
    // Convert JWT expiry format to milliseconds
    const unit = expiry.slice(-1);
    const value = parseInt(expiry.slice(0, -1));
    
    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return value;
    }
  }
  
  getTokenInfo(token) {
    try {
      // Decode without verification to get info
      const decoded = jwt.decode(token);
      return {
        valid: true,
        payload: decoded,
        expired: decoded.exp < Date.now() / 1000
      };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }
  
  blacklistToken(tokenId) {
    // In a production environment, you would store blacklisted tokens
    // in Redis or a database with expiry matching the token expiry
    logger.info(`Token blacklisted: ${tokenId}`);
    // TODO: Implement Redis-based token blacklisting
  }
  
  isTokenBlacklisted(tokenId) {
    // TODO: Check Redis for blacklisted token
    return false;
  }
}

module.exports = new JWTService();
