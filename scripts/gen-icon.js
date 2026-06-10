// Generates assets/icon.default.png (32x32 RGBA) with no external deps — the
// built-in fallback glyph. The app prefers your own assets/icon.png if present
// (see src/platform/electron/icon.js), so this never overwrites a custom icon.
// A simple rounded speech-bubble glyph in the accent colour.
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const SIZE = 256; // ≥256 so it doubles as the Windows build icon
const ACCENT = [108, 92, 231]; // #6C5CE7
const WHITE = [255, 255, 255];

function crc32(buf) {
  let crc = ~0;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (~crc) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

// Build raw RGBA pixels.
const raw = Buffer.alloc(SIZE * (1 + SIZE * 4));
function setPixel(x, y, [r, g, b], a) {
  const rowStart = y * (1 + SIZE * 4);
  const off = rowStart + 1 + x * 4;
  raw[off] = r; raw[off + 1] = g; raw[off + 2] = b; raw[off + 3] = a;
}

// Rounded square bubble with a little tail. Geometry is expressed against the
// original 32px design and scaled, so it stays crisp at any SIZE.
const S = SIZE / 32;
const cx = 16 * S, cy = 14 * S, r = 11 * S, radius2 = r * r;
const dotR2 = (2 * S) * (2 * S);
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    setPixel(x, y, [0, 0, 0], 0); // transparent default

    // bubble body (rounded square approximated by circle)
    const dx = x - cx, dy = y - cy;
    const inBubble = dx * dx + dy * dy <= radius2;
    // little tail at bottom-left
    const inTail = y >= cy + 6 * S && y <= cy + 11 * S && x >= 9 * S && x <= 9 * S + (cy + 11 * S - y);

    if (inBubble || inTail) setPixel(x, y, ACCENT, 255);

    // three "dots" suggesting speech
    if (inBubble) {
      for (const ox of [-6 * S, 0, 6 * S]) {
        const ddx = x - (cx + ox), ddy = y - cy;
        if (ddx * ddx + ddy * ddy <= dotR2) setPixel(x, y, WHITE, 255);
      }
    }
  }
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), // signature
  chunk('IHDR', (() => {
    const b = Buffer.alloc(13);
    b.writeUInt32BE(SIZE, 0);
    b.writeUInt32BE(SIZE, 4);
    b[8] = 8;  // bit depth
    b[9] = 6;  // colour type RGBA
    b[10] = 0; b[11] = 0; b[12] = 0;
    return b;
  })()),
  chunk('IDAT', zlib.deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0)),
]);

const outDir = path.join(__dirname, '..', 'assets');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'icon.default.png'), png);
console.log('Wrote assets/icon.default.png (%d bytes)', png.length);
console.log('Tip: drop your own square PNG at assets/icon.png to override it.');
