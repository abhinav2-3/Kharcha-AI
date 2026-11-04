import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Entry } from '@/models/Entry';
import { getAuthUserId } from '@/lib/auth';
import { getISTDateString } from '@/lib/parser/normalize';

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
    const range = searchParams.get('range') || 'this_month'; // 'this_month' | 'last_30_days' | 'all'
    const monthParam = searchParams.get('month'); // YYYY-MM
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');

    const todayStr = getISTDateString();
    let fromDateStr: string | null = fromParam;
    let toDateStr: string | null = toParam || todayStr;

    if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
      fromDateStr = `${monthParam}-01`;
      toDateStr = `${monthParam}-31`;
    } else if (!fromParam) {
      if (range === 'this_month') {
        // First day of current month: YYYY-MM-01
        fromDateStr = `${todayStr.slice(0, 7)}-01`;
      } else if (range === 'last_30_days') {
        const past30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        fromDateStr = getISTDateString(past30);
      } else if (range === 'all') {
        fromDateStr = null;
        toDateStr = null;
      }
    }

    await connectDB();

    // Match criteria: User specific, non-deleted, and non-failed transactions
    const matchFilter: Record<string, unknown> = {
      userId,
      deletedAt: null,
      parseStatus: { $ne: 'failed' },
    };

    if (fromDateStr && toDateStr) {
      matchFilter.spentOn = { $gte: fromDateStr, $lte: toDateStr };
    } else if (fromDateStr) {
      matchFilter.spentOn = { $gte: fromDateStr };
    } else if (toDateStr) {
      matchFilter.spentOn = { $lte: toDateStr };
    }

    const [aggregationResult] = await Entry.aggregate([
      { $match: matchFilter },
      {
        $facet: {
          // 1. Overall Totals
          totals: [
            {
              $group: {
                _id: null,
                totalExpensePaise: {
                  $sum: {
                    $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0],
                  },
                },
                totalIncomePaise: {
                  $sum: {
                    $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0],
                  },
                },
                totalTransactions: { $sum: 1 },
              },
            },
          ],
          // 2. Spending / Income by Category
          byCategory: [
            {
              $group: {
                _id: {
                  category: '$category',
                  type: '$type',
                },
                totalPaise: { $sum: '$amount' },
                count: { $sum: 1 },
              },
            },
            { $sort: { totalPaise: -1 } },
          ],
          // 3. Daily Breakdown for Charts
          byDay: [
            {
              $group: {
                _id: {
                  spentOn: '$spentOn',
                  type: '$type',
                },
                totalPaise: { $sum: '$amount' },
                count: { $sum: 1 },
              },
            },
            { $sort: { '_id.spentOn': 1 } },
          ],
        },
      },
    ]);

    const rawTotals = aggregationResult?.totals?.[0] || {
      totalExpensePaise: 0,
      totalIncomePaise: 0,
      totalTransactions: 0,
    };

    const netPaise = rawTotals.totalIncomePaise - rawTotals.totalExpensePaise;

    const totals = {
      expense: {
        paise: rawTotals.totalExpensePaise,
        rupees: rawTotals.totalExpensePaise / 100,
      },
      income: {
        paise: rawTotals.totalIncomePaise,
        rupees: rawTotals.totalIncomePaise / 100,
      },
      net: {
        paise: netPaise,
        rupees: netPaise / 100,
      },
      transactionCount: rawTotals.totalTransactions,
    };

    const byCategory = (aggregationResult?.byCategory || []).map(
      (item: { _id: { category: string; type: string }; totalPaise: number; count: number }) => ({
        category: item._id.category,
        type: item._id.type,
        totalPaise: item.totalPaise,
        totalRupees: item.totalPaise / 100,
        count: item.count,
      })
    );

    const byDay = (aggregationResult?.byDay || []).map(
      (item: { _id: { spentOn: string; type: string }; totalPaise: number; count: number }) => ({
        spentOn: item._id.spentOn,
        type: item._id.type,
        totalPaise: item.totalPaise,
        totalRupees: item.totalPaise / 100,
        count: item.count,
      })
    );

    return NextResponse.json({
      success: true,
      range: {
        type: range,
        from: fromDateStr,
        to: toDateStr,
      },
      stats: {
        totals,
        byCategory,
        byDay,
      },
    });
  } catch (error) {
    console.error('Error in GET /api/stats:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

