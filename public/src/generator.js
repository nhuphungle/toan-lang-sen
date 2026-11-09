// Sinh câu hỏi từ template và chấm điểm. Hàm thuần: cùng (template, rng) -> cùng câu hỏi.
import { randInt, pick, shuffle } from './rng.js';
import { SHAPE_LABEL } from './content-schema.js';

const NAMES = ['Lan', 'Nam', 'Minh', 'Hoa', 'Tí', 'Mai', 'An', 'Bình', 'Cúc', 'Dũng'];

function fill(text, vars) {
  return text.replace(/\{(a|b|c|name|result|who|step)\}/g, (_, k) => String(vars[k] ?? ''));
}

/** Mỗi lần sinh chọn ngẫu nhiên một câu văn, một vật và một tên bạn nhỏ -> bớt cảm giác lặp. */
function variant(t, rng) {
  const text = t.texts ? pick(rng, t.texts) : t.text;
  const item = t.items ? pick(rng, t.items) : t.item;
  return { text, item, who: pick(rng, NAMES) };
}

function numericChoices(rng, answer, maxVal) {
  const pool = [];
  for (let d = -3; d <= 3; d++) {
    const v = answer + d;
    if (d !== 0 && v >= 0 && v <= maxVal) pool.push(v);
  }
  // luôn đủ 3 nhiễu: nếu thiếu thì nới biên trên
  for (let v = answer + 4; pool.length < 3; v++) pool.push(v);
  const distractors = shuffle(rng, pool).slice(0, 3);
  return shuffle(rng, [answer, ...distractors]).map((n) => ({ id: String(n), label: String(n) }));
}

/** Chọn (a,b) hợp lệ cho add/sub; thử vài lần rồi rơi về cặp nhỏ nhất hợp lệ. */
function pickPair(rng, t) {
  for (let i = 0; i < 50; i++) {
    const a = randInt(rng, t.a.min, t.a.max);
    const b = randInt(rng, t.b.min, t.b.max);
    if (t.op === 'add' && a + b <= t.maxResult) return [a, b];
    if (t.op === 'sub' && a >= b && a <= t.maxResult) return [a, b];
  }
  // fallback xác định
  if (t.op === 'add') return [t.a.min, t.b.min];
  return [Math.max(t.a.max, t.b.min), t.b.min];
}

/**
 * @param {object} t template đã validate
 * @param {() => number} rng
 */
export function generateQuestion(t, rng) {
  const base = {
    templateId: t.id,
    type: t.type,
    skill: t.skill,
    topic: t.topic,
    difficulty: t.difficulty,
    valueTag: t.value_tag,
  };

  const v = variant(t, rng);
  const hints = (vars) => t.hints.map((h) => fill(h, vars));

  if (t.op === 'count') {
    const a = randInt(rng, t.a.min, t.a.max);
    const vars = { a, name: v.item.name, who: v.who, result: a };
    const q = { ...base, text: fill(v.text, vars), emoji: v.item.emoji, count: a, hints: hints(vars) };
    if (t.type === 'basket') return { ...q, answer: a, basketMax: Math.max(a + 3, 5) };
    return { ...q, answer: a, choices: numericChoices(rng, a, Math.max(a + 3, 10)) };
  }

  if (t.op === 'add' || t.op === 'sub') {
    const [a, b] = pickPair(rng, t);
    const result = t.op === 'add' ? a + b : a - b;
    const askB = t.ask === 'b'; // dạng "tìm số còn thiếu": đề cho a và kết quả, hỏi b
    const answer = askB ? b : result;
    const vars = { a, b, name: v.item.name, result, who: v.who };
    const q = {
      ...base,
      text: fill(v.text, vars),
      emoji: v.item.emoji,
      answer,
      choices: numericChoices(rng, answer, t.maxResult),
      hints: hints(vars),
    };
    if (!askB) q.groups = t.op === 'add' ? [a, b] : [a, -b]; // trực quan: nhóm đầu, nhóm thêm/bớt (không lộ đáp án)
    return q;
  }

  if (t.op === 'compare') {
    const nums = shuffle(rng, Array.from({ length: t.a.max - t.a.min + 1 }, (_, i) => t.a.min + i)).slice(0, 3);
    const answer = t.ask === 'max' ? Math.max(...nums) : Math.min(...nums);
    const vars = { a: nums[0], b: nums[1], c: nums[2], result: answer, who: v.who };
    return {
      ...base,
      text: fill(v.text, vars),
      answer,
      choices: nums.map((n) => ({ id: String(n), label: String(n) })),
      hints: hints(vars),
    };
  }

  if (t.op === 'sign') {
    const a = randInt(rng, t.a.min, t.a.max);
    const b = rng() < 0.25 ? a : pick(rng, Array.from({ length: t.a.max - t.a.min + 1 }, (_, i) => t.a.min + i).filter((n) => n !== a));
    const answer = a > b ? 'gt' : a < b ? 'lt' : 'eq';
    const vars = { a, b, who: v.who, result: answer === 'gt' ? '>' : answer === 'lt' ? '<' : '=' };
    return {
      ...base,
      text: fill(v.text, vars),
      answer,
      choices: [{ id: 'lt', label: '<' }, { id: 'eq', label: '=' }, { id: 'gt', label: '>' }],
      hints: hints(vars),
    };
  }

  if (t.op === 'neighbor') {
    const a = randInt(rng, t.a.min, t.a.max);
    const answer = t.ask === 'next' ? a + 1 : a - 1;
    const vars = { a, result: answer, who: v.who };
    return { ...base, text: fill(v.text, vars), answer, choices: numericChoices(rng, answer, t.a.max + 1), hints: hints(vars) };
  }

  if (t.op === 'sequence') {
    const sign = t.dir === 'up' ? 1 : -1;
    let a = null;
    let s = null;
    for (let i = 0; i < 50 && a === null; i++) {
      const ca = randInt(rng, t.a.min, t.a.max);
      const cs = randInt(rng, t.step.min, t.step.max);
      const last = ca + sign * 3 * cs;
      if (last >= 0 && last <= t.maxResult) { a = ca; s = cs; }
    }
    if (a === null) { a = sign > 0 ? t.a.min : t.a.max; s = t.step.min; } // fallback xác định (đã validate tồn tại)
    const answer = a + sign * 3 * s;
    const vars = { a, b: a + sign * s, c: a + sign * 2 * s, result: answer, who: v.who, step: s };
    return { ...base, text: fill(v.text, vars), answer, choices: numericChoices(rng, answer, t.maxResult), hints: hints(vars) };
  }

  // op === 'shape'
  if (t.type === 'classify') {
    const kinds = [...new Set(t.shapes.map((s) => s.shape))];
    // lấy mẫu có đủ ≥2 loại
    let items;
    do {
      items = shuffle(rng, t.shapes).slice(0, Math.min(4, t.shapes.length));
    } while (new Set(items.map((s) => s.shape)).size < 2);
    const buckets = kinds.filter((k) => items.some((i) => i.shape === k));
    return {
      ...base,
      text: fill(v.text, { who: v.who }),
      items: items.map((i) => ({ emoji: i.emoji, name: i.name, shape: i.shape })),
      buckets: buckets.map((k) => ({ id: k, label: SHAPE_LABEL[k] })),
      answer: items.map((i) => i.shape),
      hints: hints({}),
    };
  }
  const s = pick(rng, t.shapes);
  const kinds = [...new Set(t.shapes.map((x) => x.shape))];
  return {
    ...base,
    text: fill(v.text, { name: s.name, who: v.who }),
    emoji: s.emoji,
    answer: s.shape,
    choices: shuffle(rng, kinds).map((k) => ({ id: k, label: SHAPE_LABEL[k] })),
    hints: hints({ name: s.name }),
  };
}

/**
 * Chấm điểm. `response`:
 *  - choice: id đã chọn (string)
 *  - basket: số vật đã xếp (number)
 *  - classify: mảng shape người chơi gán cho từng item (string[])
 */
export function checkAnswer(q, response) {
  switch (q.type) {
    case 'choice':
      return typeof response === 'string' && response === String(q.answer);
    case 'basket':
      return Number.isInteger(response) && response === q.answer;
    case 'classify':
      return (
        Array.isArray(response) &&
        response.length === q.answer.length &&
        response.every((r, i) => r === q.answer[i])
      );
    default:
      return false;
  }
}

/**
 * Tạo phiên học. Ưu tiên template đúng độ khó; thiếu thì lấy độ khó gần nhất.
 * Tránh lặp template liên tiếp.
 */
export function generateSession(templates, { grade = 1, level = 1, count = 8, rng, skillLevels = null }) {
  const pool = templates.filter((t) => t.grade === grade);
  if (pool.length === 0) return [];
  const out = [];
  const used = new Map(); // số lần mỗi template đã xuất hiện trong phiên này
  let prev = null;
  for (let i = 0; i < count; i++) {
    const levelFor = (t) => (skillLevels && skillLevels[t.skill]) || level;
    const scored = pool.map((t) => ({ t, d: Math.abs(t.difficulty - levelFor(t)) }));
    const best = Math.min(...scored.map((s) => s.d));
    let cands = scored.filter((s) => s.d === best).map((s) => s.t);
    // Đa dạng: không lặp template liền kề, ưu tiên chủ đề khác câu trước, rồi template ít dùng nhất.
    const nonRepeat = cands.filter((t) => t.id !== prev?.id);
    if (nonRepeat.length) cands = nonRepeat;
    const otherTopic = cands.filter((t) => t.topic !== prev?.topic);
    if (otherTopic.length) cands = otherTopic;
    const fewest = Math.min(...cands.map((t) => used.get(t.id) ?? 0));
    cands = cands.filter((t) => (used.get(t.id) ?? 0) === fewest);
    const t = pick(rng, cands);
    prev = t;
    used.set(t.id, (used.get(t.id) ?? 0) + 1);
    out.push(generateQuestion(t, rng));
  }
  return out;
}
