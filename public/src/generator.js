// Sinh câu hỏi từ template và chấm điểm. Hàm thuần: cùng (template, rng) -> cùng câu hỏi.
import { randInt, pick, shuffle } from './rng.js';
import { SHAPE_LABEL } from './content-schema.js';

function fill(text, vars) {
  return text.replace(/\{(a|b|name|result)\}/g, (_, k) => String(vars[k] ?? ''));
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

  if (t.op === 'count') {
    const a = randInt(rng, t.a.min, t.a.max);
    const vars = { a, name: t.item.name };
    const q = { ...base, text: fill(t.text, vars), emoji: t.item.emoji, count: a, hints: t.hints.map((h) => fill(h, vars)) };
    if (t.type === 'basket') return { ...q, answer: a, basketMax: Math.max(a + 3, 5) };
    return { ...q, answer: a, choices: numericChoices(rng, a, Math.max(a + 3, 10)) };
  }

  if (t.op === 'add' || t.op === 'sub') {
    const [a, b] = pickPair(rng, t);
    const result = t.op === 'add' ? a + b : a - b;
    const vars = { a, b, name: t.item.name, result };
    return {
      ...base,
      text: fill(t.text, vars),
      emoji: t.item.emoji,
      groups: t.op === 'add' ? [a, b] : [a, -b], // trực quan: nhóm đầu, nhóm thêm/bớt
      answer: result,
      choices: numericChoices(rng, result, t.maxResult),
      hints: t.hints.map((h) => fill(h, vars)),
    };
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
      text: fill(t.text, {}),
      items: items.map((i) => ({ emoji: i.emoji, name: i.name, shape: i.shape })),
      buckets: buckets.map((k) => ({ id: k, label: SHAPE_LABEL[k] })),
      answer: items.map((i) => i.shape),
      hints: t.hints.map((h) => fill(h, {})),
    };
  }
  const s = pick(rng, t.shapes);
  const kinds = [...new Set(t.shapes.map((x) => x.shape))];
  return {
    ...base,
    text: fill(t.text, { name: s.name }),
    emoji: s.emoji,
    answer: s.shape,
    choices: shuffle(rng, kinds).map((k) => ({ id: k, label: SHAPE_LABEL[k] })),
    hints: t.hints.map((h) => fill(h, { name: s.name })),
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
  let prev = null;
  for (let i = 0; i < count; i++) {
    const levelFor = (t) => (skillLevels && skillLevels[t.skill]) || level;
    const scored = pool.map((t) => ({ t, d: Math.abs(t.difficulty - levelFor(t)) }));
    const best = Math.min(...scored.map((s) => s.d));
    let cands = scored.filter((s) => s.d === best).map((s) => s.t);
    const nonRepeat = cands.filter((t) => t.id !== prev);
    if (nonRepeat.length) cands = nonRepeat;
    const t = pick(rng, cands);
    prev = t.id;
    out.push(generateQuestion(t, rng));
  }
  return out;
}
