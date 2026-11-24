import { connectDB } from '@/lib/db';
import { RateLimit } from '@/models/RateLimit';

export const RATE_LIMIT_CONFIG = {
  // Base window settings
  MINUTE_WINDOW_SECONDS: 60,
  MINUTE_LIMIT: 6,
  DAILY_WINDOW_SECONDS: 86400,
  DAILY_LIMIT: 35,

  GUEST: {
    MINUTE_LIMIT: 6,
    MINUTE_WINDOW_SECONDS: 60,
    DAILY_LIMIT: 35,
    DAILY_WINDOW_SECONDS: 86400,
    RETRY_AFTER_MINUTE: 20,
  },
  USER: {
    MINUTE_LIMIT: 10,
    MINUTE_WINDOW_SECONDS: 60,
    DAILY_LIMIT: 75,
    DAILY_WINDOW_SECONDS: 86400,
    RETRY_AFTER_MINUTE: 15,
  },
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
 * Supports tiered quotas: Guests (35/day, 6/min) vs Signed-in Users (75/day, 10/min).
 */
export async function checkRateLimit(
  userId: string,
  isGuest: boolean = true
): Promise<RateLimitResult> {
  await connectDB();

  const cfg = isGuest ? RATE_LIMIT_CONFIG.GUEST : RATE_LIMIT_CONFIG.USER;
  const now = Date.now();
  const oneMinuteAgo = new Date(now - cfg.MINUTE_WINDOW_SECONDS * 1000);
  const oneDayAgo = new Date(now - cfg.DAILY_WINDOW_SECONDS * 1000);

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
  if (minuteCount >= cfg.MINUTE_LIMIT) {
    return {
      allowed: false,
      reason: 'minute',
      retryAfterSeconds: cfg.RETRY_AFTER_MINUTE,
      message: `You're logging expenses too fast. Please wait ${cfg.RETRY_AFTER_MINUTE} seconds before trying again.`,
      minuteCount,
      dayCount,
    };
  }

  // 2. Daily cap check
  if (dayCount >= cfg.DAILY_LIMIT) {
    return {
      allowed: false,
      reason: 'day',
      retryAfterSeconds: 3600,
      message: isGuest
        ? `Daily AI parsing limit reached (${cfg.DAILY_LIMIT}/day). Sign in with Google to get 75/day, or log entries manually.`
        : `Daily AI parsing limit reached (${cfg.DAILY_LIMIT}/day). You can still log or edit entries manually using the plus button.`,
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
