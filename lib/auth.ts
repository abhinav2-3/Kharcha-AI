import { NextRequest, NextResponse } from 'next/server';
import { SignJWT, jwtVerify } from 'jose';
import { COOKIE_MAX_AGE_SECONDS, COOKIE_NAME } from './constants';
import { connectDB } from './db';
import { IUser, User } from '@/models/User';

const JWT_SECRET = process.env.JWT_SECRET || 'kharcha-super-secure-jwt-secret-key-32chars-min';
const SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

export interface GuestJwtPayload {
  userId: string;
}

/**
 * Sign a session JWT containing only the userId.
 */
export async function signSessionToken(userId: string): Promise<string> {
  return await new SignJWT({ userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('365d')
    .sign(SECRET_KEY);
}

// Backward-compatible alias
export const signGuestToken = signSessionToken;

/**
 * Verify a session JWT and extract the userId.
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
 * Extract raw authenticated userId from cookies or Authorization Bearer header.
 */
export async function getAuthUserId(request: NextRequest): Promise<string | null> {
  // 1. Check httpOnly cookie
  const cookie = request.cookies.get(COOKIE_NAME);
  if (cookie?.value) {
    const payload = await verifyGuestToken(cookie.value);
    if (payload?.userId) return payload.userId;
  }

  // 2. Check Authorization Bearer header (for API testing / Postman)
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    const payload = await verifyGuestToken(token);
    if (payload?.userId) return payload.userId;
  }

  return null;
}

/**
 * Resolves the canonical user record from a userId, automatically following
 * any `mergedInto` pointers when a guest account was merged into a claimed account.
 */
export async function resolveSessionUser(rawUserId: string): Promise<IUser | null> {
  await connectDB();
  let user = await User.findOne({ userId: rawUserId });
  let hops = 0;

  while (user?.mergedInto && hops < 5) {
    const target = await User.findOne({ userId: user.mergedInto });
    if (!target) break;
    user = target;
    hops++;
  }

  return user;
}

/**
 * Higher-level auth helper: retrieves the canonical User document for the request,
 * automatically traversing `mergedInto` if another device merged this guest account.
 */
export async function getAuthenticatedUser(
  request: NextRequest
): Promise<{ user: IUser; needsCookieUpdate: boolean } | null> {
  const rawUserId = await getAuthUserId(request);
  if (!rawUserId) return null;

  const user = await resolveSessionUser(rawUserId);
  if (!user) return null;

  const needsCookieUpdate = user.userId !== rawUserId;
  return { user, needsCookieUpdate };
}

/**
 * Attach the session cookie to a NextResponse.
 */
export function setSessionCookie(response: NextResponse, token: string): void {
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

// Backward-compatible alias
export const setGuestCookie = setSessionCookie;

/**
 * Clear the session cookie on a NextResponse (for logout).
 */
export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set({
    name: COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}
