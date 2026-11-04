import { NextRequest, NextResponse } from 'next/server';
import { SignJWT, jwtVerify } from 'jose';
import { COOKIE_MAX_AGE_SECONDS, COOKIE_NAME } from './constants';

const JWT_SECRET = process.env.JWT_SECRET || 'kharcha-super-secure-jwt-secret-key-32chars-min';
const SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

export interface GuestJwtPayload {
  userId: string;
}

/**
 * Sign a guest JWT containing only the userId.
 */
export async function signGuestToken(userId: string): Promise<string> {
  return await new SignJWT({ userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('365d')
    .sign(SECRET_KEY);
}

/**
 * Verify a guest JWT and extract the userId.
 */
export async function verifyGuestToken(token: string): Promise<GuestJwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY, {
      algorithms: ['HS256'],
    });

    if (payload && typeof payload.userId === 'string') {
      return { userId: payload.userId };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Extract authenticated userId from cookies or Authorization Bearer header (for Postman/API flexibility).
 */
export async function getAuthUserId(request: NextRequest): Promise<string | null> {
  // 1. Check httpOnly cookie
  const cookie = request.cookies.get(COOKIE_NAME);
  if (cookie?.value) {
    const payload = await verifyGuestToken(cookie.value);
    if (payload?.userId) return payload.userId;
  }

  // 2. Check Authorization Bearer header (convenient for API testing/Postman)
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    const payload = await verifyGuestToken(token);
    if (payload?.userId) return payload.userId;
  }

  return null;
}

/**
 * Attach the guest session cookie to a NextResponse.
 */
export function setGuestCookie(response: NextResponse, token: string): void {
  response.cookies.set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}

