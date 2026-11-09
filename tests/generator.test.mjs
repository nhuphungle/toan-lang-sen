import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBank } from '../public/src/content-schema.js';
import { generateQuestion, checkAnswer, generateSession } from '../public/src/generator.js';
import { mulberry32 } from '../public/src/rng.js';
import { bank } from './helpers.mjs';

const { templates } = validateBank(bank());

test('1000 biến thể mỗi template: đáp án đúng, đúng 1 lựa chọn đúng, không nhiễu trùng', () => {
  for (const t of templates) {
    for (let seed = 1; seed <= 1000; seed++) {
      const q = generateQuestion(t, mulberry32(seed));
      assert.ok(q.text.length > 0 && !/[{}]/.test(q.text), `${t.id}: placeholder chưa thay: ${q.text}`);
      q.hints.forEach((h) => assert.ok(!/[{}]/.test(h), `${t.id} hint`));
      if (q.type === 'choice') {
        const ids = q.choices.map((c) => c.id);
        assert.equal(new Set(ids).size, ids.length, `${t.id}: lựa chọn trùng`);
        assert.equal(ids.filter((id) => checkAnswer(q, id)).length, 1, `${t.id}: phải có đúng 1 đáp án đúng`);
        assert.ok(q.choices.length >= 3);
        if (typeof q.answer === 'number') q.choices.forEach((c) => assert.ok(Number(c.id) >= 0));
      }
      if (t.op === 'add') assert.ok(q.answer <= t.maxResult);
      if (t.op === 'sub') assert.ok(q.answer >= 0 && q.answer <= t.maxResult);
      if (t.op === 'count') assert.ok(q.answer >= t.a.min && q.answer <= t.a.max);
    }
  }
});

test('cùng seed -> cùng câu hỏi (tái lập)', () => {
  for (const t of templates) {
    assert.deepEqual(generateQuestion(t, mulberry32(42)), generateQuestion(t, mulberry32(42)));
  }
});

test('checkAnswer: từ chối kiểu dữ liệu sai', () => {
  const t = templates.find((x) => x.id === 'l1-add-d1');
  const q = generateQuestion(t, mulberry32(7));
  assert.equal(checkAnswer(q, q.answer), false); // number, không phải string id
  assert.equal(checkAnswer(q, String(q.answer)), true);
  assert.equal(checkAnswer(q, null), false);
  assert.equal(checkAnswer(q, { toString: () => String(q.answer) }), false);
  const b = generateQuestion(templates.find((x) => x.type === 'basket'), mulberry32(3));
  assert.equal(checkAnswer(b, b.answer), true);
  assert.equal(checkAnswer(b, String(b.answer)), false);
  assert.equal(checkAnswer(b, b.answer + 0.5), false);
  const c = generateQuestion(templates.find((x) => x.type === 'classify'), mulberry32(5));
  assert.equal(checkAnswer(c, c.answer), true);
  assert.equal(checkAnswer(c, c.answer.slice(0, -1)), false);
  assert.equal(checkAnswer(c, c.answer.map(() => 'tron').concat([])), c.answer.every((x) => x === 'tron'));
  assert.equal(checkAnswer({ type: 'unknown' }, 1), false);
});

test('classify: có ≥2 loại hình và mỗi giỏ đều có món', () => {
  const t = templates.find((x) => x.type === 'classify');
  for (let s = 1; s <= 300; s++) {
    const q = generateQuestion(t, mulberry32(s));
    assert.ok(new Set(q.answer).size >= 2);
    q.buckets.forEach((b) => assert.ok(q.answer.includes(b.id)));
  }
});

test('generateSession: đủ số câu, bám độ khó, không lặp template liên tiếp', () => {
  const qs = generateSession(templates, { level: 2, count: 8, rng: mulberry32(9) });
  assert.equal(qs.length, 8);
  qs.forEach((q) => assert.equal(q.difficulty, 2));
  for (let i = 1; i < qs.length; i++) assert.notEqual(qs[i].templateId, qs[i - 1].templateId);
  assert.deepEqual(generateSession([], { count: 5, rng: mulberry32(1) }), []);
});

test('generateSession: skillLevels riêng theo kỹ năng', () => {
  const qs = generateSession(templates, { count: 30, rng: mulberry32(2), skillLevels: { calc: 1, space: 3, word: 2 } });
  qs.forEach((q) => assert.equal(q.difficulty, { calc: 1, space: 3, word: 2 }[q.skill] ?? q.difficulty));
});

test('dạng mới: so sánh, dấu, liền trước/sau, dãy số, tìm số còn thiếu cho đáp án đúng', () => {
  const sign = (a, b) => (a > b ? 'gt' : a < b ? 'lt' : 'eq');
  for (const t of templates.filter((x) => ['compare', 'sign', 'neighbor', 'sequence'].includes(x.op) || x.ask === 'b')) {
    const seen = new Set();
    for (let seed = 1; seed <= 500; seed++) {
      const q = generateQuestion(t, mulberry32(seed));
      seen.add(q.answer);
      assert.equal(q.choices.filter((c) => checkAnswer(q, c.id)).length, 1, `${t.id}: phải có đúng 1 đáp án đúng`);
      if (t.op === 'compare') {
        const nums = q.choices.map((c) => Number(c.id));
        assert.equal(new Set(nums).size, 3);
        assert.equal(q.answer, t.ask === 'max' ? Math.max(...nums) : Math.min(...nums));
      }
      if (t.op === 'sign') {
        const [a, b] = q.text.match(/\d+/g).map(Number);
        assert.equal(q.answer, sign(a, b));
      }
      if (t.op === 'neighbor') {
        const a = Number(q.text.match(/\d+/)[0]);
        assert.equal(q.answer, t.ask === 'next' ? a + 1 : a - 1);
        assert.ok(q.answer >= 0);
      }
      if (t.op === 'sequence') {
        const [a, b, c] = q.text.match(/\d+/g).map(Number);
        assert.equal(b - a, c - b);
        assert.equal(q.answer, c + (c - b));
        assert.ok(q.answer >= 0 && q.answer <= t.maxResult);
      }
      if (t.ask === 'b') {
        const [a, r] = [q.text.match(/\d+/g).map(Number)[0], q.text.match(/\d+/g).map(Number)[1]];
        assert.equal(q.answer, t.op === 'add' ? r - a : a - r);
        assert.equal(q.groups, undefined, 'không lộ đáp án qua hình minh hoạ');
      }
    }
    assert.ok(seen.size > 1, `${t.id}: đáp án phải thay đổi theo seed`);
  }
});

test('sign: có đủ cả ba dấu <, =, >', () => {
  const t = templates.find((x) => x.op === 'sign');
  const got = new Set();
  for (let s = 1; s <= 300; s++) got.add(generateQuestion(t, mulberry32(s)).answer);
  assert.deepEqual([...got].sort(), ['eq', 'gt', 'lt']);
});

test('đa dạng: cùng template sinh nhiều vật và nhiều cách hỏi khác nhau', () => {
  for (const t of templates.filter((x) => x.items || x.texts)) {
    const texts = new Set();
    const emojis = new Set();
    for (let s = 1; s <= 300; s++) {
      const q = generateQuestion(t, mulberry32(s));
      texts.add(q.text.replace(/\d+/g, '#'));
      if (q.emoji) emojis.add(q.emoji);
    }
    if (t.items && t.items.length > 1) assert.ok(emojis.size > 1, `${t.id}: chỉ ra một loại vật`);
    if (t.texts && t.texts.length > 1) assert.ok(texts.size > 1, `${t.id}: chỉ ra một cách hỏi`);
  }
});

test('generateSession: một phiên 8 câu không lặp template và có nhiều chủ đề (mọi độ khó)', () => {
  for (const level of [1, 2, 3]) {
    for (let seed = 1; seed <= 200; seed++) {
      const qs = generateSession(templates, { level, count: 8, rng: mulberry32(seed) });
      const ids = qs.map((q) => q.templateId);
      const pool = templates.filter((t) => t.difficulty === level).length;
      // không lặp template cho tới khi dùng hết một vòng
      assert.equal(new Set(ids).size, Math.min(8, pool), `level ${level} seed ${seed}: ${ids}`);
      assert.ok(new Set(qs.map((q) => q.topic)).size >= 3, `level ${level}: cần ≥3 chủ đề`);
    }
  }
});
