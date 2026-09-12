import { Request, Response, NextFunction } from 'express';

interface RateLimitStore {
  [key: string]: { count: number; resetTime: number };
}

const store: RateLimitStore = {};

export function createRateLimiter(windowMs: number = 60000, maxRequests: number = 30) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || 'unknown';
    const now = Date.now();

    // Cleanup old entries
    if (!store[key] || store[key].resetTime < now) {
      store[key] = { count: 0, resetTime: now + windowMs };
    }

    store[key].count++;

    // Set rate limit headers
    res.set('X-RateLimit-Limit', maxRequests.toString());
    res.set('X-RateLimit-Remaining', Math.max(0, maxRequests - store[key].count).toString());
    res.set('X-RateLimit-Reset', store[key].resetTime.toString());

    if (store[key].count > maxRequests) {
      const retryAfter = Math.ceil((store[key].resetTime - now) / 1000);
      return res.status(429).json({
        error: 'Too many requests',
        retryAfter,
        message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`
      });
    }

    next();
  };
}
