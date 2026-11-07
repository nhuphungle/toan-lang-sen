import test from 'node:test';
import assert from 'node:assert/strict';
import { updateSkill, defaultSkill, hintLevel, UP_STREAK } from '../public/src/adaptive.js';
import { xpForAnswer, levelFromXp, buyItem, recordAnswer, newBadges, FARM_ITEMS, MAX_STACK, GROW_TOTAL_MS, growthStage, msUntilGrown, formatCountdown, harvest, harvestCoins, MAX_GIFT } from '../public/src/rewards.js';
import { defaultState } from '../public/src/storage.js';

test('đúng liên tiếp 5 -> lên mức; ở mức cao nhất -> mở thử thách', () => {
  let s = defaultSkill(), ev;
  for (let i = 0; i < UP_STREAK; i++) ({ state: s, event: ev } = updateSkill(s, true));
  assert.equal(ev, 'level-up'); assert.equal(s.level, 2);
  s = { level: 3, streak: 4, wrongStreak: 0 };
  assert.equal(updateSkill(s, true).event, 'challenge');
  assert.equal(updateSkill(s, true).state.level, 3);
});

test('sai 2 lần liên tiếp -> hạ mức và bật gợi ý hình; mức 1 không xuống thấp hơn', () => {
  let r = updateSkill({ level: 2, streak: 3, wrongStreak: 0 }, false);
  assert.equal(r.state.streak, 0); assert.equal(r.visualHints, true); assert.equal(r.event, 'none');
  r = updateSkill(r.state, false);
  assert.equal(r.event, 'level-down'); assert.equal(r.state.level, 1);
  r = updateSkill(updateSkill(r.state, false).state, false);
  assert.equal(r.state.level, 1);
});

test('đúng xen kẽ làm reset wrongStreak; không đột biến đầu vào', () => {
  const s = Object.freeze({ level: 2, streak: 1, wrongStreak: 1 });
  const r = updateSkill(s, true);
  assert.equal(r.state.wrongStreak, 0); assert.equal(s.streak, 1);
});

test('hintLevel: 0 khi chưa sai/chưa xin, tăng dần, tối đa 2', () => {
  assert.equal(hintLevel(1, 0), 0);
  assert.equal(hintLevel(2, 0), 1);
  assert.equal(hintLevel(3, 0), 2);
  assert.equal(hintLevel(9, 9), 2);
  assert.equal(hintLevel(0, 1), 0);
  assert.equal(hintLevel(0, 2), 1);
});

test('XP: sai=0, đúng theo độ khó, trừ gợi ý, tối thiểu 2', () => {
  assert.equal(xpForAnswer({ correct: false, difficulty: 3 }), 0);
  assert.equal(xpForAnswer({ correct: true, difficulty: 2 }), 20);
  assert.equal(xpForAnswer({ correct: true, difficulty: 1, hintsUsed: 1 }), 7);
  assert.equal(xpForAnswer({ correct: true, difficulty: 1, hintsUsed: 99 }), 2);
  assert.equal(levelFromXp(0), 1); assert.equal(levelFromXp(250), 3); assert.equal(levelFromXp(-5), 1);
});

test('mua vật phẩm: đủ xu, không đủ, đã có, không tồn tại; không đột biến', () => {
  const p = Object.freeze({ coins: 100, inventory: Object.freeze([]) });
  const ok = buyItem(p, FARM_ITEMS[0].id);
  assert.equal(ok.ok, true); assert.equal(ok.profile.coins, 100 - FARM_ITEMS[0].cost);
  assert.equal(buyItem(ok.profile, FARM_ITEMS[0].id).ok, true); // trứng mua được nhiều lần
  let rich = { coins: 1e6, inventory: [] };
  for (let i = 0; i < MAX_STACK; i++) rich = buyItem(rich, FARM_ITEMS[0].id).profile;
  assert.equal(buyItem(rich, FARM_ITEMS[0].id).reason, 'max-owned');
  const hat = FARM_ITEMS.find((i) => i.kind === 'wear');
  assert.equal(buyItem(buyItem(rich, hat.id).profile, hat.id).reason, 'owned'); // đồ mặc chỉ một
  assert.equal(buyItem({ coins: 0, inventory: [] }, FARM_ITEMS[0].id).reason, 'not-enough-coins');
  assert.equal(buyItem(p, '__proto__').reason, 'unknown-item');
  assert.equal(p.coins, 100);
});

test('huy hiệu: Thám Tử Hình Học, Bảng Nhãn Tốc Độ, Trạng Nguyên Nhí', () => {
  let st = defaultState().stats;
  for (let i = 0; i < 5; i++) st = recordAnswer(st, { correct: true, skill: 'space', topic: 'hinh-phang', elapsedMs: 1000, hintsUsed: 0 });
  const got = newBadges(st, []);
  assert.ok(got.includes('tham-tu-hinh-hoc')); assert.ok(got.includes('bang-nhan-toc-do'));
  assert.ok(!got.includes('trang-nguyen-nhi'));
  assert.deepEqual(newBadges(st, got), []); // không cấp lại
  for (let i = 0; i < 25; i++) st = recordAnswer(st, { correct: true, skill: 'calc', topic: 'dem-so', elapsedMs: 9000, hintsUsed: 0 });
  assert.ok(newBadges(st, got).includes('trang-nguyen-nhi'));
});

test('tốc độ: chậm, dùng gợi ý, hoặc sai đều reset chuỗi nhanh', () => {
  let st = defaultState().stats;
  const a = (o) => (st = recordAnswer(st, { skill: 'calc', topic: 'dem-so', ...o }));
  a({ correct: true, elapsedMs: 100, hintsUsed: 0 }); a({ correct: true, elapsedMs: 100, hintsUsed: 0 });
  a({ correct: true, elapsedMs: 100, hintsUsed: 1 });
  assert.equal(st.fastStreak, 0); assert.equal(st.bestFastStreak, 2);
  assert.equal(st.bySkill.calc.total, 3);
});

test('cây lớn hẳn sau 2 giờ, không bao giờ héo; vật không có giai đoạn luôn là 0', () => {
  const H = 3_600_000;
  const rice = FARM_ITEMS.find((i) => i.id === 'ruong-lua');      // 2 hình: 1 bước dài 2 giờ
  const banana = FARM_ITEMS.find((i) => i.id === 'cay-chuoi');    // 3 hình: 2 bước, mỗi bước 1 giờ
  assert.equal(GROW_TOTAL_MS, 2 * H);
  assert.equal(growthStage(rice, 1000, 1000), 0);
  assert.equal(growthStage(rice, 0, 2 * H - 1), 0);
  assert.equal(growthStage(rice, 0, 2 * H), rice.stages.length - 1);
  assert.equal(growthStage(banana, 0, H - 1), 0);
  assert.equal(growthStage(banana, 0, H), 1);
  assert.equal(growthStage(banana, 0, 2 * H), 2);
  assert.equal(growthStage(rice, 0, 99 * H), rice.stages.length - 1);
  assert.equal(growthStage(rice, 5000, 0), 0); // đồng hồ lùi: không âm
  assert.equal(msUntilGrown(rice, 0, 0), 2 * H);
  assert.equal(msUntilGrown(rice, 0, H), H);
  assert.equal(msUntilGrown(rice, 0, 3 * H), 0);
  assert.equal(msUntilGrown(rice, 5000, 0), 2 * H);  // đồng hồ lùi: không vượt tổng

});

test('đồng hồ đếm ngược: định dạng h:mm:ss / m:ss, làm tròn lên, không âm', () => {
  assert.equal(formatCountdown(2 * 3_600_000), '2:00:00');
  assert.equal(formatCountdown(3_600_000 + 5 * 60_000 + 7_000), '1:05:07');
  assert.equal(formatCountdown(59 * 60_000 + 59_000), '59:59');
  assert.equal(formatCountdown(9_001), '0:10');
  assert.equal(formatCountdown(1), '0:01');
  assert.equal(formatCountdown(0), '0:00');
  assert.equal(formatCountdown(-5000), '0:00');
});

test('thu hoạch: cây chín đổi xu hoặc quà, ô trống ra, cây rời kho; từ chối khi chưa chín/sai lựa chọn', () => {
  const rice = FARM_ITEMS.find((i) => i.id === 'ruong-lua');
  const chicken = FARM_ITEMS.find((i) => i.kind === 'egg');
  const mk = () => Object.freeze({ coins: 10, gifts: { 'gau-bong': 0, keo: 0 }, inventory: Object.freeze(['ruong-lua', 'ruong-lua', chicken.id]),
    farm: Object.freeze({ outfit: {}, slots: Object.freeze([{ id: 'ruong-lua', at: 0 }, { id: 'ruong-lua', at: 5 * GROW_TOTAL_MS }, { id: chicken.id, at: 0 }, null]) }) });
  const now = 2 * GROW_TOTAL_MS;
  const a = harvest(mk(), 0, 'coins', now);
  assert.equal(a.ok, true); assert.equal(a.profile.coins, 10 + harvestCoins(rice)); assert.equal(harvestCoins(rice), 30);
  assert.equal(a.profile.farm.slots[0], null); assert.deepEqual(a.profile.inventory, ['ruong-lua', chicken.id]);
  const g = harvest(mk(), 0, 'gau-bong', now);
  assert.equal(g.profile.gifts['gau-bong'], 1); assert.equal(g.profile.coins, 10);
  assert.equal(harvest(mk(), 1, 'coins', now).reason, 'not-ready');      // cây mới đặt chưa chín
  assert.equal(harvest(mk(), 2, 'coins', now).reason, 'not-plant');      // trứng (kể cả đã nở thành gà) không thu hoạch
  assert.equal(harvest(mk(), 3, 'coins', now).reason, 'not-plant');      // ô trống
  for (const bad of ['xu', '__proto__', 'constructor', undefined]) assert.equal(harvest(mk(), 0, bad, now).reason, 'bad-choice');
  const full = { ...mk(), gifts: { 'gau-bong': MAX_GIFT, keo: 0 } };
  assert.equal(harvest(full, 0, 'gau-bong', now).profile.gifts['gau-bong'], MAX_GIFT);
});
