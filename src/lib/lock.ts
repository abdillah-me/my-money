/*
 * Kunci aplikasi dengan PIN 6 digit.
 * PIN tidak pernah disimpan; yang disimpan hanya hash PBKDF2-SHA256 + salt acak.
 * Catatan: ini kunci tampilan (mencegah orang lain membuka aplikasi di HP),
 * bukan enkripsi data — data IndexedDB tetap bisa dibaca lewat DevTools oleh yang punya akses perangkat.
 */

const KEY = 'wahduid.lock'
const ITERATIONS = 150_000
export const PIN_LENGTH = 6
/** Setelah sekian kali salah, tunggu sebelum boleh mencoba lagi */
const MAX_ATTEMPTS = 5
const COOLDOWN_MS = 30_000

interface Stored {
  salt: string
  hash: string
  iter: number
  fails?: number
  until?: number
}

const toB64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf)))
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

async function derive(pin: string, salt: Uint8Array<ArrayBuffer>, iter: number) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits'])
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, key, 256)
}

function read(): Stored | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Stored) : null
  } catch {
    return null
  }
}

const write = (s: Stored) => localStorage.setItem(KEY, JSON.stringify(s))

export const hasPin = () => read() !== null

export async function setPin(pin: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await derive(pin, salt, ITERATIONS)
  write({ salt: toB64(salt), hash: toB64(hash), iter: ITERATIONS })
}

export const clearPin = () => localStorage.removeItem(KEY)

/** Sisa waktu tunggu (ms) bila terlalu banyak percobaan salah */
export function cooldownLeft() {
  const s = read()
  return s?.until ? Math.max(0, s.until - Date.now()) : 0
}

/** Bandingkan hash tanpa short-circuit agar waktu eksekusi tidak membocorkan isi */
function equal(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

export async function verifyPin(pin: string): Promise<'ok' | 'wrong' | 'cooldown'> {
  const s = read()
  if (!s) return 'ok'
  if (cooldownLeft() > 0) return 'cooldown'
  const hash = new Uint8Array(await derive(pin, fromB64(s.salt), s.iter))
  if (equal(hash, fromB64(s.hash))) {
    write({ salt: s.salt, hash: s.hash, iter: s.iter })
    return 'ok'
  }
  const fails = (s.fails ?? 0) + 1
  write({ ...s, fails: fails >= MAX_ATTEMPTS ? 0 : fails, until: fails >= MAX_ATTEMPTS ? Date.now() + COOLDOWN_MS : undefined })
  return 'wrong'
}
