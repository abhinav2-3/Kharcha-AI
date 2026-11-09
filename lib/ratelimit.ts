import { connectDB } from '@/lib/db';
import { RateLimit } from '@/models/RateLimit';

export const RATE_LIMIT_CONFIG = {
  MINUTE_WINDOW_SECONDS: 60,
  MINUTE_LIMIT: 6, // 6 AI requests per minute per user
  DAILY_WINDOW_SECONDS: 86400,
  DAILY_LIMIT: 50, // 50 AI requests per 24 hours per user
};

export interface RateLimitResult {
  allowed: boolean;
  reason?: 'minute' | 'day';
  retryAfterSeconds?: number;
  message?: string;
  minuteCount?: number;
  dayCount?: number;
}

/**
 * Checks if a user has exceeded their minute or daily AI parsing limit.
 * Uses a single fast MongoDB aggregation.
 */
export async function checkRateLimit(userId: string): Promise<RateLimitResult> {
  await connectDB();

  const now = Date.now();
  const oneMinuteAgo = new Date(now - RATE_LIMIT_CONFIG.MINUTE_WINDOW_SECONDS * 1000);
  const oneDayAgo = new Date(now - RATE_LIMIT_CONFIG.DAILY_WINDOW_SECONDS * 1000);

  // Single aggregation query to fetch both minute and daily counts
  const [counts] = await RateLimit.aggregate([
    {
      $match: {
        userId,
        createdAt: { $gte: oneDayAgo },
      },
    },
    {
      $group: {
        _id: null,
        dayCount: { $sum: 1 },
        minuteCount: {
          $sum: {
            $cond: [{ $gte: ['$createdAt', oneMinuteAgo] }, 1, 0],
          },
        },
      },
    },
  ]);

  const minuteCount = counts?.minuteCount || 0;
  const dayCount = counts?.dayCount || 0;

  // 1. Minute burst limit check
  if (minuteCount >= RATE_LIMIT_CONFIG.MINUTE_LIMIT) {
    return {
      allowed: false,
      reason: 'minute',
      retryAfterSeconds: 30,
      message: "You're logging expenses too fast. Please wait 30 seconds before trying again.",
      minuteCount,
      dayCount,
    };
  }

  // 2. Daily cap check
  if (dayCount >= RATE_LIMIT_CONFIG.DAILY_LIMIT) {
    return {
      allowed: false,
      reason: 'day',
      retryAfterSeconds: 3600,
      message:
        'Daily AI parsing limit reached (50/day). You can still log or edit entries manually using the plus button.',
      minuteCount,
      dayCount,
    };
  }

  return {
    allowed: true,
    minuteCount,
    dayCount,
  };
}

/**
 * Records an AI usage event for rate limiting and quota tracking.
 */
export async function recordRateLimitHit(userId: string): Promise<void> {
  try {
    await connectDB();
    await RateLimit.create({
      userId,
      createdAt: new Date(),
    });
  } catch (err) {
    console.warn('Could not record rate limit hit:', err);
  }
}



/**
 * IP-based rate limiter for authentication endpoints (e.g. /api/auth/google).
 * Maximum 15 attempts per minute per IP address.
 */
export async function checkAuthRateLimit(
  ip: string
): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  try {
    await connectDB();
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    const key = `auth:${ip}`;
    const count = await RateLimit.countDocuments({
      userId: key,
      createdAt: { $gte: oneMinuteAgo },
    });

    if (count >= 15) {
      return { allowed: false, retryAfterSeconds: 60 };
    }
    return { allowed: true };
  } catch (err) {
    console.warn('Rate limit check error:', err);
    return { allowed: true }; // Fail-open to avoid locking out legitimate users on DB transient issues
  }
}

export async function recordAuthRateLimitHit(ip: string): Promise<void> {
  try {
    await connectDB();
    await RateLimit.create({
      userId: `auth:${ip}`,
      createdAt: new Date(),
    });
  } catch (err) {
    console.warn('Could not record auth rate limit hit:', err);
  }
}


/**
 * Rate limiter for developer feedback submissions.
 * Maximum 5 submissions per hour per user or IP address.
 */
export async function checkFeedbackRateLimit(
  keyId: string
): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  try {
    await connectDB();
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const key = `feedback:${keyId}`;
    const count = await RateLimit.countDocuments({
      userId: key,
      createdAt: { $gte: oneHourAgo },
    });

    if (count >= 5) {
      return { allowed: false, retryAfterSeconds: 3600 };
    }
    return { allowed: true };
  } catch (err) {
    console.warn('Feedback rate limit check error:', err);
    return { allowed: true };
  }
}

export async function recordFeedbackRateLimitHit(keyId: string): Promise<void> {
  try {
    await connectDB();
    await RateLimit.create({
      userId: `feedback:${keyId}`,
      createdAt: new Date(),
    });
  } catch (err) {
    console.warn('Could not record feedback rate limit hit:', err);
  }
}
