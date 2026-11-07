import test from 'node:test';
import assert from 'node:assert/strict';
import { loadState, saveState, validateState, defaultState, sanitizeNickname, STORAGE_KEY, exportData, importData, clearState } from '../public/src/storage.js';

const mem = (init = {}) => { const m = new Map(Object.entries(init)); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k), m }; };

test('vòng lặp lưu/đọc giữ nguyên dữ liệu hợp lệ', () => {
  const s = defaultState(); s.xp = 120; s.coins = 50; s.profile = { nickname: 'Bé Na', avatar: 'bong' }; s.inventory = ['hoa-sen'];
  const st = mem(); assert.equal(saveState(st, s), true);
  assert.deepEqual(loadState(st), s);
});

test('JSON hỏng / quá lớn / sai version -> trạng thái mặc định, không throw', () => {
  assert.deepEqual(loadState(mem({ [STORAGE_KEY]: '{oops' })), defaultState());
  assert.deepEqual(loadState(mem({ [STORAGE_KEY]: JSON.stringify({ v: 2 }) })), defaultState());
  assert.deepEqual(loadState(mem({ [STORAGE_KEY]: 'x'.repeat(70_000) })), defaultState());
  assert.deepEqual(loadState({ getItem() { throw new Error('blocked'); } }), defaultState());
  assert.equal(saveState({ setItem() { throw new Error('quota'); } }, defaultState()), false);
});

test('dữ liệu bị sửa tay bị ép về giới hạn / allowlist', () => {
  const evil = { v: 1, xp: 1e30, coins: -5, inventory: ['trung-ga', 'trung-ga', 'hack', {}], badges: ['x'],
    profile: { nickname: '<img src=x onerror=alert(1)>', avatar: 'admin' },
    skills: { calc: { level: 99, streak: -3, wrongStreak: 'a' }, hack: { level: 3 } },
    stats: { totalCorrect: 5, totalAnswered: 2, bySkill: { calc: { total: 2, correct: 50 } } },
    daily: { '2026-01-01': 99999, 'bad': 5 }, settings: { breakMinutes: 9999, sound: 'x' },
    parent: { pin: { salt: 'not base64!!', hash: 'x', iterations: 1 }, failed: -1, lockedUntil: 'x' } };
  const s = validateState(evil);
  assert.equal(s.xp, 1e7); assert.equal(s.coins, 0);
  assert.deepEqual(s.inventory, ['trung-ga', 'trung-ga']); assert.deepEqual(s.badges, []);
  assert.equal(s.profile.nickname, 'img srcx onerroraler'); // đã bỏ < > = ( ) và cắt còn 20 ký tự
  assert.equal(s.skills.calc.level, 3); assert.equal(s.skills.calc.streak, 0); assert.equal('hack' in s.skills, false);
  assert.equal(s.stats.bySkill.calc.correct, 2);
  assert.deepEqual(s.daily, { '2026-01-01': 1440 });
  assert.equal(s.settings.breakMinutes, 40); assert.equal(s.parent.pin, null); assert.equal(s.parent.failed, 0);
});

test('chống prototype pollution qua JSON', () => {
  const raw = '{"v":1,"__proto__":{"polluted":true},"profile":{"__proto__":{"polluted2":true}},"skills":{"__proto__":{"level":3}},"daily":{"__proto__":5}}';
  loadState(mem({ [STORAGE_KEY]: raw }));
  assert.equal({}.polluted, undefined); assert.equal({}.polluted2, undefined);
  assert.equal(Object.prototype.level, undefined);
});

test('sanitizeNickname: giữ chữ Việt, bỏ ký tự đặc biệt, tối đa 20', () => {
  assert.equal(sanitizeNickname('  Bông   Sen  '), 'Bông Sen');
  assert.equal(sanitizeNickname('Nghé<script>'), 'Nghéscript');
  assert.equal(sanitizeNickname('a'.repeat(50)).length, 20);
  assert.equal(sanitizeNickname(123), ''); assert.equal(sanitizeNickname(null), '');
});

test('exportData không lộ băm PIN; clearState xoá sạch', () => {
  const s = defaultState(); s.parent.pin = { salt: 'AAAAAAAAAAAAAAAA', hash: 'BBBBBBBBBBBBBBBB', iterations: 150000 };
  const out = exportData(s);
  assert.ok(!out.includes('BBBBBBBB') && !out.includes('AAAAAAAA')); assert.ok(JSON.parse(out).parent.hasPin);
  const st = mem(); saveState(st, s); assert.equal(clearState(st), true); assert.equal(st.getItem(STORAGE_KEY), null);
});

test('importData: khôi phục từ exportData, giữ PIN thiết bị, từ chối tệp xấu', () => {
  const a = defaultState(); a.xp = 123; a.profile.nickname = 'Sen';
  a.parent.pin = { salt: 'AAAAAAAAAAAAAAAA', hash: 'BBBBBBBBBBBBBBBB', iterations: 150000 };
  const b = defaultState(); b.parent.pin = { salt: 'CCCCCCCCCCCCCCCC', hash: 'DDDDDDDDDDDDDDDD', iterations: 150000 };
  const out = importData(exportData(a), b);
  assert.equal(out.xp, 123); assert.equal(out.profile.nickname, 'Sen');
  assert.deepEqual(out.parent, b.parent);
  for (const bad of ['', 'not json', '[]', '{"v":2}', 'x'.repeat(70 * 1024), null]) assert.equal(importData(bad, b), null);
});

test('nông trại: ô đất và đồ mặc luôn nhất quán với kho; chặn dữ liệu bẩn', () => {
  const raw = { v: 1, inventory: ['trung-ga', 'non-la', 'non-la', ...Array(10).fill('ruong-lua')],
    farm: { slots: [{ id: 'trung-ga', at: 5 }, { id: 'trung-ga', at: 5 }, { id: 'ao-ba-ba', at: 1 }, { id: 'hack' }, null, 'x', ...Array(20).fill({ id: 'ruong-lua', at: -9 })],
      outfit: { hat: 'ao-ba-ba', top: 'ao-ba-ba' } } };
  const s = validateState(raw);
  assert.equal(s.inventory.filter((x) => x === 'non-la').length, 1);       // đồ mặc chỉ một
  assert.equal(s.inventory.filter((x) => x === 'ruong-lua').length, 6);    // tối đa 6 mỗi loại
  assert.equal(s.farm.slots.length, 12);
  assert.equal(s.farm.slots.filter((x) => x && x.id === 'trung-ga').length, 1); // chỉ đặt số đã mua
  assert.equal(s.farm.slots.filter((x) => x && x.id === 'ruong-lua').length, 6);
  assert.ok(!s.farm.slots.some((x) => x && (x.id === 'ao-ba-ba' || x.id === 'hack')));
  assert.deepEqual(s.farm.outfit, { hat: null, top: null });                // chưa mua áo thì không mặc được
  const ok = validateState({ v: 1, inventory: ['ao-ba-ba', 'non-la'], farm: { outfit: { hat: 'non-la', top: 'ao-ba-ba' } } });
  assert.deepEqual(ok.farm.outfit, { hat: 'non-la', top: 'ao-ba-ba' });
  assert.deepEqual(validateState({ v: 1, inventory: ['trung-ga'] }).farm.slots, Array(12).fill(null)); // save cũ vẫn đọc được
});

test('kho quà: chỉ id hợp lệ, số lượng bị kẹp, save cũ không có quà vẫn đọc được', () => {
  const s = validateState({ v: 1, gifts: { 'gau-bong': 5, keo: 1e9, hack: 3, __proto__: { x: 1 } } });
  assert.deepEqual(s.gifts, { 'gau-bong': 5, keo: 999 });
  assert.deepEqual(validateState({ v: 1 }).gifts, { 'gau-bong': 0, keo: 0 });
  assert.deepEqual(validateState({ v: 1, gifts: 'x' }).gifts, { 'gau-bong': 0, keo: 0 });
  const a = defaultState(); a.gifts.keo = 4;
  assert.equal(importData(exportData(a), defaultState()).gifts.keo, 4);   // sao lưu mang theo quà
});

test('save cũ: "ga-trong" đổi thành trứng gà đã nở sẵn, không mất vật phẩm', () => {
  const s = validateState({ v: 1, inventory: ['ga-trong', 'ga-trong', 'non-la'],
    farm: { slots: [{ id: 'ga-trong', at: 123 }, null, { id: 'trung-ga', at: 456 }, { id: 'trung-ga', at: 789 }] } });
  assert.deepEqual(s.inventory, ['trung-ga', 'trung-ga', 'non-la']);
  assert.deepEqual(s.farm.slots[0], { id: 'trung-ga', at: 0 });     // gà cũ coi như đã nở từ lâu
  assert.deepEqual(s.farm.slots[2], { id: 'trung-ga', at: 456 });    // trứng mới giữ nguyên thời điểm đặt
  assert.equal(s.farm.slots[3], null);                               // chỉ có 2 trứng, không đặt quá số đã mua
  assert.equal(validateState({ v: 1, inventory: ['__proto__', 'constructor', 'toString'] }).inventory.length, 0);
});
