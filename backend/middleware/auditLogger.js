const AuditLog = require('../models/AuditLog');
const logger = require('../utils/logger');

const auditLogger = async (req, res, next) => {
  // Store original methods
  const originalSend = res.send;
  const originalJson = res.json;
  
  // Track request start time
  req.startTime = Date.now();
  
  // Override response methods to capture response
  res.send = function(body) {
    res.responseBody = body;
    return originalSend.call(this, body);
  };
  
  res.json = function(obj) {
    res.responseBody = obj;
    return originalJson.call(this, obj);
  };
  
  // Log the request after response is sent
  res.on('finish', async () => {
    try {
      await logRequest(req, res);
    } catch (error) {
      logger.error('Audit logging failed:', error);
    }
  });
  
  next();
};

const logRequest = async (req, res) => {
  // Skip logging for health checks and static files
  if (shouldSkipLogging(req.originalUrl)) {
    return;
  }
  
  const duration = Date.now() - req.startTime;
  const isError = res.statusCode >= 400;
  const isSuccess = res.statusCode >= 200 && res.statusCode < 300;
  
  // Determine action based on method and path
  const action = getActionFromRequest(req, res);
  
  if (!action) {
    return; // Skip if no action determined
  }
  
  // Get actor information
  const actorId = req.user?.id || null;
  const actorEmail = req.user?.email || 'anonymous';
  const actorRole = req.user?.role || 'anonymous';
  
  // Determine target
  const { targetType, targetId } = getTargetFromRequest(req);
  
  // Determine severity
  const severity = getSeverity(action, res.statusCode, req);
  
  // Prepare metadata
  const metadata = {
    method: req.method,
    path: req.originalUrl,
    statusCode: res.statusCode,
    duration,
    success: isSuccess,
    userAgent: req.get('User-Agent'),
    referer: req.get('Referer'),
    contentLength: res.get('Content-Length'),
    dataSize: getDataSize(req, res)
  };
  
  // Add error information if applicable
  if (isError && res.responseBody) {
    if (typeof res.responseBody === 'string') {
      try {
        const parsed = JSON.parse(res.responseBody);
        metadata.errorMessage = parsed.message || 'Unknown error';
        metadata.errorCode = parsed.code;
      } catch (e) {
        metadata.errorMessage = res.responseBody.substring(0, 200);
      }
    } else if (res.responseBody.message) {
      metadata.errorMessage = res.responseBody.message;
      metadata.errorCode = res.responseBody.code;
    }
  }
  
  // Add request body info for certain operations (redacted)
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
    metadata.hasRequestBody = true;
    metadata.requestBodySize = JSON.stringify(req.body).length;
    
    // Log specific fields for audit purposes (redacted)
    if (req.body.email && action.includes('login')) {
      metadata.targetEmail = req.body.email;
    }
  }
  
  // Create audit log entry
  await AuditLog.createEntry({
    actorId,
    actorEmail,
    actorRole,
    action,
    targetType,
    targetId,
    ip: getClientIP(req),
    userAgent: req.get('User-Agent'),
    sessionId: req.user?.sessionId,
    requestId: req.id || req.get('X-Request-ID'),
    metadata,
    severity,
    location: req.geoLocation // If available from IP geolocation middleware
  });
};

const shouldSkipLogging = (url) => {
  const skipPatterns = [
    '/health',
    '/favicon.ico',
    '/robots.txt',
    '/static/',
    '/assets/',
    '/.well-known/',
    '/metrics' // Skip internal metrics
  ];
  
  return skipPatterns.some(pattern => url.startsWith(pattern));
};

const getActionFromRequest = (req, res) => {
  const method = req.method;
  const path = req.originalUrl.toLowerCase();
  
  // Authentication actions
  if (path.includes('/auth/send-otp')) {
    return 'otp_sent';
  }
  if (path.includes('/auth/verify-otp')) {
    return res.statusCode === 200 ? 'login_success' : 'login_failed';
  }
  if (path.includes('/auth/logout')) {
    return 'logout';
  }
  
  // Case actions
  if (path.includes('/cases/upload')) {
    return 'case_uploaded';
  }
  if (path.includes('/cases/') && method === 'GET') {
    return 'case_viewed';
  }
  if (path.includes('/cases/') && path.includes('/assign')) {
    return 'case_assigned';
  }
  if (path.includes('/cases/') && path.includes('/accept')) {
    return 'case_accepted';
  }
  if (path.includes('/cases/') && path.includes('/decline')) {
    return 'case_declined';
  }
  if (path.includes('/cases/') && path.includes('/reassign')) {
    return 'case_reassigned';
  }
  
  // User management
  if (path.includes('/users/profile') && method === 'PUT') {
    return 'profile_updated';
  }
  if (path.includes('/users/availability') && method === 'POST') {
    return 'availability_updated';
  }
  if (path.includes('/users/conflicts') && method === 'POST') {
    return 'conflicts_updated';
  }
  
  // Admin actions
  if (path.includes('/admin/users') && method === 'POST') {
    return 'user_created';
  }
  if (path.includes('/admin/users') && method === 'PUT') {
    return 'user_updated';
  }
  if (path.includes('/admin/metrics')) {
    return 'metrics_accessed';
  }
  if (path.includes('/admin/audit-logs')) {
    return 'audit_log_accessed';
  }
  if (path.includes('/admin/config') && method === 'PUT') {
    return 'system_config_updated';
  }
  
  // Generic actions based on method
  if (method === 'POST') return 'data_created';
  if (method === 'PUT' || method === 'PATCH') return 'data_updated';
  if (method === 'DELETE') return 'data_deleted';
  if (method === 'GET') return 'data_accessed';
  
  return null;
};

const getTargetFromRequest = (req) => {
  const path = req.originalUrl;
  
  // Extract IDs from path
  const caseIdMatch = path.match(/\/cases\/([a-fA-F0-9]{24})/);
  const userIdMatch = path.match(/\/users\/([a-fA-F0-9]{24})/);
  
  if (caseIdMatch) {
    return { targetType: 'case', targetId: caseIdMatch[1] };
  }
  
  if (userIdMatch) {
    return { targetType: 'user', targetId: userIdMatch[1] };
  }
  
  if (path.includes('/auth/')) {
    return { targetType: 'session', targetId: null };
  }
  
  if (path.includes('/admin/')) {
    return { targetType: 'system', targetId: null };
  }
  
  return { targetType: 'system', targetId: null };
};

const getSeverity = (action, statusCode, req) => {
  // Critical severity actions
  const criticalActions = [
    'data_breach_attempt',
    'unauthorized_access',
    'system_config_updated'
  ];
  
  // High severity actions
  const highActions = [
    'account_locked',
    'user_role_changed',
    'assignment_overridden',
    'suspicious_activity'
  ];
  
  // Medium severity actions
  const mediumActions = [
    'login_failed',
    'case_assigned',
    'user_created',
    'user_updated',
    'case_reassigned'
  ];
  
  if (criticalActions.includes(action)) {
    return 'critical';
  }
  
  if (highActions.includes(action)) {
    return 'high';
  }
  
  if (mediumActions.includes(action)) {
    return 'medium';
  }
  
  // Status code based severity
  if (statusCode >= 500) {
    return 'high';
  }
  
  if (statusCode >= 400) {
    return 'medium';
  }
  
  return 'low';
};

const getDataSize = (req, res) => {
  let size = 0;
  
  if (req.body) {
    size += JSON.stringify(req.body).length;
  }
  
  const contentLength = res.get('Content-Length');
  if (contentLength) {
    size += parseInt(contentLength);
  }
  
  return size;
};

const getClientIP = (req) => {
  return req.ip || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress ||
         (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
         'unknown';
};

module.exports = { auditLogger };
