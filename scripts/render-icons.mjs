#!/usr/bin/env node
/** Generate checked-in placeholder icons without adding image dependencies. */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function solidPng(size, [r, g, b, a = 255]) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const row = Buffer.alloc(1 + size * 4);
  row[0] = 0; // filter: None
  for (let i = 0; i < size; i++) {
    const off = 1 + i * 4;
    row[off] = r;
    row[off + 1] = g;
    row[off + 2] = b;
    row[off + 3] = a;
  }
  const raw = Buffer.concat(Array.from({ length: size }, () => row));
  const idat = deflateSync(raw);

  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const SIZES = [16, 32, 48, 128];
const VARIANTS = [
  { name: 'active', color: [0xc2, 0x41, 0x0c] },
  { name: 'inactive', color: [0xb5, 0xb2, 0xa8] },
];

for (const { name, color } of VARIANTS) {
  for (const size of SIZES) {
    const png = solidPng(size, color);
    const file = join(outDir, `${name}-${size}.png`);
    writeFileSync(file, png);
    console.log(`wrote ${file} (${png.length} bytes)`);
  }
}
