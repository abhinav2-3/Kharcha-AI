// Test Catmull-Rom to Cubic Bezier spline generator for WaveChart
interface Point {
  x: number;
  y: number;
}

function getSplinePath(points: Point[]): string {
  if (points.length < 2) return '';
  let d = `M ${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }
  return d;
}

console.log('Testing WaveChart spline curve generator...');

const testPoints: Point[] = [
  { x: 30, y: 110 },
  { x: 118, y: 70 },
  { x: 206, y: 130 },
  { x: 294, y: 80 },
  { x: 382, y: 95 },
  { x: 470, y: 50 },
];

const path = getSplinePath(testPoints);
console.log('Generated path:', path);

if (!path.startsWith('M 30.00,110.00')) {
  throw new Error('Path should start at first point');
}
if (!path.includes('C ')) {
  throw new Error('Path should contain cubic bezier commands');
}

console.log('✓ WaveChart spline curve generator passed successfully!');
