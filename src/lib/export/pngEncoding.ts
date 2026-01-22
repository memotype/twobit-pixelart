import pako from 'pako';

const PNG_SIGNATURE = new Uint8Array([
  137, 80, 78, 71, 13, 10, 26, 10,
]);

function uint32ToBytes(value: number): Uint8Array {
  return new Uint8Array([
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  ]);
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): Uint8Array {
  let c = 0xffffffff;
  for (const b of bytes) {
    c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  }
  const result = (c ^ 0xffffffff) >>> 0;
  return uint32ToBytes(result);
}

function concatChunks(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

function buildChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  const length = uint32ToBytes(data.length);
  const crc = crc32(concatChunks([typeBytes, data]));
  return concatChunks([length, typeBytes, data, crc]);
}

export function encodePngRgba(
  pixels: Uint8Array,
  width: number,
  height: number,
): Uint8Array {
  const stride = width * 4;
  const raw = new Uint8Array((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0;
    raw.set(
      pixels.subarray(y * stride, y * stride + stride),
      rowStart + 1,
    );
  }
  const compressed = pako.deflate(raw);

  const ihdrData = concatChunks([
    uint32ToBytes(width),
    uint32ToBytes(height),
    new Uint8Array([8, 6, 0, 0, 0]),
  ]);
  const ihdr = buildChunk('IHDR', ihdrData);
  const idat = buildChunk('IDAT', compressed);
  const iend = buildChunk('IEND', new Uint8Array());

  return concatChunks([PNG_SIGNATURE, ihdr, idat, iend]);
}

const BASE64_TABLE =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function toBase64(bytes: Uint8Array): string {
  let output = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const triple = (a << 16) | (b << 8) | c;
    output += BASE64_TABLE[(triple >>> 18) & 63];
    output += BASE64_TABLE[(triple >>> 12) & 63];
    output += i + 1 < bytes.length ? BASE64_TABLE[(triple >>> 6) & 63] : '=';
    output += i + 2 < bytes.length ? BASE64_TABLE[triple & 63] : '=';
  }
  return output;
}
