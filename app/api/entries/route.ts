import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Entry } from '@/models/Entry';
import { getAuthUserId } from '@/lib/auth';
import { CreateEntryInputSchema } from '@/lib/validations/entry';
import { parse } from '@/lib/parser';
import { validatePreLLMInput } from '@/lib/parser/filter';
import { checkRateLimit, recordRateLimitHit } from '@/lib/ratelimit';

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthUserId(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Missing or invalid guest session' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => null);
    const validation = CreateEntryInputSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation Error', details: validation.error.format() },
        { status: 400 }
      );
    }

    const { clientId, rawText, source } = validation.data;

    // 1. Fast Pre-LLM Filter (Zero Token Cost Shield)
    const preCheck = validatePreLLMInput(rawText);
    if (!preCheck.valid) {
      return NextResponse.json(
        {
          success: false,
          error: 'INVALID_INPUT',
          message: preCheck.reason,
        },
        { status: 400 }
      );
    }

    await connectDB();

    // 2. Idempotency Check: Return existing entry if same (userId, clientId) was already processed
    const existing = await Entry.find({
      userId,
      $or: [
        { clientId },
        { clientId: { $regex: `^${clientId.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}:\\d+$` } },
      ],
    }).sort({ createdAt: 1 });

    if (existing.length > 0) {
      return NextResponse.json(
        {
          success: true,
          idempotent: true,
          entries: existing,
        },
        { status: 200 }
      );
    }

    // 3. Rate Limit Check (6 req/min, 50 req/day per user)
    const rateLimitResult = await checkRateLimit(userId);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'RATE_LIMIT_EXCEEDED',
          reason: rateLimitResult.reason,
          message: rateLimitResult.message,
          retryAfter: rateLimitResult.retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimitResult.retryAfterSeconds || 30),
          },
        }
      );
    }

    // 4. Parse text via AI Parser
    const parsedItems = await parse(rawText);

    // Record AI consumption for quota tracking
    await recordRateLimitHit(userId);

    // Non-transaction message (e.g., "aaj kuch kharch nahi hua")
    if (parsedItems.length === 0) {
      return NextResponse.json(
        {
          success: true,
          message: 'No transaction detected from input',
          entries: [],
        },
        { status: 200 }
      );
    }

    // 3. Validate Amount Presence:
    // If amount is missing, do NOT save a failed entry in MongoDB.
    // Instead, return an informative validation error so the client can prompt the user for the amount.
    const missingAmountItem = parsedItems.find(
      (item) => item.amount === null || item.parseStatus === 'failed'
    );

    if (missingAmountItem) {
      return NextResponse.json(
        {
          success: false,
          error: 'MISSING_AMOUNT',
          message: 'Amount is missing from input. Please specify how much was spent.',
          rawText,
          missingFields: ['amount'],
          extracted: {
            type: missingAmountItem.type,
            category: missingAmountItem.category,
            categoryHint: missingAmountItem.categoryHint,
            mode: missingAmountItem.mode,
            note: missingAmountItem.note,
            spentAt: missingAmountItem.spentAt,
            spentOn: missingAmountItem.spentOn,
          },
        },
        { status: 422 }
      );
    }

    // 4. Prepare Documents (handling single or multi-item entries)
    const docsToInsert = parsedItems.map((item, index) => {
      const itemClientId =
        parsedItems.length === 1 ? clientId : `${clientId}:${index}`;

      return {
        userId,
        clientId: itemClientId,
        rawText,
        source,
        amount: item.amount,
        type: item.type,
        category: item.category,
        categoryHint: item.categoryHint,
        mode: item.mode,
        note: item.note,
        spentAt: item.spentAt,
        spentOn: item.spentOn,
        parseStatus: item.parseStatus,
        deletedAt: null,
      };
    });

    // 4. Save to MongoDB
    const createdEntries = await Entry.insertMany(docsToInsert);

    return NextResponse.json(
      {
        success: true,
        entries: createdEntries,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error in POST /api/entries:', error);
    const isAiServiceError =
      error?.status === 429 ||
      error?.status === 503 ||
      error?.name === 'AbortError' ||
      error?.message?.includes('API_KEY') ||
      error?.message?.includes('timeout') ||
      error?.message?.includes('rate limit');

    return NextResponse.json(
      {
        success: false,
        error: isAiServiceError ? 'AI_UNAVAILABLE' : 'Internal Server Error',
        message: isAiServiceError
          ? 'AI parser is temporarily busy. Please enter details manually.'
          : 'Internal Server Error',
      },
      { status: isAiServiceError ? 503 : 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthUserId(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Missing or invalid guest session' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from'); // YYYY-MM-DD
    const to = searchParams.get('to'); // YYYY-MM-DD
    const cursor = searchParams.get('cursor'); // ISO date string of spentAt
    const limitParam = parseInt(searchParams.get('limit') || '20', 10);
    const limit = Math.min(Math.max(isNaN(limitParam) ? 20 : limitParam, 1), 50);

    await connectDB();

    // Query filter
    const query: Record<string, unknown> = {
      userId,
      deletedAt: null, // Exclude soft-deleted
    };

    if (from && to) {
      query.spentOn = { $gte: from, $lte: to };
    } else if (from) {
      query.spentOn = { $gte: from };
    } else if (to) {
      query.spentOn = { $lte: to };
    }

    // Cursor pagination (spentAt < cursor)
    if (cursor) {
      const cursorDate = new Date(cursor);
      if (!isNaN(cursorDate.getTime())) {
        query.spentAt = { $lt: cursorDate };
      }
    }

    // Fetch limit + 1 to detect if there is a next page
    const items = await Entry.find(query)
      .sort({ spentAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = items.length > limit;
    const entries = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore && entries.length > 0 ? entries[entries.length - 1].spentAt : null;

    return NextResponse.json({
      success: true,
      entries,
      nextCursor,
      hasMore,
    });
  } catch (error) {
    console.error('Error in GET /api/entries:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

