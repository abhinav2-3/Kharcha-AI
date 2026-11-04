import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { connectDB } from '@/lib/db';
import { User } from '@/models/User';
import { getAuthUserId, setGuestCookie, signGuestToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    // Check if client already has a valid session
    const existingUserId = await getAuthUserId(request);
    if (existingUserId) {
      const existingUser = await User.findOne({ userId: existingUserId });
      if (existingUser) {
        existingUser.lastSeenAt = new Date();
        await existingUser.save();

        const token = await signGuestToken(existingUser.userId);
        const response = NextResponse.json({
          success: true,
          isNew: false,
          user: {
            userId: existingUser.userId,
            lastSeenAt: existingUser.lastSeenAt,
            createdAt: existingUser.createdAt,
          },
          token,
        });

        setGuestCookie(response, token);
        return response;
      }
    }

    // Otherwise, create a new guest user
    const newUserId = uuidv4();
    const newUser = await User.create({
      userId: newUserId,
      lastSeenAt: new Date(),
    });

    const token = await signGuestToken(newUser.userId);
    const response = NextResponse.json(
      {
        success: true,
        isNew: true,
        user: {
          userId: newUser.userId,
          lastSeenAt: newUser.lastSeenAt,
          createdAt: newUser.createdAt,
        },
        token,
      },
      { status: 201 }
    );

    setGuestCookie(response, token);
    return response;
  } catch (error) {
    console.error('Error in /api/auth/guest:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

