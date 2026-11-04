import type { Entry, Source } from './types';

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
        throw new ApiError('ratelimit', 'Too many requests. Please wait a moment.');
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
 * Updates an entry in the backend.
 */
export async function updateEntry(idOrClientId: string, patch: Partial<Entry>): Promise<void> {
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

    // Use Mongo _id if present, otherwise fetch or pass
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
  } catch (err) {
    console.error('updateEntry error:', err);
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
 * Fetches calculated aggregation stats directly from MongoDB.
 */
export async function getStats(range = 'this_month'): Promise<any> {
  try {
    const res = await fetch(`/api/stats?range=${range}`, {
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

