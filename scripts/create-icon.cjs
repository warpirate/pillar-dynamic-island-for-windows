// Creates a minimal valid 16x16 32bpp ICO file for Tauri
const fs = require('fs');
const path = require('path');

const outPath = path.join(__dirname, '..', 'src-tauri', 'icons', 'icon.ico');
const dir = path.dirname(outPath);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

// ICO: 6-byte header + 16-byte entry + 40-byte BITMAPINFOHEADER + 1024 (16*16*4) + 32 (AND mask)
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);   // reserved
header.writeUInt16LE(1, 2);   // type 1 = ICO
header.writeUInt16LE(1, 4);   // count

const bitmapSize = 40 + 1024 + 32;  // 1096
const entry = Buffer.alloc(16);
entry[0] = 16; entry[1] = 16;       // width, height
entry[2] = 0; entry[3] = 0;          // colors, reserved
entry.writeUInt16LE(1, 4);           // planes
entry.writeUInt16LE(32, 6);         // bpp
entry.writeUInt32LE(bitmapSize, 8);
entry.writeUInt32LE(22, 12);        // offset to bitmap

const dib = Buffer.alloc(40);
dib.writeUInt32LE(40, 0);           // header size
dib.writeInt32LE(16, 4);            // width
dib.writeInt32LE(32, 8);            // height (16*2 for image+mask)
dib.writeUInt16LE(1, 12);           // planes
dib.writeUInt16LE(32, 14);         // bpp
dib.writeUInt32LE(0, 16);           // compression
dib.writeUInt32LE(1056, 20);        // image size
dib.writeInt32LE(0, 24);            // rest zeros

const xorMask = Buffer.alloc(1024);  // 16*16*4 - semi-transparent dark
xorMask.fill(0x1a);
for (let i = 3; i < 1024; i += 4) xorMask[i] = 0xe0;  // alpha

const andMask = Buffer.alloc(32);
andMask.fill(0);

const ico = Buffer.concat([header, entry, dib, xorMask, andMask]);
fs.writeFileSync(outPath, ico);
console.log('Created', outPath);
