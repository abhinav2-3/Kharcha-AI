import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Feedback } from '@/models/Feedback';
import { getAuthenticatedUser } from '@/lib/auth';
import { CreateFeedbackSchema } from '@/lib/validations/feedback';
import { checkFeedbackRateLimit, recordFeedbackRateLimitHit } from '@/lib/ratelimit';

export async function POST(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser(request);
    const user = authResult?.user;

    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1';

    const identifier = user?.userId || ip;

    // Rate limiting: Max 5 feedbacks per hour
    const rl = await checkFeedbackRateLimit(identifier);
    if (!rl.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: "You've submitted feedback recently. Please wait a bit before sending more.",
        },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = CreateFeedbackSchema.safeParse(body);

    if (!parsed.success) {
      const issue = parsed.error.issues[0]?.message || 'Invalid feedback content.';
      return NextResponse.json({ success: false, error: issue }, { status: 400 });
    }

    await connectDB();

    const { message, category, metadata } = parsed.data;

    const feedbackDoc = await Feedback.create({
      userId: user?.userId || `anon:${ip}`,
      message,
      category: category || 'other',
      email: user?.email || null,
      metadata: {
        userAgent: metadata?.userAgent || request.headers.get('user-agent') || undefined,
        screen: metadata?.screen || undefined,
        theme: metadata?.theme || undefined,
      },
    });

    await recordFeedbackRateLimitHit(identifier);

    return NextResponse.json(
      {
        success: true,
        message: 'Thank you for your feedback! It helps improve Kharcha.',
        feedbackId: feedbackDoc._id,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error in /api/feedback:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to submit feedback. Please try again later.' },
      { status: 500 }
    );
  }
}

