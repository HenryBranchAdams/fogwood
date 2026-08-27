/**
 * Device-local, browser-safe material preparation for Fogwood proposals.
 *
 * This module accepts one representation only: canonical RFC 4648 base64
 * carried inline in a bounded proposal. It deliberately has no DOM, network,
 * Blob, URL, image element, or tldraw dependency. Raster browser decoding is
 * an injected asynchronous qualification step owned by the page adapter.
 */

export const SUPPORTED_MATERIAL_MIME_TYPES = Object.freeze([
  'image/png',
  'image/jpeg',
  'image/svg+xml',
] as const);

export const MATERIAL_LIMITS = Object.freeze({
  max_materials_per_action: 4,
  max_raster_bytes: 4 * 1024 * 1024,
  max_svg_bytes: 1 * 1024 * 1024,
  max_aggregate_bytes: 12 * 1024 * 1024,
  max_dimension: 8192,
  max_pixels: 16_000_000,
});

export const SVG_LIMITS = Object.freeze({
  max_elements: 256,
  max_depth: 16,
  max_attributes_per_element: 32,
  max_path_length: 20_000,
  max_path_tokens: 4096,
  max_points: 4096,
});

export const MATERIAL_TEXT_LIMITS = Object.freeze({
  semantic_id: 180,
  label: 180,
  alt: 240,
  prompt_summary: 500,
  originating_capability: 180,
  qualification_boundary: 500,
});

export type SupportedMaterialMimeType = (typeof SUPPORTED_MATERIAL_MIME_TYPES)[number];
export type MaterialSourceStatus = 'original' | 'sanitized';

export type MaterialInput = {
  semantic_id: string;
  mime_type: SupportedMaterialMimeType;
  base64: string;
  label?: string;
  alt?: string;
  prompt_summary?: string;
  originating_capability?: string;
  qualification_boundary?: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type MaterialDecodeRequest = Readonly<{
  mime_type: SupportedMaterialMimeType;
  bytes: Uint8Array;
  width: number;
  height: number;
}>;

export type MaterialDecodeResult = Readonly<{ width: number; height: number }>;
export type MaterialDecoder = (request: MaterialDecodeRequest) => Promise<MaterialDecodeResult> | MaterialDecodeResult;

export type PreparedMaterial = Readonly<{
  semantic_id: string;
  mime_type: SupportedMaterialMimeType;
  /** Canonical inline base64 for the exact accepted bytes. */
  base64: string;
  /** Explicit alias useful to adapters; always identical to base64. */
  canonical_base64: string;
  content_hash: string;
  byte_length: number;
  source_status: MaterialSourceStatus;
  dimensions: Readonly<{ width: number; height: number }>;
  width: number;
  height: number;
  decode_qualified: true;
  label: string;
  alt: string;
  prompt_summary: string;
  originating_capability: string;
  qualification_boundary: string;
  x: number;
  y: number;
  w: number;
  h: number;
}>;

export type MaterialValidationError = {
  code: string;
  message: string;
  path?: string;
};

export type MaterialPreparationResult =
  | { ok: true; material: PreparedMaterial }
  | { ok: false; errors: MaterialValidationError[] };

export type MaterialBatchResult =
  | { ok: true; materials: readonly PreparedMaterial[]; byte_length: number }
  | { ok: false; errors: MaterialValidationError[] };

export type MaterialPreparationOptions = Readonly<{
  decodeRaster?: MaterialDecoder;
}>;

const preparedMaterials = new WeakSet<object>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return false;
    return Object.keys(value).every((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      return Boolean(descriptor && 'value' in descriptor);
    });
  } catch {
    return false;
  }
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]) {
  const keys = new Set(allowed);
  return Object.keys(value).every((key) => keys.has(key));
}

function error(code: string, message: string, path?: string): MaterialValidationError {
  return { code, message, ...(path === undefined ? {} : { path }) };
}

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function boundedText(value: unknown, max: number, path: string, errors: MaterialValidationError[]) {
  if (value === undefined) return '';
  if (typeof value !== 'string' || value.length > max) {
    errors.push(error('INVALID_TEXT', `${path} must be a string of at most ${max} characters.`, path));
    return '';
  }
  return value;
}

function utf8Bytes(value: string) {
  const bytes: number[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const first = value.charCodeAt(index);
    let codePoint = first;
    if (first >= 0xd800 && first <= 0xdbff) {
      const second = index + 1 < value.length ? value.charCodeAt(index + 1) : 0;
      if (second >= 0xdc00 && second <= 0xdfff) {
        codePoint = 0x10000 + ((first - 0xd800) << 10) + second - 0xdc00;
        index += 1;
      } else {
        codePoint = 0xfffd;
      }
    } else if (first >= 0xdc00 && first <= 0xdfff) {
      codePoint = 0xfffd;
    }
    if (codePoint <= 0x7f) bytes.push(codePoint);
    else if (codePoint <= 0x7ff) bytes.push(0xc0 | (codePoint >>> 6), 0x80 | (codePoint & 0x3f));
    else if (codePoint <= 0xffff) bytes.push(0xe0 | (codePoint >>> 12), 0x80 | ((codePoint >>> 6) & 0x3f), 0x80 | (codePoint & 0x3f));
    else bytes.push(0xf0 | (codePoint >>> 18), 0x80 | ((codePoint >>> 12) & 0x3f), 0x80 | ((codePoint >>> 6) & 0x3f), 0x80 | (codePoint & 0x3f));
  }
  return new Uint8Array(bytes);
}

function hexWord(value: number) {
  return (value >>> 0).toString(16).padStart(8, '0');
}

const SHA_ROUND_CONSTANTS = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7,
  0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa,
  0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354,
  0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
  0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c,
  0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f,
  0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
] as const;

const SHA_INITIAL = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
  0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
] as const;

function rotateRight(value: number, amount: number) {
  return (value >>> amount) | (value << (32 - amount));
}

/** Exact SHA-256 over accepted bytes, returned in the receipt/hash spelling. */
export function sha256Bytes(input: Uint8Array) {
  const bitLength = input.length * 8;
  const blockCount = Math.ceil((input.length + 9) / 64);
  const padded = new Uint8Array(blockCount * 64);
  padded.set(input);
  padded[input.length] = 0x80;
  const lowLength = bitLength >>> 0;
  const highLength = Math.floor(bitLength / 0x1_0000_0000) >>> 0;
  const lengthOffset = padded.length - 8;
  padded[lengthOffset] = highLength >>> 24;
  padded[lengthOffset + 1] = highLength >>> 16;
  padded[lengthOffset + 2] = highLength >>> 8;
  padded[lengthOffset + 3] = highLength;
  padded[lengthOffset + 4] = lowLength >>> 24;
  padded[lengthOffset + 5] = lowLength >>> 16;
  padded[lengthOffset + 6] = lowLength >>> 8;
  padded[lengthOffset + 7] = lowLength;

  const hash: number[] = [...SHA_INITIAL];
  const schedule = new Uint32Array(64);
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      const position = offset + index * 4;
      schedule[index] = ((padded[position] << 24) | (padded[position + 1] << 16) | (padded[position + 2] << 8) | padded[position + 3]) >>> 0;
    }
    for (let index = 16; index < 64; index += 1) {
      const s0 = rotateRight(schedule[index - 15], 7) ^ rotateRight(schedule[index - 15], 18) ^ (schedule[index - 15] >>> 3);
      const s1 = rotateRight(schedule[index - 2], 17) ^ rotateRight(schedule[index - 2], 19) ^ (schedule[index - 2] >>> 10);
      schedule[index] = (s1 + schedule[index - 7] + s0 + schedule[index - 16]) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = hash;
    for (let index = 0; index < 64; index += 1) {
      const sigma1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temporary1 = (h + sigma1 + choice + SHA_ROUND_CONSTANTS[index] + schedule[index]) >>> 0;
      const sigma0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temporary2 = (sigma0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temporary1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temporary1 + temporary2) >>> 0;
    }
    hash[0] = (hash[0] + a) >>> 0;
    hash[1] = (hash[1] + b) >>> 0;
    hash[2] = (hash[2] + c) >>> 0;
    hash[3] = (hash[3] + d) >>> 0;
    hash[4] = (hash[4] + e) >>> 0;
    hash[5] = (hash[5] + f) >>> 0;
    hash[6] = (hash[6] + g) >>> 0;
    hash[7] = (hash[7] + h) >>> 0;
  }
  return `sha256:${hash.map(hexWord).join('')}`;
}

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function encodeBase64(bytes: Uint8Array) {
  let output = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    output += BASE64_ALPHABET[first >>> 2];
    output += BASE64_ALPHABET[((first & 3) << 4) | ((second ?? 0) >>> 4)];
    output += second === undefined ? '=' : BASE64_ALPHABET[((second & 15) << 2) | ((third ?? 0) >>> 6)];
    output += third === undefined ? '=' : BASE64_ALPHABET[third & 63];
  }
  return output;
}

function decodeBase64(value: unknown, maxBytes: number): { bytes?: Uint8Array; errors: MaterialValidationError[] } {
  if (typeof value !== 'string') return { errors: [error('INVALID_BASE64', 'base64 must be a canonical RFC 4648 string.', 'base64')] };
  const maxEncodedLength = Math.ceil(maxBytes / 3) * 4;
  if (value.length > maxEncodedLength) return { errors: [error('MATERIAL_SIZE_LIMIT', `Decoded material bytes must be at most ${maxBytes} bytes.`, 'base64')] };
  if (value.length === 0 || value.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(value)) {
    return { errors: [error('INVALID_BASE64', 'base64 must contain canonical alphabet, padding, and no whitespace.', 'base64')] };
  }
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  const byteLength = value.length / 4 * 3 - padding;
  if (byteLength < 1 || byteLength > maxBytes) return { errors: [error('MATERIAL_SIZE_LIMIT', `Decoded material bytes must be at most ${maxBytes} bytes.`, 'base64')] };
  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (let index = 0; index < value.length; index += 4) {
    const a = BASE64_ALPHABET.indexOf(value[index] ?? '');
    const b = BASE64_ALPHABET.indexOf(value[index + 1] ?? '');
    const c = value[index + 2] === '=' ? 0 : BASE64_ALPHABET.indexOf(value[index + 2] ?? '');
    const d = value[index + 3] === '=' ? 0 : BASE64_ALPHABET.indexOf(value[index + 3] ?? '');
    const first = (a << 2) | (b >>> 4);
    const second = ((b & 15) << 4) | (c >>> 2);
    const third = ((c & 3) << 6) | d;
    if (offset < byteLength) bytes[offset++] = first;
    if (offset < byteLength) bytes[offset++] = second;
    if (offset < byteLength) bytes[offset++] = third;
  }
  if (encodeBase64(bytes) !== value) return { errors: [error('INVALID_BASE64', 'base64 must round-trip to its canonical padded spelling.', 'base64')] };
  return { bytes, errors: [] };
}

function readUint32(bytes: Uint8Array, offset: number) {
  return (((bytes[offset] ?? 0) << 24) | ((bytes[offset + 1] ?? 0) << 16) | ((bytes[offset + 2] ?? 0) << 8) | (bytes[offset + 3] ?? 0)) >>> 0;
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngDimensions(bytes: Uint8Array): { width: number; height: number } | MaterialValidationError {
  if (bytes.length < 33 || ![137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)) return error('RASTER_SIGNATURE', 'PNG bytes do not have the PNG signature.');
  let offset = 8;
  let sawHeader = false;
  let sawData = false;
  let sawEnd = false;
  let width = 0;
  let height = 0;
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) return error('RASTER_MALFORMED', 'PNG chunk header is truncated.');
    const length = readUint32(bytes, offset);
    const typeOffset = offset + 4;
    const dataOffset = offset + 8;
    const end = dataOffset + length;
    const crcOffset = end;
    if (end < dataOffset || crcOffset + 4 > bytes.length) return error('RASTER_MALFORMED', 'PNG chunk length exceeds the supplied bytes.');
    const typeBytes = bytes.slice(typeOffset, dataOffset);
    const type = String.fromCharCode(...typeBytes);
    if (!/^[A-Za-z]{4}$/u.test(type)) return error('RASTER_MALFORMED', 'PNG chunk type is invalid.');
    const expectedCrc = readUint32(bytes, crcOffset);
    const actualCrc = crc32(bytes.slice(typeOffset, end));
    if (expectedCrc !== actualCrc) return error('RASTER_MALFORMED', 'PNG chunk CRC does not match.');
    if (!sawHeader && type !== 'IHDR') return error('RASTER_MALFORMED', 'PNG must begin with one IHDR chunk.');
    if (type === 'IHDR') {
      if (sawHeader || length !== 13) return error('RASTER_MALFORMED', 'PNG must contain one 13-byte IHDR chunk.');
      sawHeader = true;
      width = readUint32(bytes, dataOffset);
      height = readUint32(bytes, dataOffset + 4);
      const bitDepth = bytes[dataOffset + 8];
      const colorType = bytes[dataOffset + 9];
      const compression = bytes[dataOffset + 10];
      const filter = bytes[dataOffset + 11];
      const interlace = bytes[dataOffset + 12];
      const validDepth = colorType === 0 ? [1, 2, 4, 8, 16].includes(bitDepth ?? 0)
        : colorType === 2 ? [8, 16].includes(bitDepth ?? 0)
          : colorType === 3 ? [1, 2, 4, 8].includes(bitDepth ?? 0)
            : colorType === 4 || colorType === 6 ? [8, 16].includes(bitDepth ?? 0) : false;
      if (!validDepth || compression !== 0 || filter !== 0 || (interlace !== 0 && interlace !== 1)) return error('RASTER_UNSUPPORTED', 'PNG color, compression, filter, or interlace mode is unsupported.');
    } else if (type === 'acTL' || type === 'fcTL' || type === 'fdAT') {
      return error('RASTER_ANIMATED', 'Animated PNG content is refused.');
    } else if (type === 'IDAT') {
      sawData = true;
    } else if (type === 'IEND') {
      if (length !== 0 || sawEnd) return error('RASTER_MALFORMED', 'PNG IEND must be empty and unique.');
      sawEnd = true;
      if (crcOffset + 4 !== bytes.length) return error('RASTER_MALFORMED', 'PNG has trailing bytes after IEND.');
    }
    offset = crcOffset + 4;
    if (sawEnd) break;
  }
  if (!sawHeader || !sawData || !sawEnd || width < 1 || height < 1) return error('RASTER_MALFORMED', 'PNG is missing a required header, data, or end chunk.');
  return { width, height };
}

const JPEG_SOF_MARKERS = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

function jpegDimensions(bytes: Uint8Array): { width: number; height: number } | MaterialValidationError {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return error('RASTER_SIGNATURE', 'JPEG bytes do not have the JPEG SOI marker.');
  let offset = 2;
  let foundSof = false;
  let foundSos = false;
  let foundEoi = false;
  let width = 0;
  let height = 0;
  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) return error('RASTER_MALFORMED', 'JPEG marker prefix is invalid.');
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) return error('RASTER_MALFORMED', 'JPEG marker is truncated.');
    const marker = bytes[offset++];
    if (marker === 0xd9) {
      foundEoi = true;
      if (offset !== bytes.length) return error('RASTER_MALFORMED', 'JPEG has trailing bytes after EOI.');
      break;
    }
    if (marker === 0xda) {
      foundSos = true;
      if (offset + 2 > bytes.length) return error('RASTER_MALFORMED', 'JPEG scan header is truncated.');
      const segmentLength = (bytes[offset] << 8) | bytes[offset + 1];
      if (segmentLength < 2 || offset + segmentLength > bytes.length) return error('RASTER_MALFORMED', 'JPEG scan segment length is invalid.');
      offset += segmentLength;
      let scanEnd = false;
      while (offset < bytes.length) {
        if (bytes[offset] !== 0xff) {
          offset += 1;
          continue;
        }
        let markerOffset = offset;
        while (markerOffset < bytes.length && bytes[markerOffset] === 0xff) markerOffset += 1;
        if (markerOffset >= bytes.length) return error('RASTER_MALFORMED', 'JPEG scan ends with a truncated marker.');
        const scanMarker = bytes[markerOffset];
        if (scanMarker === 0x00 || (scanMarker >= 0xd0 && scanMarker <= 0xd7)) {
          offset = markerOffset + 1;
          continue;
        }
        offset = markerOffset;
        scanEnd = true;
        break;
      }
      if (!scanEnd) return error('RASTER_MALFORMED', 'JPEG scan is missing EOI.');
      continue;
    }
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) return error('RASTER_MALFORMED', 'JPEG standalone marker is out of place.');
    if (marker === 0x01) continue;
    if (offset + 2 > bytes.length) return error('RASTER_MALFORMED', 'JPEG segment length is truncated.');
    const segmentLength = (bytes[offset] << 8) | bytes[offset + 1];
    if (segmentLength < 2 || offset + segmentLength > bytes.length) return error('RASTER_MALFORMED', 'JPEG segment length is invalid.');
    if (JPEG_SOF_MARKERS.has(marker)) {
      if (foundSof || segmentLength < 8) return error('RASTER_MALFORMED', 'JPEG must contain one complete SOF header.');
      const precision = bytes[offset + 2];
      height = (bytes[offset + 3] << 8) | bytes[offset + 4];
      width = (bytes[offset + 5] << 8) | bytes[offset + 6];
      const components = bytes[offset + 7] ?? 0;
      if (precision !== 8 || width < 1 || height < 1 || components < 1 || segmentLength !== 8 + components * 3) return error('RASTER_UNSUPPORTED', 'JPEG precision or component layout is unsupported.');
      foundSof = true;
    }
    offset += segmentLength;
  }
  if (!foundSof || !foundSos || !foundEoi) return error('RASTER_MALFORMED', 'JPEG is missing a complete SOF header, scan, or EOI marker.');
  return { width, height };
}

function numeric(value: string, path: string, options: { min?: number; max?: number; positive?: boolean } = {}) {
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/u.test(value)) return error('SVG_INVALID_NUMBER', 'SVG numeric values must be finite decimal numbers.', path);
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || (options.positive && parsed <= 0) || (options.min !== undefined && parsed < options.min) || (options.max !== undefined && parsed > options.max)) return error('SVG_INVALID_NUMBER', 'SVG numeric value is outside the bounded range.', path);
  return parsed;
}

function numberText(value: number) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(12)));
}

function parseNumberList(value: string, path: string, maxCount: number, positive = false) {
  if (value.length > SVG_LIMITS.max_path_length) return { errors: [error('SVG_ATTRIBUTE_LIMIT', 'SVG numeric list exceeds the bounded length.', path)] };
  const tokens = value.trim().split(/[\s,]+/u).filter(Boolean);
  if (tokens.length === 0 || tokens.length > maxCount) return { errors: [error('SVG_INVALID_NUMBER', 'SVG numeric list has an invalid bounded count.', path)] };
  const values: number[] = [];
  for (const token of tokens) {
    const parsed = numeric(token, path, { min: -100_000, max: 100_000, positive });
    if (typeof parsed !== 'number') return { errors: [parsed] };
    values.push(parsed);
  }
  return { values, errors: [] as MaterialValidationError[] };
}

function parsePath(value: string, path: string) {
  if (value.length < 1 || value.length > SVG_LIMITS.max_path_length) return { errors: [error('SVG_PATH_LIMIT', 'SVG path data exceeds the bounded length.', path)] };
  const tokenPattern = /[AaCcHhLlMmQqSsTtVvZz]|[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/gu;
  const tokens: string[] = [];
  let cursor = 0;
  for (const match of value.matchAll(tokenPattern)) {
    const text = match[0];
    const index = match.index ?? 0;
    if (!/^[\s,]*$/u.test(value.slice(cursor, index))) return { errors: [error('SVG_PATH_SYNTAX', 'SVG path contains unsupported syntax.', path)] };
    tokens.push(text);
    cursor = index + text.length;
    if (tokens.length > SVG_LIMITS.max_path_tokens) return { errors: [error('SVG_PATH_LIMIT', 'SVG path token count exceeds the bounded limit.', path)] };
  }
  if (!/^[\s,]*$/u.test(value.slice(cursor)) || tokens.length === 0 || !/^[Mm]$/u.test(tokens[0] ?? '')) return { errors: [error('SVG_PATH_SYNTAX', 'SVG path must begin with a moveto command.', path)] };
  const counts: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };
  const canonical: string[] = [];
  let index = 0;
  let command = '';
  while (index < tokens.length) {
    if (/^[A-Za-z]$/u.test(tokens[index] ?? '')) command = tokens[index++] as string;
    if (!command || !counts[command.toUpperCase()]) {
      if (command?.toUpperCase() !== 'Z') return { errors: [error('SVG_PATH_SYNTAX', 'SVG path command is unsupported or incomplete.', path)] };
      canonical.push(command.toUpperCase());
      command = '';
      continue;
    }
    const count = counts[command.toUpperCase()];
    const values: number[] = [];
    let parameterSet = 0;
    const appendParameterSet = () => {
      if (command.toUpperCase() === 'A') {
        if ((values[0] ?? -1) < 0 || (values[1] ?? -1) < 0 || ![0, 1].includes(values[3] ?? -1) || ![0, 1].includes(values[4] ?? -1)) {
          return error('SVG_PATH_SYNTAX', 'SVG arc radii must be non-negative and arc flags must be 0 or 1.', path);
        }
      }
      const emittedCommand = command.toUpperCase() === 'M' && parameterSet > 0
        ? (command === 'M' ? 'L' : 'l')
        : command;
      canonical.push(`${emittedCommand} ${values.map(numberText).join(' ')}`);
      parameterSet += 1;
      return undefined;
    };
    while (index < tokens.length && !/^[A-Za-z]$/u.test(tokens[index] ?? '')) {
      if (values.length === count) {
        const invalid = appendParameterSet();
        if (invalid) return { errors: [invalid] };
        values.length = 0;
      }
      const parsed = numeric(tokens[index] as string, path, { min: -100_000, max: 100_000 });
      if (typeof parsed !== 'number') return { errors: [parsed] };
      values.push(parsed);
      index += 1;
    }
    if (values.length !== count) return { errors: [error('SVG_PATH_SYNTAX', 'SVG path command has the wrong number of parameters.', path)] };
    const invalid = appendParameterSet();
    if (invalid) return { errors: [invalid] };
  }
  return { value: canonical.join(' '), errors: [] as MaterialValidationError[] };
}

const SVG_TAGS = new Set(['svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon']);
const PRESENTATION_ATTRIBUTES = new Set([
  'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-opacity', 'stroke-width',
  'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-dasharray',
  'stroke-dashoffset', 'opacity', 'color', 'clip-rule',
]);
const SVG_ATTRIBUTES: Record<string, Set<string>> = {
  svg: new Set(['xmlns', 'width', 'height', 'viewBox']),
  g: new Set(['transform', ...PRESENTATION_ATTRIBUTES]),
  path: new Set(['d', ...PRESENTATION_ATTRIBUTES, 'transform']),
  rect: new Set(['x', 'y', 'width', 'height', 'rx', 'ry', ...PRESENTATION_ATTRIBUTES, 'transform']),
  circle: new Set(['cx', 'cy', 'r', ...PRESENTATION_ATTRIBUTES, 'transform']),
  ellipse: new Set(['cx', 'cy', 'rx', 'ry', ...PRESENTATION_ATTRIBUTES, 'transform']),
  line: new Set(['x1', 'y1', 'x2', 'y2', ...PRESENTATION_ATTRIBUTES, 'transform']),
  polyline: new Set(['points', ...PRESENTATION_ATTRIBUTES, 'transform']),
  polygon: new Set(['points', ...PRESENTATION_ATTRIBUTES, 'transform']),
};
const REQUIRED_SVG_ATTRIBUTES: Record<string, readonly string[]> = {
  rect: ['width', 'height'],
  circle: ['r'],
  ellipse: ['rx', 'ry'],
  line: ['x1', 'y1', 'x2', 'y2'],
  polyline: ['points'],
  polygon: ['points'],
  path: ['d'],
};
const COLOR_PATTERN = /^(?:none|currentColor|#[0-9a-f]{3,8}|[A-Za-z]{1,32})$/u;

type SvgNode = { name: string; attributes: Record<string, string>; children: SvgNode[] };

function escapeXml(value: string) {
  return value.replace(/&/gu, '&amp;').replace(/"/gu, '&quot;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;');
}

function parseTransform(value: string, path: string) {
  const pieces: string[] = [];
  let cursor = 0;
  const pattern = /(matrix|translate|scale|rotate)\s*\(([^)]*)\)/gu;
  for (const match of value.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (!/^[\s,]*$/u.test(value.slice(cursor, index))) return { errors: [error('SVG_INVALID_TRANSFORM', 'SVG transform syntax is unsupported.', path)] };
    const name = match[1] as string;
    const max = name === 'matrix' ? 6 : name === 'translate' || name === 'scale' ? 2 : 3;
    const list = parseNumberList(match[2] as string, path, max);
    const count = list.values?.length ?? 0;
    const validCount = name === 'matrix'
      ? count === 6
      : name === 'rotate'
        ? count === 1 || count === 3
        : count === 1 || count === 2;
    if (list.errors.length > 0 || !list.values || !validCount) return { errors: [error('SVG_INVALID_TRANSFORM', 'SVG transform has an invalid bounded argument count.', path)] };
    pieces.push(`${name}(${list.values.map(numberText).join(' ')})`);
    cursor = index + match[0].length;
  }
  if (pieces.length === 0 || !/^[\s,]*$/u.test(value.slice(cursor))) return { errors: [error('SVG_INVALID_TRANSFORM', 'SVG transform syntax is unsupported.', path)] };
  return { value: pieces.join(' '), errors: [] as MaterialValidationError[] };
}

function parseSvg(source: string): { bytes?: Uint8Array; width?: number; height?: number; errors: MaterialValidationError[] } {
  if (source.length === 0 || source.length > MATERIAL_LIMITS.max_svg_bytes || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(source)) return { errors: [error('SVG_MALFORMED_XML', 'SVG contains empty, oversized, or forbidden control content.')] };
  if (source.includes('&') || /<!--[\s\S]*?-->|<\?|<!\[CDATA\[|<!DOCTYPE|<!ENTITY/iu.test(source)) return { errors: [error('SVG_ACTIVE_CONTENT', 'SVG comments, processing instructions, CDATA, DOCTYPE, and entities are refused.')] };
  // The exact root SVG namespace is the sole permitted `http://` string. All
  // other URL-like, protocol-relative, data, or script references are refused.
  const withoutSvgNamespace = source.replaceAll('http://www.w3.org/2000/svg', '');
  if (/(?:url\s*\(|data\s*:|javascript\s*:|https?:\s*\/\/|\/\/)/iu.test(withoutSvgNamespace)) return { errors: [error('SVG_ACTIVE_CONTENT', 'SVG URL, data, JavaScript, or remote references are refused.')] };
  if (/[\uD800-\uDFFF]/u.test(source)) {
    for (let index = 0; index < source.length; index += 1) {
      const code = source.charCodeAt(index);
      if (code >= 0xd800 && code <= 0xdbff) {
        const next = source.charCodeAt(index + 1);
        if (!(next >= 0xdc00 && next <= 0xdfff)) return { errors: [error('SVG_MALFORMED_XML', 'SVG contains an unpaired surrogate.')] };
        index += 1;
      } else if (code >= 0xdc00 && code <= 0xdfff) return { errors: [error('SVG_MALFORMED_XML', 'SVG contains an unpaired surrogate.')] };
    }
  }
  let cursor = 0;
  let elements = 0;
  const parseNode = (depth: number): SvgNode | MaterialValidationError => {
    if (depth > SVG_LIMITS.max_depth) return error('SVG_DEPTH_LIMIT', 'SVG nesting exceeds the bounded depth.');
    if (source[cursor] !== '<') return error('SVG_MALFORMED_XML', 'SVG element must begin with <.');
    cursor += 1;
    if (source[cursor] === '/' || source[cursor] === '!' || source[cursor] === '?') return error('SVG_MALFORMED_XML', 'SVG closing or declaration appears where an element was expected.');
    const nameStart = cursor;
    while (cursor < source.length && /[A-Za-z0-9_-]/u.test(source[cursor] ?? '')) cursor += 1;
    const name = source.slice(nameStart, cursor);
    if (!/^[A-Za-z][A-Za-z0-9_-]*$/u.test(name) || !SVG_TAGS.has(name)) return error('SVG_UNSUPPORTED_ELEMENT', 'SVG element is outside the strict geometry subset.', name || undefined);
    if (name === 'svg' && depth !== 0) return error('SVG_NAMESPACE', 'Nested svg elements and namespace declarations are refused.', name);
    elements += 1;
    if (elements > SVG_LIMITS.max_elements) return error('SVG_ELEMENT_LIMIT', 'SVG element count exceeds the bounded limit.');
    const attributes: Record<string, string> = {};
    const seenAttributes = new Set<string>();
    let selfClosing = false;
    while (cursor < source.length) {
      while (/\s/u.test(source[cursor] ?? '')) cursor += 1;
      if (source.startsWith('/>', cursor)) {
        cursor += 2;
        selfClosing = true;
        break;
      }
      if (source[cursor] === '>') {
        cursor += 1;
        break;
      }
      const attrStart = cursor;
      while (cursor < source.length && /[A-Za-z0-9_:\-]/u.test(source[cursor] ?? '')) cursor += 1;
      const attrName = source.slice(attrStart, cursor);
      if (!/^[A-Za-z][A-Za-z0-9_-]*$/u.test(attrName) || attrName.includes(':') || seenAttributes.has(attrName)) return error('SVG_UNSUPPORTED_ATTRIBUTE', 'SVG attribute names must be unique, unnamespaced, and bounded.', `${name}.${attrName || '?'}`);
      if (!SVG_ATTRIBUTES[name]?.has(attrName)) return error('SVG_UNSUPPORTED_ATTRIBUTE', 'SVG attribute is outside the strict geometry subset.', `${name}.${attrName}`);
      seenAttributes.add(attrName);
      while (/\s/u.test(source[cursor] ?? '')) cursor += 1;
      if (source[cursor] !== '=') return error('SVG_MALFORMED_XML', 'SVG attribute must have an explicit value.', `${name}.${attrName}`);
      cursor += 1;
      while (/\s/u.test(source[cursor] ?? '')) cursor += 1;
      const quote = source[cursor];
      if (quote !== '"' && quote !== "'") return error('SVG_MALFORMED_XML', 'SVG attribute values must be quoted.', `${name}.${attrName}`);
      cursor += 1;
      const valueStart = cursor;
      while (cursor < source.length && source[cursor] !== quote) cursor += 1;
      if (cursor >= source.length) return error('SVG_MALFORMED_XML', 'SVG attribute quote is not closed.', `${name}.${attrName}`);
      const value = source.slice(valueStart, cursor);
      cursor += 1;
      if (value.length > SVG_LIMITS.max_path_length || /[<>]/u.test(value)) return error('SVG_ATTRIBUTE_LIMIT', 'SVG attribute value is too long or malformed.', `${name}.${attrName}`);
      attributes[attrName] = value;
      if (seenAttributes.size > SVG_LIMITS.max_attributes_per_element) return error('SVG_ATTRIBUTE_LIMIT', 'SVG attribute count exceeds the bounded limit.', name);
    }
    for (const required of REQUIRED_SVG_ATTRIBUTES[name] ?? []) if (!(required in attributes)) return error('SVG_MALFORMED_XML', `SVG ${name} requires ${required}.`, `${name}.${required}`);
    const children: SvgNode[] = [];
    const node: SvgNode = { name, attributes, children };
    if (name === 'svg' && attributes.xmlns !== 'http://www.w3.org/2000/svg') return error('SVG_NAMESPACE', 'The root SVG must use exactly the SVG namespace declaration.');
    if (selfClosing) return node;
    let closed = false;
    while (cursor < source.length) {
      if (source.startsWith('</', cursor)) {
        cursor += 2;
        const closeStart = cursor;
        while (cursor < source.length && /[A-Za-z0-9_-]/u.test(source[cursor] ?? '')) cursor += 1;
        const closeName = source.slice(closeStart, cursor);
        while (/\s/u.test(source[cursor] ?? '')) cursor += 1;
        if (source[cursor] !== '>' || closeName !== name) return error('SVG_MALFORMED_XML', 'SVG closing tag does not match its element.');
        cursor += 1;
        closed = true;
        break;
      }
      if (source[cursor] === '<') {
        const child = parseNode(depth + 1);
        if (!('name' in child)) return child;
        children.push(child);
      } else {
        const textStart = cursor;
        while (cursor < source.length && source[cursor] !== '<') cursor += 1;
        if (/\S/u.test(source.slice(textStart, cursor))) return error('SVG_TEXT', 'SVG text nodes are refused; geometry only is accepted.');
      }
    }
    if (!closed) return error('SVG_MALFORMED_XML', 'SVG element is not closed.');
    return node;
  };
  while (cursor < source.length && /\s/u.test(source[cursor] ?? '')) cursor += 1;
  const parsed = parseNode(0);
  if (!('name' in parsed)) return { errors: [parsed] };
  const root = parsed;
  while (cursor < source.length && /\s/u.test(source[cursor] ?? '')) cursor += 1;
  if (cursor !== source.length || root.name !== 'svg') return { errors: [error('SVG_MALFORMED_XML', 'SVG must contain exactly one root svg element.')] };

  const canonicalizeNode = (node: SvgNode, path: string): { node?: SvgNode; errors: MaterialValidationError[] } => {
    const attrs: Record<string, string> = {};
    for (const [name, rawValue] of Object.entries(node.attributes)) {
      let value = rawValue.trim();
      const attrPath = `${path}.${name}`;
      if (name === 'xmlns') {
        if (node.name !== 'svg' || value !== 'http://www.w3.org/2000/svg') return { errors: [error('SVG_NAMESPACE', 'Only the exact root xmlns attribute is permitted.', attrPath)] };
      } else if (name === 'd') {
        const parsedPath = parsePath(value, attrPath);
        if (parsedPath.errors.length > 0 || !parsedPath.value) return { errors: parsedPath.errors };
        value = parsedPath.value;
      } else if (name === 'points') {
        const parsedPoints = parseNumberList(value, attrPath, SVG_LIMITS.max_points * 2);
        if (parsedPoints.errors.length > 0 || !parsedPoints.values || parsedPoints.values.length < 4 || parsedPoints.values.length % 2 !== 0) return { errors: [error('SVG_INVALID_POINTS', 'SVG points must be a bounded even numeric list.', attrPath)] };
        value = parsedPoints.values.map(numberText).join(' ');
      } else if (name === 'viewBox') {
        const parsedViewBox = parseNumberList(value, attrPath, 4);
        if (parsedViewBox.errors.length > 0 || !parsedViewBox.values || parsedViewBox.values.length !== 4 || parsedViewBox.values[2] <= 0 || parsedViewBox.values[3] <= 0) return { errors: [error('SVG_INVALID_VIEWBOX', 'SVG viewBox must contain four bounded numbers with positive width and height.', attrPath)] };
        value = parsedViewBox.values.map(numberText).join(' ');
      } else if (PRESENTATION_ATTRIBUTES.has(name)) {
        if (name === 'fill' || name === 'stroke' || name === 'color') {
          if (!COLOR_PATTERN.test(value) || /(?:url|data:|javascript:|https?:|\/\/)/iu.test(value)) return { errors: [error('SVG_PRESENTATION', 'SVG paint values must be bounded local colors.', attrPath)] };
        } else if (['stroke-linecap', 'stroke-linejoin', 'fill-rule', 'clip-rule'].includes(name)) {
          const allowed = name === 'stroke-linecap' ? ['butt', 'round', 'square'] : name === 'stroke-linejoin' ? ['miter', 'round', 'bevel'] : ['nonzero', 'evenodd'];
          if (!allowed.includes(value)) return { errors: [error('SVG_PRESENTATION', 'SVG presentation value is outside the bounded set.', attrPath)] };
        } else {
          const parsedNumeric = numeric(value, attrPath, { min: 0, max: name.includes('opacity') || name === 'opacity' ? 1 : 100_000 });
          if (typeof parsedNumeric !== 'number') return { errors: [parsedNumeric] };
          value = numberText(parsedNumeric);
        }
      } else if (name === 'transform') {
        const parsedTransform = parseTransform(value, attrPath);
        if (parsedTransform.errors.length > 0 || !parsedTransform.value) return { errors: parsedTransform.errors };
        value = parsedTransform.value;
      } else {
        const parsedNumeric = numeric(value, attrPath, { min: -100_000, max: 100_000, positive: ['width', 'height', 'r', 'rx', 'ry'].includes(name) });
        if (typeof parsedNumeric !== 'number') return { errors: [parsedNumeric] };
        value = numberText(parsedNumeric);
      }
      attrs[name] = value;
    }
    const childNodes: SvgNode[] = [];
    for (let index = 0; index < node.children.length; index += 1) {
      const child = canonicalizeNode(node.children[index] as SvgNode, `${path}.${node.children[index]?.name ?? index}`);
      if (child.errors.length > 0 || !child.node) return child;
      childNodes.push(child.node);
    }
    const sorted = Object.fromEntries(Object.keys(attrs).sort().map((key) => [key, attrs[key]]));
    return { node: { name: node.name, attributes: sorted, children: childNodes }, errors: [] };
  };
  const canonical = canonicalizeNode(root, 'svg');
  if (canonical.errors.length > 0 || !canonical.node) return { errors: canonical.errors };
  const rootAttributes = canonical.node.attributes;
  const viewBox = rootAttributes.viewBox?.split(' ').map(Number);
  const widthValue = rootAttributes.width ? Number(rootAttributes.width) : viewBox?.[2];
  const heightValue = rootAttributes.height ? Number(rootAttributes.height) : viewBox?.[3];
  if (!Number.isFinite(widthValue) || !Number.isFinite(heightValue) || (widthValue ?? 0) <= 0 || (heightValue ?? 0) <= 0) return { errors: [error('SVG_DIMENSIONS', 'SVG width/height or a positive viewBox is required.')] };
  const serialize = (node: SvgNode): string => {
    const attrs = Object.entries(node.attributes).map(([name, value]) => ` ${name}="${escapeXml(value)}"`).join('');
    return `<${node.name}${attrs}>${node.children.map(serialize).join('')}</${node.name}>`;
  };
  const bytes = utf8Bytes(serialize(canonical.node));
  if (bytes.length > MATERIAL_LIMITS.max_svg_bytes) return { errors: [error('SVG_SIZE_LIMIT', 'Sanitized SVG bytes exceed the bounded limit.')] };
  return { bytes, width: widthValue, height: heightValue, errors: [] };
}

function dimensionsWithinLimits(dimensions: { width: number; height: number }): MaterialValidationError | undefined {
  if (!Number.isSafeInteger(dimensions.width) || !Number.isSafeInteger(dimensions.height) || dimensions.width < 1 || dimensions.height < 1) return error('RASTER_DIMENSIONS', 'Raster dimensions must be positive safe integers.');
  if (dimensions.width > MATERIAL_LIMITS.max_dimension || dimensions.height > MATERIAL_LIMITS.max_dimension) return error('MATERIAL_DIMENSION_LIMIT', `Material dimensions must be at most ${MATERIAL_LIMITS.max_dimension}px.`);
  if (dimensions.width * dimensions.height > MATERIAL_LIMITS.max_pixels) return error('MATERIAL_PIXEL_LIMIT', `Material pixel count must be at most ${MATERIAL_LIMITS.max_pixels}.`);
  return undefined;
}

function materialBytesInput(raw: Record<string, unknown>) {
  const mime = raw.mime_type;
  if (typeof mime !== 'string' || !SUPPORTED_MATERIAL_MIME_TYPES.includes(mime as SupportedMaterialMimeType)) return { mime: undefined, error: error('UNSUPPORTED_MIME', 'Only image/png, image/jpeg, and image/svg+xml are supported.', 'mime_type') };
  const maxBytes = mime === 'image/svg+xml' ? MATERIAL_LIMITS.max_svg_bytes : MATERIAL_LIMITS.max_raster_bytes;
  const decoded = decodeBase64(raw.base64, maxBytes);
  if (decoded.errors.length > 0 || !decoded.bytes) return { mime: mime as SupportedMaterialMimeType, error: decoded.errors[0] };
  return { mime: mime as SupportedMaterialMimeType, bytes: decoded.bytes };
}

/** Return true only for material records created by prepareMaterial(s). */
export function isPreparedMaterial(value: unknown): value is PreparedMaterial {
  return isRecord(value) && preparedMaterials.has(value);
}

/** Prepare one bounded material. Raster decode is deliberately injected. */
export async function prepareMaterial(input: unknown, options: MaterialPreparationOptions = {}): Promise<MaterialPreparationResult> {
  const errors: MaterialValidationError[] = [];
  if (!isPlainRecord(input)) return { ok: false, errors: [error('WRONG_TYPE', 'Material must be a plain object with data properties.')] };
  const allowed = ['semantic_id', 'mime_type', 'base64', 'label', 'alt', 'prompt_summary', 'originating_capability', 'qualification_boundary', 'x', 'y', 'w', 'h'];
  if (!hasOnlyKeys(input, allowed)) errors.push(error('UNKNOWN_FIELD', 'Material accepts only bounded inline metadata, placement, MIME, and base64 bytes.'));
  if (typeof input.semantic_id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,179}$/u.test(input.semantic_id)) errors.push(error('INVALID_SEMANTIC_ID', `semantic_id must be 1-${MATERIAL_TEXT_LIMITS.semantic_id} stable identifier characters.`, 'semantic_id'));
  const label = boundedText(input.label, MATERIAL_TEXT_LIMITS.label, 'label', errors);
  const alt = boundedText(input.alt, MATERIAL_TEXT_LIMITS.alt, 'alt', errors);
  const promptSummary = boundedText(input.prompt_summary, MATERIAL_TEXT_LIMITS.prompt_summary, 'prompt_summary', errors) || 'not provided';
  const originatingCapability = boundedText(input.originating_capability, MATERIAL_TEXT_LIMITS.originating_capability, 'originating_capability', errors) || 'unspecified';
  const qualificationBoundary = boundedText(input.qualification_boundary, MATERIAL_TEXT_LIMITS.qualification_boundary, 'qualification_boundary', errors) || 'Fogwood local validation only; originating context was not supplied.';
  for (const key of ['x', 'y', 'w', 'h']) if (!finiteNumber(input[key])) errors.push(error('INVALID_PLACEMENT', `${key} must be a finite number.`, key));
  if (finiteNumber(input.x) && (input.x < -100_000 || input.x > 100_000)) errors.push(error('INVALID_PLACEMENT', 'x must be between -100000 and 100000.', 'x'));
  if (finiteNumber(input.y) && (input.y < -100_000 || input.y > 100_000)) errors.push(error('INVALID_PLACEMENT', 'y must be between -100000 and 100000.', 'y'));
  if (finiteNumber(input.w) && (input.w < 16 || input.w > MATERIAL_LIMITS.max_dimension)) errors.push(error('INVALID_PLACEMENT', `w must be between 16 and ${MATERIAL_LIMITS.max_dimension}.`, 'w'));
  if (finiteNumber(input.h) && (input.h < 16 || input.h > MATERIAL_LIMITS.max_dimension)) errors.push(error('INVALID_PLACEMENT', `h must be between 16 and ${MATERIAL_LIMITS.max_dimension}.`, 'h'));
  const bytesInput = materialBytesInput(input);
  if (bytesInput.error) errors.push(bytesInput.error);
  if (errors.length > 0 || !bytesInput.bytes || !bytesInput.mime) return { ok: false, errors };

  let bytes = bytesInput.bytes;
  let sourceStatus: MaterialSourceStatus = 'original';
  let dimensions: { width: number; height: number } | MaterialValidationError;
  if (bytesInput.mime === 'image/svg+xml') {
    let decoded: string;
    try {
      decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      return { ok: false, errors: [error('SVG_MALFORMED_XML', 'SVG bytes are not valid UTF-8.')] };
    }
    const parsed = parseSvg(decoded);
    if (parsed.errors.length > 0 || !parsed.bytes || !parsed.width || !parsed.height) return { ok: false, errors: parsed.errors };
    bytes = parsed.bytes;
    sourceStatus = 'sanitized';
    dimensions = { width: parsed.width, height: parsed.height };
  } else {
    const parsed = bytesInput.mime === 'image/png' ? pngDimensions(bytes) : jpegDimensions(bytes);
    if ('code' in parsed) return { ok: false, errors: [parsed] };
    dimensions = parsed;
  }
  const dimensionsError = dimensionsWithinLimits(dimensions);
  if (dimensionsError) return { ok: false, errors: [dimensionsError] };
  if (bytesInput.mime !== 'image/svg+xml') {
    if (!options.decodeRaster) return { ok: false, errors: [error('DECODE_REQUIRED', 'Raster material must pass an injected asynchronous browser decode before staging.')] };
    let decoded: MaterialDecodeResult;
    try {
      decoded = await options.decodeRaster({ mime_type: bytesInput.mime, bytes: new Uint8Array(bytes), width: dimensions.width, height: dimensions.height });
    } catch {
      return { ok: false, errors: [error('DECODE_REFUSED', 'Browser decode refused the raster bytes.')] };
    }
    if (!isRecord(decoded) || !Number.isSafeInteger(decoded.width) || !Number.isSafeInteger(decoded.height) || decoded.width !== dimensions.width || decoded.height !== dimensions.height) return { ok: false, errors: [error('DECODE_DIMENSION_MISMATCH', 'Browser decode dimensions must exactly match the validated header dimensions.')] };
  }
  const canonicalBase64 = encodeBase64(bytes);
  const prepared: PreparedMaterial = Object.freeze({
    semantic_id: input.semantic_id as string,
    mime_type: bytesInput.mime,
    base64: canonicalBase64,
    canonical_base64: canonicalBase64,
    content_hash: sha256Bytes(bytes),
    byte_length: bytes.byteLength,
    source_status: sourceStatus,
    dimensions: Object.freeze({ width: dimensions.width, height: dimensions.height }),
    width: dimensions.width,
    height: dimensions.height,
    decode_qualified: true,
    label,
    alt,
    prompt_summary: promptSummary,
    originating_capability: originatingCapability,
    qualification_boundary: qualificationBoundary,
    x: input.x as number,
    y: input.y as number,
    w: input.w as number,
    h: input.h as number,
  });
  preparedMaterials.add(prepared);
  return { ok: true, material: prepared };
}

/** Prepare one add_materials action and enforce its four-item bound. */
export async function prepareMaterials(input: unknown, options: MaterialPreparationOptions = {}): Promise<MaterialBatchResult> {
  if (!Array.isArray(input) || input.length < 1 || input.length > MATERIAL_LIMITS.max_materials_per_action) return { ok: false, errors: [error('MATERIAL_COUNT_LIMIT', `One add_materials action accepts 1-${MATERIAL_LIMITS.max_materials_per_action} materials.`)] };
  const materials: PreparedMaterial[] = [];
  const errors: MaterialValidationError[] = [];
  let byteLength = 0;
  for (let index = 0; index < input.length; index += 1) {
    const prepared = await prepareMaterial(input[index], options);
    if (!prepared.ok) {
      errors.push(...prepared.errors.map((entry) => ({ ...entry, path: entry.path ? `materials[${index}].${entry.path}` : `materials[${index}]` })));
      continue;
    }
    materials.push(prepared.material);
    byteLength += prepared.material.byte_length;
    if (byteLength > MATERIAL_LIMITS.max_aggregate_bytes) errors.push(error('MATERIAL_AGGREGATE_LIMIT', `Aggregate material bytes must be at most ${MATERIAL_LIMITS.max_aggregate_bytes}.`, 'materials'));
  }
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, materials: Object.freeze(materials), byte_length: byteLength };
}
