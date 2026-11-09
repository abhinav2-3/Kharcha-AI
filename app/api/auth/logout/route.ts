import { NextRequest, NextResponse } from 'next/server';
import { clearSessionCookie, getAuthenticatedUser } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const sessionAuth = await getAuthenticatedUser(request);
    const user = sessionAuth?.user;

    // Reject logout if current session is a guest to protect user data from being orphaned
    if (user && !user.googleSub) {
      return NextResponse.json(
        {
          error: 'guest_cannot_logout',
          message: 'Guest accounts cannot be logged out to prevent data loss. Link a Google account first.',
        },
        { status: 400 }
      );
    }

    const response = new NextResponse(null, { status: 204 });
    clearSessionCookie(response);
    return response;
  } catch (error) {
    console.error('Error in /api/auth/logout:', error);
    return NextResponse.json(
      { error: 'server_error', message: 'Failed to log out.' },
      { status: 500 }
    );
  }
}

