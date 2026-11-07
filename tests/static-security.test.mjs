import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, walk } from './helpers.mjs';

const PUB = path.join(ROOT, 'public');
const files = walk(PUB);
const js = files.filter((f) => f.endsWith('.js'));
const read = (f) => fs.readFileSync(f, 'utf8');
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

test('mã client không dùng API nguy hiểm (eval/Function/innerHTML/document.write...)', () => {
  const banned = [/\beval\s*\(/, /\bnew\s+Function\b/, /\.innerHTML\b/, /\.outerHTML\s*=/, /insertAdjacentHTML/, /document\.write/,
    /setTimeout\s*\(\s*['"`]/, /setInterval\s*\(\s*['"`]/, /\.setAttribute\(\s*['"]style['"]/, /\bimportScripts\b/, /javascript:/i];
  for (const f of js) {
    const code = stripComments(read(f));
    for (const re of banned) assert.doesNotMatch(code, re, `${path.relative(ROOT, f)} vi phạm ${re}`);
  }
});

test('không gọi/nhúng tài nguyên ngoài origin (chỉ cho phép namespace SVG)', () => {
  const urlRe = /https?:\/\/[^\s'"`)]+/g;
  for (const f of files.filter((x) => /\.(js|html|css|json|webmanifest|svg)$/.test(x))) {
    const bad = (read(f).match(urlRe) || []).filter((u) => !u.startsWith('http://www.w3.org/2000/svg'));
    assert.deepEqual(bad, [], `${path.relative(ROOT, f)} chứa URL ngoài: ${bad}`);
  }
  for (const f of js) assert.doesNotMatch(read(f), /\bXMLHttpRequest\b|\bWebSocket\b|sendBeacon|\bEventSource\b/, f);
});

test('index.html: không script/style nội tuyến, không on* handler, không style attr', () => {
  const html = read(path.join(PUB, 'index.html'));
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/i);
  assert.doesNotMatch(html, /<style/i);
  assert.doesNotMatch(html, /\son[a-z]+\s*=/i);
  assert.doesNotMatch(html, /\sstyle\s*=/i);
  assert.match(html, /<html lang="vi">/);
});

test('không có SDK quảng cáo/phân tích bên thứ ba', () => {
  const all = files.map(read).join('\n');
  assert.doesNotMatch(all, /google-analytics|googletagmanager|gtag\(|facebook\.net|fbq\(|doubleclick|adsbygoogle|mixpanel|segment\.com|hotjar|sentry/i);
});

test('không có bí mật/khoá API bị commit', () => {
  const all = [...files, path.join(ROOT, 'server.mjs'), path.join(ROOT, 'package.json')].map(read).join('\n');
  assert.doesNotMatch(all, /AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY|api[_-]?key\s*[:=]\s*['"][^'"]{8,}|password\s*[:=]\s*['"][^'"]{4,}/i);
});

test('package.json: không có dependency (giảm rủi ro chuỗi cung ứng)', () => {
  const pkg = JSON.parse(read(path.join(ROOT, 'package.json')));
  assert.equal(pkg.dependencies, undefined); assert.equal(pkg.devDependencies, undefined);
});

test('service worker: chỉ cache GET cùng origin và danh sách shell tồn tại thật', () => {
  const sw = read(path.join(PUB, 'sw.js'));
  assert.match(sw, /req\.method !== 'GET'/); assert.match(sw, /url\.origin !== self\.location\.origin/);
  const list = sw.match(/const SHELL = \[([\s\S]*?)\];/)[1].match(/'([^']+)'/g).map((s) => s.slice(1, -1));
  for (const p of list) if (p !== './') assert.ok(fs.existsSync(path.join(PUB, p)), `SHELL thiếu tệp: ${p}`);
  // mọi module JS và dữ liệu đều nằm trong SHELL (không thiếu offline)
  for (const f of js.filter((x) => !x.endsWith('sw.js'))) assert.ok(list.includes(path.relative(PUB, f)), `SHELL chưa có ${path.relative(PUB, f)}`);
});

test('mọi import tương đối trong client trỏ tới tệp tồn tại', () => {
  for (const f of js) {
    for (const m of read(f).matchAll(/from\s+'(\.[^']+)'/g)) assert.ok(fs.existsSync(path.resolve(path.dirname(f), m[1])), `${path.relative(ROOT, f)} import hỏng: ${m[1]}`);
  }
});

test('manifest hợp lệ cơ bản', () => {
  const m = JSON.parse(read(path.join(PUB, 'manifest.webmanifest')));
  assert.equal(m.lang, 'vi'); assert.ok(m.name && m.start_url && m.icons.length);
  for (const i of m.icons) assert.ok(fs.existsSync(path.join(PUB, i.src)));
});
