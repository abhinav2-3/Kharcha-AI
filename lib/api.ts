import type { Entry, GoogleAuthResponse, Source, UserProfile } from './types';

export class ApiError extends Error {
  constructor(
    public kind: 'network' | 'ratelimit' | 'server' | 'validation',
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ApiMissingAmountError extends Error {
  constructor(
    message: string,
    public rawText: string,
    public missingFields: string[],
    public extracted: any
  ) {
    super(message);
    this.name = 'ApiMissingAmountError';
  }
}

/**
 * Initializes or verifies the silent guest authentication cookie.
 */
export async function ensureAuth(): Promise<{ userId: string }> {
  try {
    const res = await fetch('/api/auth/guest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });

    if (!res.ok) {
      throw new Error(`Auth failed with status ${res.status}`);
    }

    const data = await res.json();
    return { userId: data.user.userId };
  } catch (err: any) {
    console.warn('ensureAuth error:', err);
    throw new ApiError('network', 'Could not initialize guest session. Check connection.');
  }
}

/**
 * Fetch entries from the real backend API.
 */
export async function listEntries(params?: {
  from?: string;
  to?: string;
  limit?: number;
}): Promise<Entry[]> {
  try {
    const query = new URLSearchParams();
    if (params?.from) query.set('from', params.from);
    if (params?.to) query.set('to', params.to);
    if (params?.limit) query.set('limit', String(params.limit));

    const res = await fetch(`/api/entries?${query.toString()}`, {
      method: 'GET',
      credentials: 'include',
    });

    if (res.status === 401) {
      await ensureAuth();
      return listEntries(params);
    }

    if (!res.ok) {
      throw new Error(`Failed to list entries: ${res.statusText}`);
    }

    const data = await res.json();
    return (data.entries || []).map((e: any) => ({
      _id: e._id,
      clientId: e.clientId,
      rawText: e.rawText,
      source: e.source,
      amount: e.amount,
      type: e.type,
      category: e.category,
      categoryHint: e.categoryHint,
      mode: e.mode,
      note: e.note,
      spentAt: typeof e.spentAt === 'string' ? e.spentAt : new Date(e.spentAt).toISOString(),
      spentOn: e.spentOn,
      parseStatus: e.parseStatus,
      createdAt: typeof e.createdAt === 'string' ? e.createdAt : new Date(e.createdAt).toISOString(),
      sync: 'synced',
    }));
  } catch (err: any) {
    if (err instanceof ApiError) throw err;
    throw new ApiError('network', 'Network error while fetching entries.');
  }
}

/**
 * Creates new entries by submitting text or voice to AI parser and MongoDB.
 */
export async function createEntries(payload: {
  clientId: string;
  rawText: string;
  source: Source;
  alternatives?: string[];
}): Promise<Entry[]> {
  try {
    const res = await fetch('/api/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'include',
    });

    if (res.status === 401) {
      await ensureAuth();
      return createEntries(payload);
    }

    const json = await res.json();

    // 422: Amount is missing from user input
    if (res.status === 422 && json.error === 'MISSING_AMOUNT') {
      throw new ApiMissingAmountError(
        json.message || 'Amount is missing from input.',
        json.rawText || payload.rawText,
        json.missingFields || ['amount'],
        json.extracted || {}
      );
    }

    if (!res.ok) {
      if (res.status === 429) {
        throw new ApiError('ratelimit', json.message || 'Too many requests. Please wait a moment.');
      }
      if (res.status === 400 && json.error === 'INVALID_INPUT') {
        throw new ApiError('validation', json.message || 'Please enter a valid expense description.');
      }
      if (res.status === 503 || json.error === 'AI_UNAVAILABLE') {
        throw new ApiError('server', json.message || 'AI service is temporarily busy. Please enter details manually.');
      }
      throw new ApiError('server', json.error || 'Server error while parsing expense.');
    }

    return (json.entries || []).map((e: any) => ({
      _id: e._id,
      clientId: e.clientId,
      rawText: e.rawText,
      source: e.source,
      amount: e.amount,
      type: e.type,
      category: e.category,
      categoryHint: e.categoryHint,
      mode: e.mode,
      note: e.note,
      spentAt: typeof e.spentAt === 'string' ? e.spentAt : new Date(e.spentAt).toISOString(),
      spentOn: e.spentOn,
      parseStatus: e.parseStatus,
      createdAt: typeof e.createdAt === 'string' ? e.createdAt : new Date(e.createdAt).toISOString(),
      sync: 'synced',
    }));
  } catch (err: any) {
    if (err instanceof ApiMissingAmountError || err instanceof ApiError) {
      throw err;
    }
    throw new ApiError('network', 'Cannot connect to server. Check your connection.');
  }
}

/**
 * Fetches current authenticated user profile.
 */
export async function fetchMe(): Promise<UserProfile | null> {
  try {
    let res = await fetch('/api/me', {
      method: 'GET',
      credentials: 'include',
    });

    if (res.status === 401) {
      await ensureAuth();
      res = await fetch('/api/me', {
        method: 'GET',
        credentials: 'include',
      });
    }

    if (!res.ok) return null;
    const data = await res.json();
    if (data?.user) {
      data.user.googleClientId =
        data.googleClientId || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      return data.user;
    }
    return null;
  } catch (err) {
    console.error('fetchMe error:', err);
    return null;
  }
}

/**
 * Submits Google ID Token credential to /api/auth/google.
 */
export async function loginWithGoogle(credential: string): Promise<GoogleAuthResponse> {
  try {
    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential }),
      credentials: 'include',
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const errCode = data?.error || 'auth_failed';
      const errMsg = data?.message || 'Google sign-in failed. Please try again.';
      throw new ApiError('server', errMsg, { code: errCode });
    }

    return data;
  } catch (err: any) {
    if (err instanceof ApiError) throw err;
    throw new ApiError('network', 'Could not complete Google sign-in. Check your connection.');
  }
}

/**
 * Logs out the current claimed account.
 */
export async function logoutUser(): Promise<void> {
  try {
    const res = await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new ApiError('server', data?.message || 'Failed to log out.');
    }
  } catch (err: any) {
    if (err instanceof ApiError) throw err;
    throw new ApiError('network', 'Network error during logout.');
  }
}

/**
 * Updates an entry in the backend.
 */
export async function updateEntry(
  idOrClientId: string,
  patch: Partial<Entry> & { restore?: boolean }
): Promise<Entry | null> {
  try {
    const body: Record<string, any> = {};
    if (patch.amount !== undefined) body.amountPaise = patch.amount;
    if (patch.type !== undefined) body.type = patch.type;
    if (patch.category !== undefined) body.category = patch.category;
    if (patch.categoryHint !== undefined) body.categoryHint = patch.categoryHint;
    if (patch.mode !== undefined) body.mode = patch.mode;
    if (patch.note !== undefined) body.note = patch.note;
    if (patch.spentAt !== undefined) body.spentAt = patch.spentAt;
    if (patch.spentOn !== undefined) body.spentOn = patch.spentOn;
    if (patch.rawText !== undefined) body.rawText = patch.rawText;
    if (patch.source !== undefined) body.source = patch.source;
    if (patch.restore !== undefined) body.restore = patch.restore;

    // Use Mongo _id if present, otherwise clientId
    const targetId = (patch as any)._id || idOrClientId;
    const res = await fetch(`/api/entries/${targetId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'include',
    });

    if (!res.ok) {
      throw new Error(`Update failed: ${res.statusText}`);
    }

    const json = await res.json();
    if (json.entry) {
      const e = json.entry;
      return {
        _id: e._id,
        clientId: e.clientId,
        rawText: e.rawText,
        source: e.source,
        amount: e.amount,
        type: e.type,
        category: e.category,
        categoryHint: e.categoryHint,
        mode: e.mode,
        note: e.note,
        spentAt: typeof e.spentAt === 'string' ? e.spentAt : new Date(e.spentAt).toISOString(),
        spentOn: e.spentOn,
        parseStatus: e.parseStatus,
        createdAt: typeof e.createdAt === 'string' ? e.createdAt : new Date(e.createdAt).toISOString(),
        sync: 'synced',
      };
    }
    return null;
  } catch (err) {
    console.error('updateEntry error:', err);
    return null;
  }
}

/**
 * Soft deletes an entry in the backend.
 */
export async function deleteEntry(idOrClientId: string, mongoId?: string): Promise<void> {
  try {
    const targetId = mongoId || idOrClientId;
    const res = await fetch(`/api/entries/${targetId}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!res.ok) {
      throw new Error(`Delete failed: ${res.statusText}`);
    }
  } catch (err) {
    console.error('deleteEntry error:', err);
  }
}

/**
 * Restores a soft-deleted entry in the backend.
 */
export async function restoreEntry(idOrClientId: string, mongoId?: string): Promise<boolean> {
  try {
    const targetId = mongoId || idOrClientId;
    const res = await fetch(`/api/entries/${targetId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restore: true }),
      credentials: 'include',
    });
    return res.ok;
  } catch (err) {
    console.error('restoreEntry error:', err);
    return false;
  }
}

/**
 * Fetches calculated aggregation stats directly from MongoDB.
 */
export async function getStats(
  queryParam?: string | { range?: string; month?: string; from?: string; to?: string }
): Promise<any> {
  try {
    let url = '/api/stats';
    if (typeof queryParam === 'string') {
      url += `?range=${encodeURIComponent(queryParam)}`;
    } else if (queryParam) {
      const params = new URLSearchParams();
      if (queryParam.range) params.set('range', queryParam.range);
      if (queryParam.month) params.set('month', queryParam.month);
      if (queryParam.from) params.set('from', queryParam.from);
      if (queryParam.to) params.set('to', queryParam.to);
      url += `?${params.toString()}`;
    }

    const res = await fetch(url, {
      method: 'GET',
      credentials: 'include',
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.stats;
  } catch {
    return null;
  }
}



/**
 * Submits user feedback directly to the developer.
 */
export async function sendFeedback(payload: {
  message: string;
  category?: 'bug' | 'idea' | 'other';
  metadata?: {
    userAgent?: string;
    screen?: string;
    theme?: string;
  };
}): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'include',
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      throw new ApiError('server', data?.error || 'Failed to submit feedback.');
    }

    return data;
  } catch (err: any) {
    if (err instanceof ApiError) throw err;
    throw new ApiError('network', 'Could not submit feedback. Check your connection.');
  }
}
