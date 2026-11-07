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
