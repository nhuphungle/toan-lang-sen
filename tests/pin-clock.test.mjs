import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPin, verifyPin, constantTimeEqual, registerFailure, registerSuccess, isLocked, lockDuration, PIN_RE } from '../public/src/pin.js';
import { PlayClock, todayKey } from '../public/src/play-clock.js';

test('PIN: băm khác nhau mỗi lần (salt), xác thực đúng/sai', async () => {
  const a = await hashPin('1234', 2000), b = await hashPin('1234', 2000);
  assert.notEqual(a.salt, b.salt); assert.notEqual(a.hash, b.hash);
  assert.ok(!JSON.stringify(a).includes('1234'));
  assert.equal(await verifyPin('1234', a), true);
  assert.equal(await verifyPin('1235', a), false);
  assert.equal(await verifyPin('', a), false);
  assert.equal(await verifyPin('1234', null), false);
  assert.equal(await verifyPin('1234', { salt: '!!', hash: '??', iterations: 5 }), false);
});

test('PIN: chỉ chấp nhận 4–8 chữ số', async () => {
  for (const bad of ['123', '123456789', 'abcd', '12 34', '١٢٣٤', '']) {
    assert.equal(PIN_RE.test(bad), false, bad);
    await assert.rejects(() => hashPin(bad, 1000));
  }
  assert.ok(PIN_RE.test('12345678'));
});

test('so sánh hằng thời gian đúng ngữ nghĩa', () => {
  assert.equal(constantTimeEqual(Uint8Array.of(1, 2), Uint8Array.of(1, 2)), true);
  assert.equal(constantTimeEqual(Uint8Array.of(1, 2), Uint8Array.of(1, 3)), false);
  assert.equal(constantTimeEqual(Uint8Array.of(1), Uint8Array.of(1, 2)), false);
});

test('khoá tạm: sau 5 lần sai khoá 60s, leo thang, thành công thì reset', () => {
  let p = { pin: null, failed: 0, lockedUntil: 0 };
  const t0 = 1_000_000;
  for (let i = 1; i <= 4; i++) { p = registerFailure(p, t0); assert.equal(isLocked(p, t0), false); }
  p = registerFailure(p, t0);
  assert.equal(isLocked(p, t0 + 59_000), true); assert.equal(isLocked(p, t0 + 60_001), false);
  for (let i = 0; i < 5; i++) p = registerFailure(p, t0 + 70_000);
  assert.equal(p.lockedUntil, t0 + 70_000 + 120_000);
  assert.equal(lockDuration(10 * 5), 60_000 * 16); // trần
  p = registerSuccess(p); assert.equal(p.failed, 0); assert.equal(isLocked(p, t0), false);
});

test('PlayClock: nhắc nghỉ sau 20 phút tương tác; bỏ máy treo không tính', () => {
  const c = new PlayClock({ breakMinutes: 20 });
  let now = 0; c.interact(now);
  for (let i = 0; i < 19 * 60; i++) { now += 1000; c.interact(now); }
  assert.equal(c.breakDue, false);
  for (let i = 0; i < 61; i++) { now += 1000; c.interact(now); }
  assert.equal(c.breakDue, true);
  c.acknowledgeBreak(); assert.equal(c.breakDue, false);

  const idle = new PlayClock({ breakMinutes: 10, idleMs: 60_000 });
  idle.interact(0);
  for (let t = 1000; t <= 3_600_000; t += 1000) idle.tick(t); // 1 giờ không chạm
  assert.equal(idle.breakDue, false);
  assert.ok(idle.activeMs <= 61_000);
});

test('PlayClock: drainMinutes và giới hạn breakMinutes; todayKey đúng định dạng', () => {
  const c = new PlayClock({ breakMinutes: 9999 });
  assert.equal(c.breakMs, 40 * 60_000);
  c.interact(0); for (let t = 1000; t <= 150_000; t += 1000) c.interact(t);
  assert.equal(c.drainMinutes(), 2); assert.ok(c.activeMs < 60_000);
  assert.match(todayKey(new Date(2026, 0, 5)), /^2026-01-05$/);
});
