// Lưu trạng thái cục bộ. NGUYÊN TẮC: dữ liệu trong localStorage là KHÔNG ĐÁNG TIN.
// validateState dựng object mới từ allowlist, ép kiểu và giới hạn; không merge/spread dữ liệu thô
// (tránh prototype pollution).
import { AVATARS, ITEM_IDS, BADGE_IDS, FARM_SLOTS, findItem, ownLimit, GIFT_IDS, MAX_GIFT, emptyGifts, canonicalId, LEGACY_ITEM_IDS } from './rewards.js';
import { SKILLS } from './content-schema.js';
import { defaultSkill, MAX_LEVEL } from './adaptive.js';

export const STORAGE_KEY = 'tls.v1';
export const MAX_RAW_BYTES = 64 * 1024;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const B64_RE = /^[A-Za-z0-9+/]{8,200}={0,2}$/;

const isObj = (o) => o !== null && typeof o === 'object' && !Array.isArray(o);
const clampInt = (n, lo, hi, dflt) => (Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.trunc(n))) : dflt);

export function sanitizeNickname(s) {
  if (typeof s !== 'string') return '';
  // chỉ chữ (mọi ngôn ngữ), số, khoảng trắng; gộp khoảng trắng; tối đa 20 ký tự
  return s.normalize('NFC').replace(/[^\p{L}\p{N} ]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 20);
}

export function defaultState() {
  return {
    v: 1,
    profile: { nickname: '', avatar: AVATARS[0] },
    xp: 0,
    coins: 0,
    inventory: [],
    gifts: emptyGifts(),
    farm: { slots: Array(FARM_SLOTS).fill(null), outfit: { hat: null, top: null } },
    badges: [],
    skills: Object.fromEntries(SKILLS.map((s) => [s, defaultSkill()])),
    stats: {
      totalAnswered: 0,
      totalCorrect: 0,
      shapeCorrect: 0,
      fastStreak: 0,
      bestFastStreak: 0,
      lessonsDone: 0,
      bySkill: Object.fromEntries(SKILLS.map((s) => [s, { correct: 0, total: 0 }])),
    },
    daily: {}, // 'YYYY-MM-DD' -> phút học
    settings: { sound: true, breakMinutes: 20 },
    parent: { pin: null, failed: 0, lockedUntil: 0 },
  };
}

/** Kho đồ: chỉ id hợp lệ, mỗi loại không vượt giới hạn sở hữu (vật nuôi/cây trồng được trùng, đồ mặc thì một). */
function sanitizeInventory(raw) {
  if (!Array.isArray(raw)) return [];
  const counts = new Map();
  const out = [];
  for (const rawId of raw.slice(0, 200)) {
    const x = canonicalId(rawId);
    if (typeof x !== 'string' || !ITEM_IDS.includes(x)) continue;
    const n = counts.get(x) || 0;
    if (n >= ownLimit(findItem(x))) continue;
    counts.set(x, n + 1);
    out.push(x);
  }
  return out;
}

/** Nông trại: ô đất và đồ đang mặc, luôn nhất quán với kho (không đặt/mặc thứ chưa mua). */
function sanitizeFarm(raw, inventory) {
  const farm = defaultState().farm;
  if (!isObj(raw)) return farm;
  const free = new Map();
  for (const id of inventory) free.set(id, (free.get(id) || 0) + 1);
  if (Array.isArray(raw.slots)) {
    for (let i = 0; i < FARM_SLOTS; i++) {
      const s = raw.slots[i];
      if (!isObj(s) || typeof s.id !== 'string') continue;
      const legacy = Object.hasOwn(LEGACY_ITEM_IDS, s.id); // gà trống cũ: coi như đã nở từ lâu (at = 0)
      const id = canonicalId(s.id);
      if (!ITEM_IDS.includes(id)) continue;
      const item = findItem(id);
      if (item.kind === 'wear' || !free.get(id)) continue;
      free.set(id, free.get(id) - 1);
      farm.slots[i] = { id, at: legacy ? 0 : clampInt(s.at, 0, 8.64e15, 0) };
    }
  }
  const o = isObj(raw.outfit) ? raw.outfit : {};
  for (const slot of ['hat', 'top']) {
    const item = typeof o[slot] === 'string' && ITEM_IDS.includes(o[slot]) ? findItem(o[slot]) : null;
    if (item && item.kind === 'wear' && item.slot === slot && inventory.includes(item.id)) farm.outfit[slot] = item.id;
  }
  return farm;
}

/** @returns {object|null} state chuẩn hoá, hoặc null nếu cấu trúc gốc sai. */
export function validateState(raw) {
  if (!isObj(raw) || raw.v !== 1) return null;
  const d = defaultState();

  const prof = isObj(raw.profile) ? raw.profile : {};
  d.profile.nickname = sanitizeNickname(prof.nickname);
  d.profile.avatar = AVATARS.includes(prof.avatar) ? prof.avatar : AVATARS[0];

  d.xp = clampInt(raw.xp, 0, 1e7, 0);
  d.coins = clampInt(raw.coins, 0, 1e7, 0);
  d.inventory = sanitizeInventory(raw.inventory);
  d.farm = sanitizeFarm(raw.farm, d.inventory);
  if (isObj(raw.gifts)) for (const id of GIFT_IDS) d.gifts[id] = clampInt(raw.gifts[id], 0, MAX_GIFT, 0);
  d.badges = Array.isArray(raw.badges) ? [...new Set(raw.badges.filter((x) => BADGE_IDS.includes(x)))] : [];

  const sk = isObj(raw.skills) ? raw.skills : {};
  for (const s of SKILLS) {
    const r = isObj(sk[s]) ? sk[s] : {};
    d.skills[s] = {
      level: clampInt(r.level, 1, MAX_LEVEL, 1),
      streak: clampInt(r.streak, 0, 100, 0),
      wrongStreak: clampInt(r.wrongStreak, 0, 100, 0),
    };
  }

  const st = isObj(raw.stats) ? raw.stats : {};
  for (const k of ['totalAnswered', 'totalCorrect', 'shapeCorrect', 'fastStreak', 'bestFastStreak', 'lessonsDone']) {
    d.stats[k] = clampInt(st[k], 0, 1e7, 0);
  }
  const by = isObj(st.bySkill) ? st.bySkill : {};
  for (const s of SKILLS) {
    const r = isObj(by[s]) ? by[s] : {};
    const total = clampInt(r.total, 0, 1e7, 0);
    d.stats.bySkill[s] = { total, correct: Math.min(total, clampInt(r.correct, 0, 1e7, 0)) };
  }

  if (isObj(raw.daily)) {
    // giữ tối đa 60 ngày gần nhất
    const keys = Object.keys(raw.daily).filter((k) => DATE_RE.test(k)).sort().slice(-60);
    for (const k of keys) d.daily[k] = clampInt(raw.daily[k], 0, 24 * 60, 0);
  }

  const se = isObj(raw.settings) ? raw.settings : {};
  d.settings.sound = se.sound !== false;
  d.settings.breakMinutes = clampInt(se.breakMinutes, 10, 40, 20);

  const pa = isObj(raw.parent) ? raw.parent : {};
  d.parent.failed = clampInt(pa.failed, 0, 1000, 0);
  d.parent.lockedUntil = clampInt(pa.lockedUntil, 0, 8.64e15, 0);
  const p = pa.pin;
  if (
    isObj(p) &&
    typeof p.salt === 'string' && B64_RE.test(p.salt) &&
    typeof p.hash === 'string' && B64_RE.test(p.hash) &&
    Number.isInteger(p.iterations) && p.iterations >= 1000 && p.iterations <= 1e6
  ) {
    d.parent.pin = { salt: p.salt, hash: p.hash, iterations: p.iterations };
  }
  return d;
}

export function loadState(storage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw || raw.length > MAX_RAW_BYTES) return defaultState();
    return validateState(JSON.parse(raw)) ?? defaultState();
  } catch {
    return defaultState();
  }
}

export function saveState(storage, state) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false; // đầy bộ nhớ / chế độ riêng tư: app vẫn chạy, chỉ không lưu
  }
}

export function clearState(storage) {
  try {
    storage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

/** Dữ liệu xuất cho phụ huynh: không gồm băm PIN. */
export function exportData(state) {
  const { parent, ...rest } = state;
  return JSON.stringify({ ...rest, parent: { hasPin: !!parent.pin } }, null, 2);
}

/**
 * Nhập tệp sao lưu (do exportData tạo). Tệp là dữ liệu KHÔNG ĐÁNG TIN: giới hạn kích thước, parse an toàn,
 * rồi đi qua validateState. PIN phụ huynh của thiết bị hiện tại được giữ nguyên (tệp xuất không chứa PIN).
 * @returns {object|null} state mới, hoặc null nếu tệp không hợp lệ.
 */
export function importData(text, current) {
  if (typeof text !== 'string' || text.length === 0 || text.length > MAX_RAW_BYTES) return null;
  let raw;
  try { raw = JSON.parse(text); } catch { return null; }
  const next = validateState(raw);
  if (!next) return null;
  next.parent = current.parent;
  return next;
}
