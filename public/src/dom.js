// Helper tạo DOM AN TOÀN: chỉ dùng textContent/setAttribute theo allowlist.
// Không innerHTML, không thuộc tính on* dạng chuỗi, không style/href/src.

const SAFE_ATTR = /^(class|id|type|role|tabindex|disabled|value|min|max|maxlength|minlength|placeholder|accept|autocomplete|inputmode|for|name|pattern|required|open|selected|checked|viewBox|d|cx|cy|r|x|y|x1|y1|x2|y2|points|fill|stroke|stroke-width|stroke-linejoin|text-anchor|dominant-baseline|width|height|transform|opacity|aria-[a-z]+|data-[a-z-]+)$/;

export function isSafeAttr(name, value) {
  if (typeof name !== 'string' || !SAFE_ATTR.test(name)) return false;
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

function apply(el, props) {
  for (const [k, v] of Object.entries(props || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'vars' && typeof v === 'object') {
      for (const [name, val] of Object.entries(v)) if (/^--[a-z-]+$/.test(name)) el.style.setProperty(name, String(val));
    } else if (k.startsWith('on') && typeof v === 'function') {
      el.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (isSafeAttr(k, v)) {
      el.setAttribute(k, v === true ? '' : String(v));
    }
    // mọi thứ khác bị bỏ qua có chủ đích
  }
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(typeof c === 'object' ? c : document.createTextNode(String(c)));
  }
}

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  apply(el, props);
  append(el, children);
  return el;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
export function svg(tag, props, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  apply(el, props);
  append(el, children);
  return el;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}
