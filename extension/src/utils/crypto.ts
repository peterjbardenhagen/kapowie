/// <reference types="chrome" />

import type { Segment } from '../types';

// ─── AES-128 Decryption ───────────────────────────────────────────────────────

const SUBTLE_CRYPTO = typeof crypto !== 'undefined' ? crypto : null;

/**
 * Decrypt an AES-128-CBC encrypted segment using Web Crypto API.
 *
 * @param encryptedData - The encrypted segment bytes
 * @param keyBytes - The 16-byte AES key
 * @param iv - The 16-byte initialization vector. If omitted, uses the segment sequence number as IV.
 * @returns The decrypted segment bytes
 */
export async function decryptAES128CBC(
  encryptedData: Uint8Array,
  keyBytes: Uint8Array,
  iv?: Uint8Array
): Promise<Uint8Array> {
  if (keyBytes.length !== 16) {
    throw new CryptoError(`Invalid AES key length: ${keyBytes.length}, expected 16`);
  }

  if (!iv) {
    // Default IV: all zeros (common for HLS AES-128)
    iv = new Uint8Array(16);
  }

  if (iv.length !== 16) {
    throw new CryptoError(`Invalid IV length: ${iv.length}, expected 16`);
  }

  if (!SUBTLE_CRYPTO || !SUBTLE_CRYPTO.subtle) {
    throw new CryptoError('Web Crypto API is not available in this context');
  }

  const keyBuffer = new ArrayBuffer(keyBytes.byteLength);
  new Uint8Array(keyBuffer).set(keyBytes);
  const ivBuffer = new ArrayBuffer(iv.byteLength);
  new Uint8Array(ivBuffer).set(iv);
  const dataBuffer = new ArrayBuffer(encryptedData.byteLength);
  new Uint8Array(dataBuffer).set(encryptedData);

  const cryptoKey = await SUBTLE_CRYPTO.subtle.importKey(
    'raw',
    keyBuffer as unknown as BufferSource,
    { name: 'AES-CBC', length: 128 },
    false,
    ['decrypt']
  );

  const decrypted = await SUBTLE_CRYPTO.subtle.decrypt(
    { name: 'AES-CBC', iv: ivBuffer as unknown as BufferSource },
    cryptoKey,
    dataBuffer as unknown as BufferSource
  );

  return new Uint8Array(decrypted);
}

/**
 * Fetch and parse an encryption key from a URI.
 * HLS typically serves keys as raw 16-byte files over HTTPS.
 *
 * @param keyUri - The URI of the encryption key
 * @returns The 16-byte AES key
 */
export async function fetchEncryptionKey(keyUri: string): Promise<Uint8Array> {
  const response = await fetch(keyUri, {
    credentials: 'same-origin',
  });

  if (!response.ok) {
    throw new CryptoError(`Failed to fetch encryption key from ${keyUri}: ${response.status} ${response.statusText}`);
  }

  const keyBuffer = await response.arrayBuffer();
  const keyBytes = new Uint8Array(keyBuffer);

  if (keyBytes.length !== 16) {
    throw new CryptoError(`Invalid encryption key length: ${keyBytes.length}, expected 16 bytes`);
  }

  return keyBytes;
}

/**
 * Compute the IV for an encrypted segment based on its HLS sequence number.
 * Per the HLS spec (#EXT-X-KEY), when no IV attribute is present, the IV is
 * the sequence number of the segment left-padded with zeros to 16 bytes.
 *
 * @param sequenceNumber - The media sequence number
 * @returns The 16-byte IV
 */
export function computeIVForSequence(sequenceNumber: number): Uint8Array {
  const iv = new Uint8Array(16);
  const hex = sequenceNumber.toString(16).padStart(32, '0');
  for (let i = 0; i < 16; i++) {
    iv[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return iv;
}

/**
 * Parse an IV string from HLS manifest attribute.
 * Format is either a hex string prefixed with "0x" (e.g. "0x1234...") or raw 16 bytes.
 *
 * @param ivString - The IV string from the manifest
 * @returns The 16-byte IV
 */
export function parseIV(ivString: string): Uint8Array {
  if (ivString.startsWith('0x') || ivString.startsWith('0X')) {
    const hex = ivString.slice(2);
    const iv = new Uint8Array(16);
    for (let i = 0; i < 16; i++) {
      iv[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return iv;
  }

  // If it's not hex, treat as binary data
  const encoder = new TextEncoder();
  const encoded = encoder.encode(ivString);
  if (encoded.length === 16) return encoded;

  throw new CryptoError(`Invalid IV format: expected hex string or 16 bytes, got "${ivString.slice(0, 20)}..."`);
}

/**
 * Decrypt a segment in-place. Fetches the key if not provided.
 *
 * @param segment - The segment to decrypt
 * @param defaultKey - Optional default key to use if segment doesn't have its own keyUri
 * @returns A new decrypted segment
 */
export async function decryptSegment(
  segment: Segment,
  defaultKey?: Uint8Array
): Promise<Segment> {
  if (!segment.isEncrypted) return segment;

  const keyBytes = segment.keyUri
    ? await fetchEncryptionKey(segment.keyUri)
    : defaultKey;

  if (!keyBytes) {
    throw new CryptoError('No encryption key available for encrypted segment');
  }

  const iv = segment.iv ? parseIV(segment.iv) : undefined;
  const decryptedData = await decryptAES128CBC(segment.data, keyBytes, iv);

  return {
    ...segment,
    data: decryptedData,
    isEncrypted: false,
    keyUri: undefined,
    iv: undefined,
  };
}

// ─── Key Cache ────────────────────────────────────────────────────────────────

/**
 * LRU cache for encryption keys to avoid redundant fetches within a session.
 */
export class KeyCache {
  private cache = new Map<string, Uint8Array>();
  private readonly maxSize: number;

  constructor(maxSize = 32) {
    this.maxSize = maxSize;
  }

  get(uri: string): Uint8Array | undefined {
    const key = this.cache.get(uri);
    if (key) {
      // Move to end (most recent)
      this.cache.delete(uri);
      this.cache.set(uri, key);
    }
    return key;
  }

  set(uri: string, key: Uint8Array): void {
    if (this.cache.has(uri)) {
      this.cache.delete(uri);
    } else if (this.cache.size >= this.maxSize) {
      // Evict oldest (first entry)
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) this.cache.delete(firstKey);
    }
    this.cache.set(uri, key);
  }

  has(uri: string): boolean {
    return this.cache.has(uri);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

// ─── Error Type ──────────────────────────────────────────────────────────────

export class CryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CryptoError';
  }
}
