// Kiểm tra (validate) ngân hàng template bài toán. Mọi trường là allowlist.
// Không có eval/Function: công thức chọn từ tập `op` cố định.

export const GRADES = [1, 2, 3, 4, 5];
export const TOPICS = ['dem-so', 'cong-pham-vi-20', 'tru-pham-vi-20', 'hinh-phang'];
export const SKILLS = ['calc', 'space', 'word']; // tính nhanh / tư duy không gian / lời văn
export const TYPES = ['choice', 'basket', 'classify'];
export const OPS = ['count', 'add', 'sub', 'shape'];
export const SHAPES = ['tron', 'vuong', 'tam-giac'];
export const SHAPE_LABEL = { tron: 'Hình tròn', vuong: 'Hình vuông', 'tam-giac': 'Hình tam giác' };
export const VALUE_TAGS = ['tiet-kiem', 'tuong-than', 'bao-ve-moi-truong', 'yeu-kinh-ong-ba', 'trung-thuc', 'none'];
export const PLACEHOLDERS = ['a', 'b', 'name', 'result'];

export const LIMITS = Object.freeze({
  maxTemplates: 500,
  maxText: 240,
  maxHint: 160,
  maxFileBytes: 512 * 1024,
  maxNumber: 100,
});

const ID_RE = /^[a-z0-9-]{1,48}$/;
// Chặn mọi ký tự điều khiển và cặp ngoặc nhọn HTML. Chữ Việt (Unicode) vẫn hợp lệ.
const FORBIDDEN_TEXT_RE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f<>]/;
const EMOJI_RE = /^[\p{Extended_Pictographic}‍️]{1,8}$/u;

const isInt = (n, lo, hi) => Number.isInteger(n) && n >= lo && n <= hi;
const isObj = (o) => o !== null && typeof o === 'object' && !Array.isArray(o);

function checkText(label, s, max, errs) {
  if (typeof s !== 'string' || s.length === 0) return errs.push(`${label}: phải là chuỗi không rỗng`);
  if (s.length > max) errs.push(`${label}: dài quá ${max} ký tự`);
  if (FORBIDDEN_TEXT_RE.test(s)) errs.push(`${label}: chứa ký tự không cho phép`);
  const re = /\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(s))) {
    if (!PLACEHOLDERS.includes(m[1])) errs.push(`${label}: placeholder {${m[1]}} không hợp lệ`);
  }
}

function checkRange(label, r, errs) {
  if (!isObj(r) || !isInt(r.min, 0, LIMITS.maxNumber) || !isInt(r.max, 0, LIMITS.maxNumber) || r.min > r.max) {
    errs.push(`${label}: cần {min,max} nguyên 0..${LIMITS.maxNumber}, min<=max`);
    return false;
  }
  return true;
}

/** @returns {{ok:boolean, errors:string[]}} */
export function validateTemplate(t) {
  const errs = [];
  if (!isObj(t)) return { ok: false, errors: ['template phải là object'] };

  if (typeof t.id !== 'string' || !ID_RE.test(t.id)) errs.push('id: sai định dạng');
  if (!GRADES.includes(t.grade)) errs.push('grade: không hợp lệ');
  if (!TOPICS.includes(t.topic)) errs.push('topic: không hợp lệ');
  if (!SKILLS.includes(t.skill)) errs.push('skill: không hợp lệ');
  if (!isInt(t.difficulty, 1, 3)) errs.push('difficulty: 1..3');
  if (!TYPES.includes(t.type)) errs.push('type: không hợp lệ');
  if (!OPS.includes(t.op)) errs.push('op: không hợp lệ');
  if (!VALUE_TAGS.includes(t.value_tag)) errs.push('value_tag: không hợp lệ');
  if (t.review_status !== 'approved' && t.review_status !== 'draft') errs.push('review_status: approved|draft');
  checkText('text', t.text, LIMITS.maxText, errs);

  if (!Array.isArray(t.hints) || t.hints.length !== 3) errs.push('hints: cần đúng 3 mức gợi ý');
  else t.hints.forEach((h, i) => checkText(`hints[${i}]`, h, LIMITS.maxHint, errs));

  // Ràng buộc theo op/type
  if (t.op === 'count' || t.op === 'add' || t.op === 'sub') {
    if (!isObj(t.item) || !EMOJI_RE.test(t.item.emoji ?? '')) errs.push('item.emoji: cần emoji hợp lệ');
    else checkText('item.name', t.item.name, 40, errs);
    const okA = checkRange('a', t.a, errs);
    if (t.op !== 'count') {
      const okB = checkRange('b', t.b, errs);
      if (!isInt(t.maxResult, 1, LIMITS.maxNumber)) errs.push('maxResult: 1..100');
      else if (okA && okB && t.op === 'add' && t.a.min + t.b.min > t.maxResult) errs.push('add: không có cặp (a,b) nào thoả maxResult');
      if (okA && okB && t.op === 'sub' && t.a.max < t.b.min) errs.push('sub: không có cặp (a,b) nào thoả a>=b');
    }
    if (t.op === 'count' && t.type === 'classify') errs.push('count không dùng type classify');
    if (t.op !== 'count' && t.type !== 'choice') errs.push(`${t.op} chỉ dùng type choice`);
  }
  if (t.op === 'shape') {
    if (!Array.isArray(t.shapes) || t.shapes.length < 2 || t.shapes.length > 8) errs.push('shapes: 2..8 phần tử');
    else {
      const distinct = new Set();
      t.shapes.forEach((s, i) => {
        if (!isObj(s) || !SHAPES.includes(s.shape) || !EMOJI_RE.test(s.emoji ?? '')) errs.push(`shapes[${i}]: không hợp lệ`);
        else {
          distinct.add(s.shape);
          checkText(`shapes[${i}].name`, s.name, 40, errs);
        }
      });
      if (t.type === 'classify' && distinct.size < 2) errs.push('classify: cần ≥2 loại hình khác nhau');
    }
    if (t.type === 'basket') errs.push('shape không dùng type basket');
  }
  if (t.type === 'basket' && t.op !== 'count') errs.push('basket chỉ dùng với op count');

  return { ok: errs.length === 0, errors: errs };
}

/**
 * Validate cả bộ. Template draft/không hợp lệ bị loại, không bao giờ được phục vụ.
 * @returns {{templates:object[], errors:string[]}}
 */
export function validateBank(bank) {
  const errors = [];
  if (!isObj(bank) || !Array.isArray(bank.templates)) return { templates: [], errors: ['bank: thiếu mảng templates'] };
  if (bank.templates.length > LIMITS.maxTemplates) errors.push(`bank: quá ${LIMITS.maxTemplates} template`);
  const seen = new Set();
  const templates = [];
  for (const t of bank.templates.slice(0, LIMITS.maxTemplates)) {
    const r = validateTemplate(t);
    if (!r.ok) {
      errors.push(`${t && t.id ? t.id : '(không id)'}: ${r.errors.join('; ')}`);
      continue;
    }
    if (seen.has(t.id)) {
      errors.push(`${t.id}: trùng id`);
      continue;
    }
    seen.add(t.id);
    if (t.review_status === 'approved') templates.push(t);
  }
  return { templates, errors };
}
