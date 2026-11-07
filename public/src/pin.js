// PIN phụ huynh: PBKDF2-SHA256 + salt ngẫu nhiên, so sánh hằng thời gian, khoá tạm leo thang.
// LƯU Ý: đây là "cổng chặn trẻ em", không phải xác thực chống kẻ tấn công có quyền truy cập thiết bị.

export const PIN_RE = /^\d{4,8}$/;
export const DEFAULT_ITERATIONS = 150_000;
export const MAX_FAILS = 5;

const subtle = () => globalThis.crypto.subtle;
/** crypto.subtle chỉ có trong "secure context" (HTTPS hoặc localhost). Mở bằng địa chỉ IP trong mạng LAN qua HTTP thì không có. */
export const pinSupported = () => !!(globalThis.crypto && globalThis.crypto.subtle && globalThis.crypto.getRandomValues);

function toB64(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function fromB64(b64) {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function derive(pin, salt, iterations) {
  const key = await subtle().importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await subtle().deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

export function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function hashPin(pin, iterations = DEFAULT_ITERATIONS) {
  if (!PIN_RE.test(pin)) throw new Error('PIN phải gồm 4–8 chữ số');
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(pin, salt, iterations);
  return { salt: toB64(salt), hash: toB64(hash), iterations };
}

export async function verifyPin(pin, record) {
  if (typeof pin !== 'string' || !PIN_RE.test(pin) || !record) return false;
  try {
    const got = await derive(pin, fromB64(record.salt), record.iterations);
    return constantTimeEqual(got, fromB64(record.hash));
  } catch {
    return false;
  }
}

/** Thời gian khoá (ms) sau lần sai thứ n (n>=5): 60s, 120s, 240s ... tối đa ~16 phút. */
export function lockDuration(totalFails) {
  const tier = Math.floor(totalFails / MAX_FAILS); // >=1 khi bị khoá
  return 60_000 * 2 ** Math.min(Math.max(tier - 1, 0), 4);
}

export const isLocked = (parent, now) => parent.lockedUntil > now;

/** Ghi nhận lần sai. Trả về parent mới. */
export function registerFailure(parent, now) {
  const failed = parent.failed + 1;
  const lockedUntil = failed % MAX_FAILS === 0 ? now + lockDuration(failed) : parent.lockedUntil;
  return { ...parent, failed, lockedUntil };
}

/** Đăng nhập đúng: xoá bộ đếm sai (giữ pin). */
export const registerSuccess = (parent) => ({ ...parent, failed: 0, lockedUntil: 0 });
