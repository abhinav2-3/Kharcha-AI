import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

/**
 * Generates an SVG icon with deep brand gradient, squircle container,
 * and the iconic Kharcha Indian Rupee '₹' / 'K' growth emblem.
 */
function generateSvg(size = 512, isMaskable = false): string {
  const padding = isMaskable ? 80 : 36;
  const innerSize = size - padding * 2;
  const radius = isMaskable ? 0 : size * 0.22; // Maskable uses full bleed background

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#242b66" />
      <stop offset="50%" stop-color="#1a1f4b" />
      <stop offset="100%" stop-color="#0e112c" />
    </linearGradient>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffe27a" />
      <stop offset="50%" stop-color="#ffb400" />
      <stop offset="100%" stop-color="#e09000" />
    </linearGradient>
    <linearGradient id="greenGrad" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#3dbe3d" />
      <stop offset="100%" stop-color="#8be79b" />
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="125%" height="125%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.38" />
    </filter>
  </defs>

  <!-- Background container -->
  <rect width="${size}" height="${size}" rx="${radius}" fill="url(#bgGrad)" />

  <!-- Subtle inner rim light -->
  <rect x="2" y="2" width="${size - 4}" height="${size - 4}" rx="${radius}" fill="none" stroke="#ffffff" stroke-opacity="0.08" stroke-width="3" />

  <!-- Center Emblem (₹ + upward growth notch) -->
  <g filter="url(#shadow)" transform="translate(${size / 2}, ${size / 2}) scale(${innerSize / 360})">
    <!-- Rupee top bar 1 -->
    <rect x="-95" y="-120" width="190" height="26" rx="13" fill="url(#goldGrad)" />
    
    <!-- Rupee top bar 2 -->
    <rect x="-95" y="-72" width="135" height="24" rx="12" fill="url(#goldGrad)" />

    <!-- Rupee head curve + stem -->
    <path d="M -50 -120 L -50 15 C -20 15 15 10 38 -15 C 60 -40 60 -80 30 -105 C 10 -120 -20 -120 -50 -120 Z" fill="none" stroke="url(#goldGrad)" stroke-width="26" stroke-linecap="round" stroke-linejoin="round" />

    <!-- Upward Growth Arrow / Diagonal Leg -->
    <path d="M -25 -5 L 68 118" stroke="url(#greenGrad)" stroke-width="28" stroke-linecap="round" />

    <!-- Financial Success Sparkle Dot -->
    <circle cx="84" cy="-90" r="14" fill="#8be79b" />
    <path d="M 84 -112 L 84 -68 M 62 -90 L 106 -90" stroke="#8be79b" stroke-width="4.5" stroke-linecap="round" />
  </g>
</svg>`;
}

/**
 * Native, zero-dependency pure PNG writer using Node.js zlib.
 * Generates an uncompressed or deflate-compressed 32-bit RGBA PNG buffer.
 */
function createRawPng(
  width: number,
  height: number,
  pixelFn: (x: number, y: number) => [number, number, number, number]
): Buffer {
  // 1. Generate uncompressed scanline data: [filterByte (0x00), R, G, B, A, ...]
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(rowSize * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter byte 0 (None)
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixelFn(x, y);
      const pxOffset = rowOffset + 1 + x * 4;
      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  // 2. Deflate compress scanlines
  const compressed = zlib.deflateSync(rawData);

  // 3. CRC32 calculation table
  const crcTable: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    crcTable[n] = c;
  }

  function crc32(buf: Buffer): number {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  function makeChunk(typeStr: string, data: Buffer): Buffer {
    const typeBuf = Buffer.from(typeStr, 'ascii');
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(data.length, 0);

    const crcBuf = Buffer.alloc(4);
    const combined = Buffer.concat([typeBuf, data]);
    crcBuf.writeUInt32BE(crc32(combined), 0);

    return Buffer.concat([lenBuf, combined, crcBuf]);
  }

  // PNG Header
  const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR Chunk: width, height, bitdepth=8, colortype=6 (RGBA), comp=0, filter=0, interlace=0
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6;
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdrChunk = makeChunk('IHDR', ihdrData);

  // IDAT Chunk
  const idatChunk = makeChunk('IDAT', compressed);

  // IEND Chunk
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([header, ihdrChunk, idatChunk, iendChunk]);
}

/**
 * Mathematical rendering engine for the Kharcha App Icon.
 * Renders anti-aliased squircle, gradient, and the golden Indian Rupee '₹' glyph.
 */
function renderKharchaIcon(width: number, height: number, isMaskable = false): Buffer {
  return createRawPng(width, height, (x, y) => {
    const cx = width / 2;
    const cy = height / 2;
    const scale = width / 512;

    // Relative coordinates [-1, 1]
    const u = (x - cx) / cx;
    const v = (y - cy) / cy;

    // Corner squircle distance formula: |u|^4.5 + |v|^4.5
    const squircleDist = Math.pow(Math.abs(u), 4.5) + Math.pow(Math.abs(v), 4.5);

    if (!isMaskable && squircleDist > 1.05) {
      // Transparent outside rounded squircle boundary for standard launcher & Apple touch icon
      return [0, 0, 0, 0];
    }

    // Background gradient: from rich midnight indigo (#242b66) to deep ink (#0d102b)
    const t = (u + v + 2) / 4; // [0, 1]
    let bgR = Math.round(36 * (1 - t) + 14 * t);
    let bgG = Math.round(43 * (1 - t) + 17 * t);
    let bgB = Math.round(102 * (1 - t) + 44 * t);

    // Inner glow near top-left
    const lightDist = Math.hypot(u + 0.5, v + 0.5);
    if (lightDist < 1.0) {
      const glow = (1 - lightDist) * 35;
      bgR = Math.min(255, bgR + glow);
      bgG = Math.min(255, bgG + glow);
      bgB = Math.min(255, bgB + glow * 1.2);
    }

    // Now check if pixel is inside the emblem
    // Safe scaling for maskable vs standard
    const glyphScale = (isMaskable ? 0.72 : 0.88) * scale;
    const gx = (x - cx) / glyphScale;
    const gy = (y - cy) / glyphScale;

    let isEmblem = false;
    let isGreen = false;

    // 1. Top bar 1: x in [-95, 95], y in [-120, -96]
    if (gx >= -95 && gx <= 95 && gy >= -120 && gy <= -96) {
      isEmblem = true;
    }
    // Top bar 1 rounded pill caps
    if (gy >= -120 && gy <= -96) {
      if (Math.hypot(gx - -95, gy - -108) <= 12 || Math.hypot(gx - 95, gy - -108) <= 12) {
        isEmblem = true;
      }
    }

    // 2. Top bar 2: x in [-95, 45], y in [-72, -50]
    if (gx >= -95 && gx <= 45 && gy >= -72 && gy <= -50) {
      isEmblem = true;
    }
    if (gy >= -72 && gy <= -50) {
      if (Math.hypot(gx - -95, gy - -61) <= 11 || Math.hypot(gx - 45, gy - -61) <= 11) {
        isEmblem = true;
      }
    }

    // 3. Vertical stem: x in [-50, -26], y in [-120, 20]
    if (gx >= -50 && gx <= -26 && gy >= -120 && gy <= 20) {
      isEmblem = true;
    }

    // 4. Curved loop of Rupee: center around (-10, -45), radius ~45, thickness ~24
    const loopDist = Math.hypot(gx - -10, gy - -48);
    if (gx >= -26 && loopDist >= 30 && loopDist <= 56 && gy <= 10) {
      isEmblem = true;
    }

    // 5. Diagonal leg / growth arrow: line from (-20, 0) to (70, 115)
    // Distance from point to line segment
    const px1 = -20, py1 = 0, px2 = 68, py2 = 116;
    const l2 = (px2 - px1) * (px2 - px1) + (py2 - py1) * (py2 - py1);
    const proj = Math.max(0, Math.min(1, ((gx - px1) * (px2 - px1) + (gy - py1) * (py2 - py1)) / l2));
    const nearX = px1 + proj * (px2 - px1);
    const nearY = py1 + proj * (py2 - py1);
    const legDist = Math.hypot(gx - nearX, gy - nearY);
    if (legDist <= 14) {
      isEmblem = true;
      isGreen = true;
    }

    // 6. Growth sparkle dot at (82, -92)
    const sparkleDist = Math.hypot(gx - 82, gy - -92);
    if (sparkleDist <= 13) {
      isEmblem = true;
      isGreen = true;
    }

    if (isEmblem) {
      if (isGreen) {
        // Vibrant emerald growth accent (#8be79b)
        return [139, 231, 155, 255];
      }
      // Radiant warm gold gradient (#ffe066 -> #ffb400)
      const gyNorm = (gy + 120) / 240;
      const goldR = Math.round(255);
      const goldG = Math.round(224 * (1 - gyNorm) + 180 * gyNorm);
      const goldB = Math.round(102 * (1 - gyNorm) + 0 * gyNorm);
      return [goldR, goldG, goldB, 255];
    }

    // Subtle edge anti-aliasing
    let alpha = 255;
    if (!isMaskable && squircleDist > 0.98) {
      alpha = Math.round(Math.max(0, Math.min(255, (1.05 - squircleDist) * 3600)));
    }

    return [bgR, bgG, bgB, alpha];
  });
}

function runIconGeneration() {
  const iconsDir = path.join(process.cwd(), 'public', 'icons');
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }

  console.log('Generating Kharcha PWA App Icons...');

  // 1. Vector SVG
  const svgContent = generateSvg(512);
  fs.writeFileSync(path.join(iconsDir, 'icon.svg'), svgContent, 'utf8');
  console.log('✓ public/icons/icon.svg generated');

  // 2. Standard 192x192 PNG (Android standard)
  const png192 = renderKharchaIcon(192, 192, false);
  fs.writeFileSync(path.join(iconsDir, 'icon-192.png'), png192);
  console.log('✓ public/icons/icon-192.png generated (192x192)');

  // 3. High-Res 512x512 PNG (Android splash screen & app switcher)
  const png512 = renderKharchaIcon(512, 512, false);
  fs.writeFileSync(path.join(iconsDir, 'icon-512.png'), png512);
  console.log('✓ public/icons/icon-512.png generated (512x512)');

  // 4. Android Maskable 512x512 PNG (Adaptive rounded/squircle Android icons)
  const pngMaskable = renderKharchaIcon(512, 512, true);
  fs.writeFileSync(path.join(iconsDir, 'icon-maskable.png'), pngMaskable);
  console.log('✓ public/icons/icon-maskable.png generated (512x512 maskable)');

  // 5. Apple Touch Icon 180x180 PNG (iPhone & iPad Safari home screen)
  const pngApple = renderKharchaIcon(180, 180, false);
  fs.writeFileSync(path.join(iconsDir, 'apple-touch-icon.png'), pngApple);
  console.log('✓ public/icons/apple-touch-icon.png generated (180x180 iOS)');

  // 6. Favicon PNG (32x32)
  const pngFavicon = renderKharchaIcon(32, 32, false);
  fs.writeFileSync(path.join(process.cwd(), 'public', 'favicon.ico'), pngFavicon);
  console.log('✓ public/favicon.ico generated (32x32)');

  console.log('\nAll PWA icons generated successfully!');
}

runIconGeneration();

