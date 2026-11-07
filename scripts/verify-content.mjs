// Kiểm định nội dung: sinh nhiều biến thể cho mọi template và báo cáo tổng hợp. Thoát mã 1 nếu có lỗi.
import fs from 'node:fs';
import { validateBank } from '../public/src/content-schema.js';
import { generateQuestion, checkAnswer } from '../public/src/generator.js';
import { mulberry32 } from '../public/src/rng.js';

const bank = JSON.parse(fs.readFileSync(new URL('../public/data/lop1.json', import.meta.url), 'utf8'));
const { templates, errors } = validateBank(bank);
let bad = errors.length;
errors.forEach((e) => console.error('LỖI template:', e));
const distinct = new Set();
for (const t of templates) {
  for (let s = 1; s <= 2000; s++) {
    const q = generateQuestion(t, mulberry32(s));
    distinct.add(`${t.id}|${q.text}|${JSON.stringify(q.items ?? '')}`);
    if (q.type === 'choice' && q.choices.filter((c) => checkAnswer(q, c.id)).length !== 1) { bad++; console.error('Không đúng 1 đáp án:', t.id, s); break; }
    if (/[{}<>]/.test(q.text)) { bad++; console.error('Văn bản lỗi:', t.id, q.text); break; }
  }
}
console.log(`Template: ${templates.length} • Biến thể khác nhau (mẫu 2000/template): ${distinct.size} • Lỗi: ${bad}`);
process.exit(bad ? 1 : 0);
