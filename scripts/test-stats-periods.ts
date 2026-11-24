import { byWeek, byMonth, byQuarter, getTrajectoryData } from '../lib/stats';
import type { Entry } from '../lib/types';

function createMockEntry(spentOn: string, amountPaise: number, type: 'expense' | 'income' = 'expense'): Entry {
  return {
    clientId: 'test-' + Math.random().toString(36).slice(2),
    rawText: 'test expense',
    amount: amountPaise,
    category: 'food',
    mode: 'upi',
    type,
    notes: 'test',
    spentOn,
    spentAt: `${spentOn}T12:00:00Z`,
    sync: 'synced',
    parseStatus: 'saved',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

console.log('Testing Period Aggregations in lib/stats.ts...');

// 1. Test byWeek
{
  const refDate = '2026-11-22'; // Sunday
  // Week Mon 16 to Sun 22 Nov 2026
  const entries: Entry[] = [
    createMockEntry('2026-11-16', 50000), // Mon: 500
    createMockEntry('2026-11-18', 25000), // Wed: 250
    createMockEntry('2026-11-22', 100000), // Sun: 1000
    createMockEntry('2026-11-23', 80000), // Next Mon: outside week
  ];

  const week = byWeek(entries, refDate);
  if (week.length !== 7) throw new Error(`Expected 7 days for week, got ${week.length}`);
  if (week[0].amount !== 500) throw new Error(`Expected Mon to be 500, got ${week[0].amount}`);
  if (week[2].amount !== 250) throw new Error(`Expected Wed to be 250, got ${week[2].amount}`);
  if (week[6].amount !== 1000) throw new Error(`Expected Sun to be 1000, got ${week[6].amount}`);
  console.log('✓ byWeek passed (7 days correctly sliced and summed)');
}

// 2. Test byMonth
{
  const month = '2026-11';
  const entries: Entry[] = [
    createMockEntry('2026-11-01', 10000), // 100
    createMockEntry('2026-11-05', 45000), // 450
    createMockEntry('2026-11-30', 30000), // 300
    createMockEntry('2026-10-31', 99000), // Oct: outside
  ];

  const monthData = byMonth(entries, month);
  if (monthData.length !== 30) throw new Error(`Expected 30 days for Nov, got ${monthData.length}`);
  if (monthData[0].amount !== 100) throw new Error(`Expected Day 1 to be 100, got ${monthData[0].amount}`);
  if (monthData[4].amount !== 450) throw new Error(`Expected Day 5 to be 450, got ${monthData[4].amount}`);
  if (monthData[29].amount !== 300) throw new Error(`Expected Day 30 to be 300, got ${monthData[29].amount}`);
  console.log('✓ byMonth passed (30 days accurately summed)');
}

// 3. Test byQuarter
{
  const month = '2026-11'; // Q4 2026: Oct (10), Nov (11), Dec (12)
  const entries: Entry[] = [
    createMockEntry('2026-10-15', 120000), // Oct: 1200
    createMockEntry('2026-11-05', 80000),  // Nov: 800
    createMockEntry('2026-11-20', 20000),  // Nov: 200 -> Nov total 1000
    createMockEntry('2026-12-01', 50000),  // Dec: 500
    createMockEntry('2026-09-30', 90000),  // Sep (Q3): outside
  ];

  const quarter = byQuarter(entries, month);
  if (quarter.length !== 3) throw new Error(`Expected 3 months in quarter, got ${quarter.length}`);
  if (quarter[0].label !== 'Oct' || quarter[0].amount !== 1200) {
    throw new Error(`Expected Oct: 1200, got ${quarter[0].label}: ${quarter[0].amount}`);
  }
  if (quarter[1].label !== 'Nov' || quarter[1].amount !== 1000) {
    throw new Error(`Expected Nov: 1000, got ${quarter[1].label}: ${quarter[1].amount}`);
  }
  if (quarter[2].label !== 'Dec' || quarter[2].amount !== 500) {
    throw new Error(`Expected Dec: 500, got ${quarter[2].label}: ${quarter[2].amount}`);
  }
  console.log('✓ byQuarter passed (Oct, Nov, Dec accurately grouped and summed)');
}

// 4. Test getTrajectoryData across all 5 periods
{
  const month = '2026-11';
  const entries: Entry[] = [
    createMockEntry('2026-11-05', 50000), // 500 in wk 1 (days 1-7)
    createMockEntry('2026-11-12', 30000), // 300 in wk 2 (days 8-14)
    createMockEntry('2026-05-10', 40000), // 400 in May
  ];

  const trajWeek = getTrajectoryData(entries, 'week', month);
  if (trajWeek.length !== 7) throw new Error(`Expected 7 days for traj week, got ${trajWeek.length}`);

  const trajMonth = getTrajectoryData(entries, 'month', month);
  if (trajMonth.length !== 4) throw new Error(`Expected 4 weeks for traj month, got ${trajMonth.length}`);
  if (trajMonth[0].amount !== 500) throw new Error(`Expected wk 1 to be 500, got ${trajMonth[0].amount}`);
  if (trajMonth[1].amount !== 300) throw new Error(`Expected wk 2 to be 300, got ${trajMonth[1].amount}`);

  const trajQuarter = getTrajectoryData(entries, 'quarter', month);
  if (trajQuarter.length !== 3) throw new Error(`Expected 3 months for traj quarter, got ${trajQuarter.length}`);

  const trajHalfYear = getTrajectoryData(entries, 'half_year', month);
  if (trajHalfYear.length !== 6) throw new Error(`Expected 6 months for traj half year, got ${trajHalfYear.length}`);

  const trajFullYear = getTrajectoryData(entries, 'full_year', month);
  if (trajFullYear.length !== 12) throw new Error(`Expected 12 months for traj full year, got ${trajFullYear.length}`);

  console.log('✓ getTrajectoryData passed for all 5 periods (week, month, quarter, half_year, full_year)');
}

console.log('All period aggregation tests passed successfully!');
