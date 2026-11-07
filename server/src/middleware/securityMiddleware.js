/**
 * Security and Rate Limiting Middleware for ResolveIQ Production Hardening
 */

// Production Security Headers Middleware
export const securityHeaders = (req, res, next) => {
  if (typeof res.setHeader === 'function') {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(self), geolocation=()');
    
    // HSTS in production environments when HTTPS is enabled
    try {
      const isHttps = Boolean(req.secure || (req.headers && req.headers['x-forwarded-proto'] === 'https'));
      if (process.env.NODE_ENV === 'production' && isHttps) {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
      }
    } catch {
      // Safe fallback if connection object is mocked
    }
  }

  next();
};

/**
 * In-memory sliding window rate limiter
 * Protects auth and high-frequency endpoints against brute-force / DoS attacks
 */
export const createRateLimiter = ({
  windowMs = 15 * 60 * 1000, // 15 minutes
  max = 100,                  // max requests per windowMs
  message = 'Too many requests from this IP, please try again later.'
} = {}) => {
  const requests = new Map();

  // Periodic cleanup every 5 minutes to prevent memory leaks
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of requests.entries()) {
      if (now - record.startTime > windowMs) {
        requests.delete(key);
      }
    }
  }, 5 * 60 * 1000).unref(); // unref so it does not keep process alive in tests

  return (req, res, next) => {
    // In test environment, bypass rate limiting
    if (process.env.NODE_ENV === 'test') {
      return next();
    }

    let ip = '127.0.0.1';
    try {
      ip = (req.headers && req.headers['x-forwarded-for']) || 
           (req.socket && req.socket.remoteAddress) || 
           (req.connection && req.connection.remoteAddress) || 
           '127.0.0.1';
    } catch {
      ip = '127.0.0.1';
    }

    const now = Date.now();
    const clientRecord = requests.get(ip);

    if (!clientRecord) {
      requests.set(ip, {
        count: 1,
        startTime: now
      });
      return next();
    }

    if (now - clientRecord.startTime > windowMs) {
      // Window expired, reset
      clientRecord.count = 1;
      clientRecord.startTime = now;
      return next();
    }

    clientRecord.count += 1;

    if (clientRecord.count > max) {
      const retryAfterSec = Math.ceil((clientRecord.startTime + windowMs - now) / 1000);
      if (typeof res.setHeader === 'function') {
        res.setHeader('Retry-After', retryAfterSec);
      }
      return res.status(429).json({
        success: false,
        message,
        retryAfter: retryAfterSec
      });
    }

    next();
  };
};

export const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 150, // Generous limit for live test suites while protecting live instances
  message: 'Too many authentication attempts. Please try again after 15 minutes.'
});
