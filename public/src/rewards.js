// XP, xu, vật phẩm nông trại, huy hiệu (FR6).

export const AVATARS = ['nghe-con', 'be-ti', 'bong'];
export const AVATAR_INFO = {
  'nghe-con': { name: 'Nghé Con', emoji: '🐃' },
  'be-ti': { name: 'Bé Tí', emoji: '🧒' },
  bong: { name: 'Bông', emoji: '👧' },
};

// Mỗi loại cây có hình riêng ở từng giai đoạn; số giai đoạn khác nhau nên tốc độ lớn cũng khác (tổng 2 giờ).
// kind: plant (lớn dần qua `stages`, chín hẳn thì tính vào đổi quà) | egg (ấp qua `stages`, nở thành `hatchName`, cũng tính vào đổi quà)
//       | wear (mặc cho nhân vật, theo `slot`).
// Animal/plant mua được nhiều lần (tối đa MAX_STACK); wear chỉ có một.
export const FARM_ITEMS = [
  { id: 'trung-ga', name: 'Trứng gà', emoji: '🥚', cost: 30, kind: 'egg', stages: ['🥚', '🐓'], hatchName: 'Gà trống' },
  { id: 'cay-chuoi', name: 'Cây chuối', emoji: '🍌', cost: 40, kind: 'plant', stages: ['🌱', '🌴', '🍌'] },
  { id: 'ruong-lua', name: 'Ruộng lúa', emoji: '🌾', cost: 60, kind: 'plant', stages: ['🌿', '🌾'] },
  { id: 'hoa-sen', name: 'Hoa sen', emoji: '🪷', cost: 80, kind: 'plant', stages: ['🍃', '🪷'] },
  { id: 'ao-ba-ba', name: 'Áo bà ba', emoji: '👘', cost: 120, kind: 'wear', slot: 'top' },
  { id: 'non-la', name: 'Nón lá', emoji: '👒', cost: 150, kind: 'wear', slot: 'hat' },
];
export const ITEM_IDS = FARM_ITEMS.map((i) => i.id);
// Save cũ: "Chú gà trống" đã đổi thành trứng gà. Gà đã mua/đặt được giữ nguyên là gà (xem storage.js).
export const LEGACY_ITEM_IDS = { 'ga-trong': 'trung-ga' };
export const canonicalId = (id) => (typeof id === 'string' && Object.hasOwn(LEGACY_ITEM_IDS, id) ? LEGACY_ITEM_IDS[id] : id);
export const findItem = (id) => FARM_ITEMS.find((i) => i.id === id);

export const FARM_SLOTS = 12; // số ô đất trong nông trại
export const MAX_STACK = 6; // tối đa mỗi loại vật nuôi/cây trồng
export const GROW_TOTAL_MS = 2 * 3_600_000; // mọi cây mất 2 giờ để lớn hẳn (chỉ lớn thêm, không bao giờ héo)
export const ownLimit = (item) => (item.kind === 'wear' ? 1 : MAX_STACK);
export const countOf = (inventory, id) => inventory.filter((x) => x === id).length;

/** Thời lượng mỗi giai đoạn: chia đều GROW_TOTAL_MS cho các bước lớn của cây (chuối 3 hình = 2 bước x 1 giờ). */
export const stageMs = (item) => GROW_TOTAL_MS / Math.max(1, item.stages.length - 1);

/** Giai đoạn lớn/ấp (0..stages.length-1) của cây đặt từ thời điểm `at` (ms). Vật không có stages luôn là 0. */
export function growthStage(item, at, now) {
  if (!item || !item.stages) return 0;
  const n = Math.floor(Math.max(0, now - at) / stageMs(item));
  return Math.min(item.stages.length - 1, n);
}

/** Số ms còn lại tới khi cây lớn hẳn (0 nếu đã lớn hoặc không phải cây). */
export function msUntilGrown(item, at, now) {
  if (!item || !item.stages) return 0;
  return Math.min(GROW_TOTAL_MS, Math.max(0, GROW_TOTAL_MS - (now - at)));
}

/** "1:59:30" (từ 1 giờ trở lên) hoặc "9:05" (dưới 1 giờ). Làm tròn lên để không hiện 0:00 khi cây chưa chín. */
export function formatCountdown(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

// Quà bé đổi được khi lấp đầy nông trại bằng cây/gà đã lớn (xem exchangeGift). Chỉ để sưu tầm trong "Kho quà của bé".
export const GIFTS = [
  { id: 'gau-bong', name: 'Gấu bông', emoji: '🧸' },
  { id: 'keo', name: 'Kẹo', emoji: '🍬' },
];
export const GIFT_IDS = GIFTS.map((g) => g.id);
export const MAX_GIFT = 999;
export const emptyGifts = () => Object.fromEntries(GIFT_IDS.map((id) => [id, 0]));

export const isGrown = (item, at, now) => !!item.stages && growthStage(item, at, now) === item.stages.length - 1;

/** Tình trạng nông trại: số ô đã đặt và số ô đã lớn hẳn (cây chín, trứng đã nở thành gà). */
export function farmProgress(p, now) {
  let placed = 0;
  let grown = 0;
  for (let i = 0; i < FARM_SLOTS; i++) {
    const slot = p.farm.slots[i];
    const item = slot && findItem(slot.id);
    if (!item) continue;
    placed += 1;
    if (isGrown(item, slot.at, now)) grown += 1;
  }
  return { placed, grown, total: FARM_SLOTS, full: placed === FARM_SLOTS, ready: placed === FARM_SLOTS && grown === FARM_SLOTS };
}

/**
 * Đổi quà: chỉ khi CẢ nông trại đã đầy (mọi ô có cây hoặc gà) và mọi cây đã chín, mọi trứng đã nở.
 * Đổi 1 món quà, toàn bộ ô đất trống ra và các vật đó rời kho (nên phải mua lại). Không đột biến đầu vào.
 */
export function exchangeGift(p, choice, now) {
  if (!GIFT_IDS.includes(choice)) return { ok: false, reason: 'bad-choice' };
  const prog = farmProgress(p, now);
  if (!prog.full) return { ok: false, reason: 'not-full' };
  if (!prog.ready) return { ok: false, reason: 'not-ready' };
  const inventory = p.inventory.slice();
  for (let i = 0; i < FARM_SLOTS; i++) {
    const at = inventory.indexOf(p.farm.slots[i].id);
    if (at >= 0) inventory.splice(at, 1);
  }
  const gifts = { ...p.gifts, [choice]: Math.min(MAX_GIFT, (p.gifts[choice] || 0) + 1) };
  return { ok: true, profile: { ...p, gifts, inventory, farm: { ...p.farm, slots: new Array(FARM_SLOTS).fill(null) } } };
}

export const BADGES = [
  { id: 'trang-nguyen-nhi', name: 'Trạng Nguyên Nhí', emoji: '🎓', desc: 'Trả lời đúng 30 câu', test: (s) => s.totalCorrect >= 30 },
  { id: 'bang-nhan-toc-do', name: 'Bảng Nhãn Tốc Độ', emoji: '⚡', desc: '3 câu đúng liên tiếp, mỗi câu dưới 6 giây, không xin gợi ý', test: (s) => s.bestFastStreak >= 3 },
  { id: 'tham-tu-hinh-hoc', name: 'Thám Tử Hình Học', emoji: '🔍', desc: 'Đúng 5 câu về hình', test: (s) => s.shapeCorrect >= 5 },
  { id: 'buoc-dau', name: 'Bước Chân Đầu Tiên', emoji: '👣', desc: 'Hoàn thành bài học đầu tiên', test: (s) => s.lessonsDone >= 1 },
];
export const BADGE_IDS = BADGES.map((b) => b.id);

export const FAST_MS = 6000;
export const LEVEL_XP = 100;

/** XP cho một câu. Sai = 0. Xin gợi ý bị trừ; tối thiểu 2 nếu đúng. */
export function xpForAnswer({ correct, difficulty, hintsUsed = 0 }) {
  if (!correct) return 0;
  return Math.max(2, 10 * difficulty - 3 * hintsUsed);
}

export const levelFromXp = (xp) => 1 + Math.floor(Math.max(0, xp) / LEVEL_XP);

/** Mua vật phẩm. Trả về {ok, profile|reason}. Không đột biến đầu vào. */
export function buyItem(p, itemId) {
  const item = findItem(itemId);
  if (!item) return { ok: false, reason: 'unknown-item' };
  const have = countOf(p.inventory, itemId);
  if (have >= ownLimit(item)) return { ok: false, reason: item.kind === 'wear' ? 'owned' : 'max-owned' };
  if (p.coins < item.cost) return { ok: false, reason: 'not-enough-coins' };
  return { ok: true, profile: { ...p, coins: p.coins - item.cost, inventory: [...p.inventory, itemId] } };
}

/** Cập nhật thống kê sau một câu. */
export function recordAnswer(stats, { correct, skill, topic, elapsedMs, hintsUsed }) {
  const by = { ...stats.bySkill };
  const cur = by[skill] || { correct: 0, total: 0 };
  by[skill] = { correct: cur.correct + (correct ? 1 : 0), total: cur.total + 1 };
  const fast = correct && hintsUsed === 0 && elapsedMs < FAST_MS;
  const fastStreak = fast ? stats.fastStreak + 1 : 0;
  return {
    ...stats,
    totalAnswered: stats.totalAnswered + 1,
    totalCorrect: stats.totalCorrect + (correct ? 1 : 0),
    shapeCorrect: stats.shapeCorrect + (correct && topic === 'hinh-phang' ? 1 : 0),
    fastStreak,
    bestFastStreak: Math.max(stats.bestFastStreak, fastStreak),
    bySkill: by,
  };
}

/** Trả về id huy hiệu mới đạt (chưa có trong `earned`). */
export function newBadges(stats, earned) {
  return BADGES.filter((b) => !earned.includes(b.id) && b.test(stats)).map((b) => b.id);
}
