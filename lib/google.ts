import { OAuth2Client } from 'google-auth-library';

const GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

const client = new OAuth2Client(GOOGLE_CLIENT_ID);

export interface GoogleTokenPayload {
  sub: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
}

export class GoogleAuthError extends Error {
  constructor(public code: 'INVALID_TOKEN' | 'EMAIL_NOT_VERIFIED' | 'MISSING_CLIENT_ID', message: string) {
    super(message);
    this.name = 'GoogleAuthError';
  }
}

/**
 * Verifies a Google ID Token securely on the server.
 * Ensures aud matches our GOOGLE_CLIENT_ID and email is verified.
 */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleTokenPayload> {
  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new GoogleAuthError(
      'MISSING_CLIENT_ID',
      'GOOGLE_CLIENT_ID is not configured in the environment.'
    );
  }

  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: clientId,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.sub) {
      throw new GoogleAuthError('INVALID_TOKEN', 'Malformed Google token payload.');
    }

    if (!payload.email) {
      throw new GoogleAuthError('INVALID_TOKEN', 'Google token does not contain an email address.');
    }

    if (payload.email_verified !== true) {
      throw new GoogleAuthError(
        'EMAIL_NOT_VERIFIED',
        'Your Google account email has not been verified.'
      );
    }

    return {
      sub: payload.sub,
      email: payload.email.toLowerCase().trim(),
      emailVerified: payload.email_verified,
      name: payload.name || undefined,
      picture: payload.picture || undefined,
    };
  } catch (err: any) {
    if (err instanceof GoogleAuthError) {
      throw err;
    }
    console.error('Failed to verify Google ID token:', err?.message || err);
    throw new GoogleAuthError('INVALID_TOKEN', 'Invalid or expired Google ID token.');
  }
}

