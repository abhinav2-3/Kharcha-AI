import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
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

    const data = validation.data;
    const isObjectId = mongoose.Types.ObjectId.isValid(id);
    const baseFilter = isObjectId
      ? { $or: [{ _id: id }, { clientId: id }], userId }
      : { clientId: id, userId };

    const filter = data.restore ? baseFilter : { ...baseFilter, deletedAt: null };

    let entry = await Entry.findOne(filter);

    if (!entry) {
      // If restore was requested on non-existent entry, return 404
      if (data.restore) {
        return NextResponse.json(
          { success: false, error: 'Entry not found to restore' },
          { status: 404 }
        );
      }

      // Upsert: If entry wasn't in DB yet (e.g. was 422 missing amount) and amount is now provided
      if (data.amount !== undefined || data.amountPaise !== undefined) {
        const amountPaise =
          data.amount !== undefined
            ? Math.round(data.amount * 100)
            : data.amountPaise !== undefined
            ? data.amountPaise
            : 0;

        const spentAt = data.spentAt ? new Date(data.spentAt) : new Date();
        const spentOn = data.spentOn || getISTDateString(spentAt);

        const newEntry = await Entry.create({
          userId,
          clientId: id,
          rawText: data.rawText || data.note || 'Manual entry',
          source: data.source || 'text',
          amount: amountPaise,
          type: data.type || 'expense',
          category: data.category || 'other',
          categoryHint: data.categoryHint || null,
          mode: data.mode || 'cash',
          note: data.note || null,
          spentAt,
          spentOn,
          parseStatus: 'manual',
          deletedAt: null,
        });

        return NextResponse.json({
          success: true,
          entry: newEntry,
        });
      }

      return NextResponse.json(
        { success: false, error: 'Entry not found' },
        { status: 404 }
      );
    }

    // If restore is requested, un-delete the entry
    if (data.restore) {
      entry.deletedAt = null;
    }

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

    const isObjectId = mongoose.Types.ObjectId.isValid(id);
    const filter = isObjectId
      ? { $or: [{ _id: id }, { clientId: id }], userId, deletedAt: null }
      : { clientId: id, userId, deletedAt: null };

    const entry = await Entry.findOne(filter);
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
      clientId: entry.clientId,
    });
  } catch (error) {
    console.error('Error in DELETE /api/entries/[id]:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

