import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, setSessionCookie, signSessionToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser(request);
    if (!authResult) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Missing or invalid session' },
        { status: 401 }
      );
    }

    const { user, needsCookieUpdate } = authResult;

    // Refresh lastSeenAt timestamp
    user.lastSeenAt = new Date();
    await user.save();

    const response = NextResponse.json({
      success: true,
      user: {
        userId: user.userId,
        isGuest: !user.googleSub,
        email: user.email || undefined,
        name: user.name || undefined,
        picture: user.picture || undefined,
        claimedAt: user.claimedAt ? user.claimedAt.toISOString() : undefined,
        lastSeenAt: user.lastSeenAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      googleClientId:
        process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || undefined,
    });

    // If this session resolved through a merged guest account, update the client cookie
    // to the canonical target account directly!
    if (needsCookieUpdate) {
      const newToken = await signSessionToken(user.userId);
      setSessionCookie(response, newToken);
    }

    return response;
  } catch (error) {
    console.error('Error in /api/me:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
