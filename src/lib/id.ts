/**
 * UUID v7: 48-bit unix timestamp, 12-bit sequence, 62 bits of randomness.
 *
 * Time-ordered ids keep Postgres b-tree inserts sequential, unlike v4. The
 * sequence counter preserves order for ids created inside the same millisecond.
 */

let lastTimestamp = -1;
let sequence = 0;

const HEX = "0123456789abcdef";

function toHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 1) {
    const byte = bytes[i] ?? 0;
    out += HEX[byte >> 4];
    out += HEX[byte & 0x0f];
    if (i === 3 || i === 5 || i === 7 || i === 9) out += "-";
  }
  return out;
}

export function uuidv7(): string {
  let timestamp = Date.now();
  const previous = lastTimestamp;

  if (timestamp <= previous) {
    // Same millisecond, or the clock moved backwards. Continue from the last
    // timestamp and bump the sequence; when the 12 bits wrap, borrow a
    // millisecond so ids stay strictly increasing.
    timestamp = previous;
    sequence = (sequence + 1) & 0x0fff;
    if (sequence === 0) timestamp = previous + 1;
  } else {
    sequence = Math.floor(Math.random() * 0x1000);
  }

  lastTimestamp = timestamp;

  const random = new Uint8Array(8);
  crypto.getRandomValues(random);

  const bytes = new Uint8Array(16);
  const ts = BigInt(timestamp);

  bytes[0] = Number((ts >> 40n) & 0xffn);
  bytes[1] = Number((ts >> 32n) & 0xffn);
  bytes[2] = Number((ts >> 24n) & 0xffn);
  bytes[3] = Number((ts >> 16n) & 0xffn);
  bytes[4] = Number((ts >> 8n) & 0xffn);
  bytes[5] = Number(ts & 0xffn);

  // version 7 in the high nibble, sequence in the low 12 bits
  bytes[6] = 0x70 | ((sequence >> 8) & 0x0f);
  bytes[7] = sequence & 0xff;

  // variant 10
  bytes[8] = 0x80 | ((random[0] ?? 0) & 0x3f);
  for (let i = 1; i < 8; i += 1) bytes[8 + i] = random[i] ?? 0;

  return toHex(bytes);
}

/** True when the string is a well-formed, version-7 UUID. */
export function isUuidv7(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
}
