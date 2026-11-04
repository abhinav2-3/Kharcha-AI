import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Entry } from '@/models/Entry';
import { getAuthUserId } from '@/lib/auth';
import { UpdateEntryInputSchema } from '@/lib/validations/entry';
import { getISTDateString } from '@/lib/parser/normalize';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const userId = await getAuthUserId(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Missing or invalid guest session' },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const body = await request.json().catch(() => null);
    const validation = UpdateEntryInputSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation Error', details: validation.error.format() },
        { status: 400 }
      );
    }

    await connectDB();

    const entry = await Entry.findOne({ _id: id, userId, deletedAt: null });
    if (!entry) {
      return NextResponse.json(
        { success: false, error: 'Entry not found' },
        { status: 404 }
      );
    }

    const data = validation.data;

    // Update Amount (Rupees to Paise or direct Paise)
    if (data.amount !== undefined) {
      entry.amount = Math.round(data.amount * 100);
    } else if (data.amountPaise !== undefined) {
      entry.amount = data.amountPaise;
    }

    if (data.type !== undefined) entry.type = data.type;
    if (data.category !== undefined) entry.category = data.category;
    if (data.categoryHint !== undefined) entry.categoryHint = data.categoryHint;
    if (data.mode !== undefined) entry.mode = data.mode;
    if (data.note !== undefined) entry.note = data.note;

    // Update Dates
    if (data.spentAt !== undefined) {
      const parsedSpentAt = new Date(data.spentAt);
      if (!isNaN(parsedSpentAt.getTime())) {
        entry.spentAt = parsedSpentAt;
        entry.spentOn = getISTDateString(parsedSpentAt);
      }
    } else if (data.spentOn !== undefined) {
      entry.spentOn = data.spentOn;
      entry.spentAt = new Date(`${data.spentOn}T12:00:00+05:30`);
    }

    // Editing any field marks parseStatus as manual
    entry.parseStatus = 'manual';

    await entry.save();

    return NextResponse.json({
      success: true,
      entry,
    });
  } catch (error) {
    console.error('Error in PATCH /api/entries/[id]:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const userId = await getAuthUserId(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Missing or invalid guest session' },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    await connectDB();

    const entry = await Entry.findOne({ _id: id, userId, deletedAt: null });
    if (!entry) {
      return NextResponse.json(
        { success: false, error: 'Entry not found or already deleted' },
        { status: 404 }
      );
    }

    // Soft Delete
    entry.deletedAt = new Date();
    await entry.save();

    return NextResponse.json({
      success: true,
      message: 'Entry soft-deleted successfully',
      id: entry._id,
    });
  } catch (error) {
    console.error('Error in DELETE /api/entries/[id]:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

