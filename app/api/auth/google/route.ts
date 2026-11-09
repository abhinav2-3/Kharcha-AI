import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { connectDB } from '@/lib/db';
import { User, IUser } from '@/models/User';
import { Entry } from '@/models/Entry';
import {
  getAuthenticatedUser,
  setSessionCookie,
  signSessionToken,
} from '@/lib/auth';
import { verifyGoogleIdToken, GoogleAuthError } from '@/lib/google';
import { checkAuthRateLimit, recordAuthRateLimitHit } from '@/lib/ratelimit';
import { AuthOutcome } from '@/lib/types';

export async function POST(request: NextRequest) {
  // 1. Strict Content-Type enforcement
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return NextResponse.json(
      { error: 'invalid_request', message: 'Expected application/json' },
      { status: 400 }
    );
  }

  // 2. IP-based Rate Limiting
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1';

  const rl = await checkAuthRateLimit(ip);
  if (!rl.allowed) {
    return NextResponse.json(
      {
        error: 'rate_limited',
        message: 'Too many authentication attempts. Please wait a moment.',
      },
      { status: 429 }
    );
  }
  await recordAuthRateLimitHit(ip);

  // 3. Parse request payload
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'invalid_json', message: 'Malformed JSON payload.' },
      { status: 400 }
    );
  }

  const credential = body?.credential;
  if (!credential || typeof credential !== 'string') {
    return NextResponse.json(
      { error: 'invalid_token', message: 'Google credential ID token is required.' },
      { status: 400 }
    );
  }

  // 4. Verify Google ID Token
  let googlePayload;
  try {
    googlePayload = await verifyGoogleIdToken(credential);
  } catch (err: any) {
    if (err instanceof GoogleAuthError) {
      const status = err.code === 'MISSING_CLIENT_ID' ? 500 : 400;
      const errorCode =
        err.code === 'EMAIL_NOT_VERIFIED' ? 'email_not_verified' : 'invalid_token';
      return NextResponse.json(
        { error: errorCode, message: err.message },
        { status }
      );
    }
    return NextResponse.json(
      { error: 'invalid_token', message: 'Failed to verify Google token.' },
      { status: 400 }
    );
  }

  await connectDB();

  try {
    // 5. Identify Current Session User (resolving any existing mergedInto)
    const sessionAuth = await getAuthenticatedUser(request);
    const sessionUser: IUser | null = sessionAuth?.user || null;

    // 6. Find existing account with this googleSub
    const googleUser = await User.findOne({ googleSub: googlePayload.sub });

    let effectiveUser: IUser;
    let outcome: AuthOutcome;
    let mergedCount = 0;

    // ==========================================
    // CASE A: User is already logged into this Google account
    // ==========================================
    if (googleUser && sessionUser && sessionUser.userId === googleUser.userId) {
      outcome = 'noop';
      effectiveUser = googleUser;
      if (googlePayload.name) effectiveUser.name = googlePayload.name;
      if (googlePayload.picture) effectiveUser.picture = googlePayload.picture;
      effectiveUser.lastSeenAt = new Date();
      await effectiveUser.save();
    }

    // ==========================================
    // CASE B: First-time claim of current guest session
    // (No account exists for googleSub, and current session is a guest)
    // ==========================================
    else if (!googleUser && sessionUser && !sessionUser.googleSub) {
      sessionUser.googleSub = googlePayload.sub;
      sessionUser.email = googlePayload.email;
      if (googlePayload.name) sessionUser.name = googlePayload.name;
      if (googlePayload.picture) sessionUser.picture = googlePayload.picture;
      sessionUser.claimedAt = new Date();
      sessionUser.lastSeenAt = new Date();
      await sessionUser.save();

      effectiveUser = sessionUser;
      outcome = 'claimed';
      mergedCount = 0; // Entries stay in place with exact same userId
    }

    // ==========================================
    // CASE C: Existing Google account, current session is a guest
    // (Merge guest entries into the existing Google account)
    // ==========================================
    else if (googleUser && sessionUser && !sessionUser.googleSub) {
      effectiveUser = googleUser;
      outcome = 'logged_in';

      // Perform atomic merge (with transaction if supported on replica set)
      let dbSession: mongoose.ClientSession | null = null;
      let inTransaction = false;

      try {
        dbSession = await mongoose.startSession();
        dbSession.startTransaction();
        inTransaction = true;
      } catch {
        dbSession = null;
        inTransaction = false;
      }

      try {
        const queryOpts = inTransaction && dbSession ? { session: dbSession } : {};

        // Find guest entries (including soft-deleted ones)
        const guestEntries = await Entry.find({ userId: sessionUser.userId }, null, queryOpts);

        if (guestEntries.length > 0) {
          // Check for clientId conflicts with existing account entries
          const existingClientIds = new Set(
            (
              await Entry.find(
                { userId: googleUser.userId },
                { clientId: 1 },
                queryOpts
              )
            ).map((e) => e.clientId)
          );

          const toMove = guestEntries.filter((e) => !existingClientIds.has(e.clientId));
          const duplicates = guestEntries.filter((e) => existingClientIds.has(e.clientId));

          // Move non-duplicate entries to the Google account
          if (toMove.length > 0) {
            await Entry.updateMany(
              { _id: { $in: toMove.map((e) => e._id) } },
              { $set: { userId: googleUser.userId } },
              queryOpts
            );
            mergedCount = toMove.length;
          }

          // Discard duplicate guest entries (existing account copy takes precedence)
          if (duplicates.length > 0) {
            await Entry.deleteMany(
              { _id: { $in: duplicates.map((e) => e._id) } },
              queryOpts
            );
          }
        }

        // Mark guest record with mergedInto for multi-device continuity
        sessionUser.mergedInto = googleUser.userId;
        await sessionUser.save(queryOpts);

        if (inTransaction && dbSession) {
          await dbSession.commitTransaction();
        }
      } catch (mergeErr) {
        if (inTransaction && dbSession) {
          await dbSession.abortTransaction();
        }
        console.error('Data merge failed during Google auth:', mergeErr);
        return NextResponse.json(
          { error: 'server_error', message: 'Failed to merge guest entries. Please try again.' },
          { status: 500 }
        );
      } finally {
        if (dbSession) {
          await dbSession.endSession();
        }
      }

      // Update last seen and profile metadata on target account
      if (googlePayload.name) effectiveUser.name = googlePayload.name;
      if (googlePayload.picture) effectiveUser.picture = googlePayload.picture;
      effectiveUser.lastSeenAt = new Date();
      await effectiveUser.save();
    }

    // ==========================================
    // CASE D: No active session, new Google account
    // ==========================================
    else if (!googleUser && (!sessionUser || sessionUser.googleSub)) {
      effectiveUser = await User.create({
        userId: uuidv4(),
        googleSub: googlePayload.sub,
        email: googlePayload.email,
        name: googlePayload.name || null,
        picture: googlePayload.picture || null,
        claimedAt: new Date(),
        lastSeenAt: new Date(),
      });
      outcome = 'created';
      mergedCount = 0;
    }

    // ==========================================
    // CASE E: Session is already claimed with a different account
    // (Switch account, NEVER merge between two separate claimed users)
    // ==========================================
    else {
      // googleUser exists, sessionUser exists and is already claimed
      effectiveUser = googleUser!;
      outcome = 'logged_in';
      mergedCount = 0;

      if (googlePayload.name) effectiveUser.name = googlePayload.name;
      if (googlePayload.picture) effectiveUser.picture = googlePayload.picture;
      effectiveUser.lastSeenAt = new Date();
      await effectiveUser.save();
    }

    // 7. Issue new session cookie for the authenticated account
    const token = await signSessionToken(effectiveUser.userId);
    const response = NextResponse.json({
      success: true,
      user: {
        userId: effectiveUser.userId,
        isGuest: false,
        email: effectiveUser.email,
        name: effectiveUser.name || undefined,
        picture: effectiveUser.picture || undefined,
        claimedAt: effectiveUser.claimedAt ? effectiveUser.claimedAt.toISOString() : undefined,
      },
      outcome,
      mergedCount,
    });

    setSessionCookie(response, token);
    return response;
  } catch (error) {
    console.error('Unhandled error in /api/auth/google:', error);
    return NextResponse.json(
      { error: 'server_error', message: 'An unexpected authentication error occurred.' },
      { status: 500 }
    );
  }
}

