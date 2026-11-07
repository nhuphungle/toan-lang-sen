import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTemplate, validateBank, LIMITS } from '../public/src/content-schema.js';
import { bank } from './helpers.mjs';

const good = () => structuredClone(bank().templates.find((t) => t.id === 'l1-add-d1'));

test('toàn bộ template Lớp 1 hợp lệ và approved', () => {
  const r = validateBank(bank());
  assert.deepEqual(r.errors, []);
  assert.equal(r.templates.length, bank().templates.length);
});

test('mỗi độ khó 1..3 đều có đủ đếm/cộng/trừ', () => {
  const { templates } = validateBank(bank());
  for (const d of [1, 2, 3]) for (const op of ['add', 'sub', 'count']) assert.ok(templates.some((t) => t.difficulty === d && t.op === op), `thiếu ${op} d${d}`);
  assert.ok(templates.some((t) => t.type === 'basket'));
  assert.ok(templates.some((t) => t.type === 'classify'));
});

test('từ chối placeholder lạ, thẻ HTML, ký tự điều khiển', () => {
  for (const text of ['Xin chào {evil}', '<script>alert(1)</script> {a}', 'a\u0000b {a}', '']) {
    const t = good(); t.text = text;
    assert.equal(validateTemplate(t).ok, false, text);
  }
});

test('từ chối id/enum/range sai và hints sai số lượng', () => {
  const mut = [
    (t) => (t.id = '../x'), (t) => (t.op = 'eval'), (t) => (t.type = 'drag'),
    (t) => (t.difficulty = 9), (t) => (t.a = { min: 5, max: 1 }), (t) => (t.hints = ['x']),
    (t) => (t.item.emoji = '<img>'), (t) => (t.value_tag = 'ads'), (t) => (t.review_status = 'x'),
  ];
  for (const m of mut) { const t = good(); m(t); assert.equal(validateTemplate(t).ok, false, m.toString()); }
});

test('template draft không được phục vụ; trùng id bị loại; không object -> lỗi', () => {
  const a = good(); const d = good(); d.id = 'x-draft'; d.review_status = 'draft';
  const dup = good();
  const r = validateBank({ templates: [a, d, dup] });
  assert.equal(r.templates.length, 1);
  assert.ok(r.errors.some((e) => e.includes('trùng id')));
  assert.ok(validateBank(null).errors.length);
  assert.ok(validateBank({ templates: 'x' }).errors.length);
});

test('giới hạn kích thước: quá maxTemplates bị cắt', () => {
  const many = Array.from({ length: LIMITS.maxTemplates + 10 }, (_, i) => ({ ...good(), id: `t-${i}` }));
  const r = validateBank({ templates: many });
  assert.ok(r.templates.length <= LIMITS.maxTemplates);
});
