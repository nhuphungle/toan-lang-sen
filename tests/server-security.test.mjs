import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createServer, resolveSafe } from '../server.mjs';
import { SECURITY_HEADERS, CSP } from '../headers.mjs';

let srv, port;
before(() => new Promise((r) => { srv = createServer().listen(0, '127.0.0.1', () => { port = srv.address().port; r(); }); }));
after(() => new Promise((r) => srv.close(r)));

// http.request cho phép gửi path thô (fetch sẽ chuẩn hoá ../ trước khi gửi)
const raw = (path, method = 'GET') => new Promise((resolve, reject) => {
  const req = http.request({ host: '127.0.0.1', port, path, method }, (res) => {
    let body = ''; res.on('data', (d) => (body += d)); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
  });
  req.on('error', reject); req.end();
});

test('trang chủ trả 200 kèm đầy đủ security headers', async () => {
  const r = await raw('/');
  assert.equal(r.status, 200);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) assert.equal(r.headers[k.toLowerCase()], v, k);
  assert.match(r.headers['content-type'], /text\/html/);
});

test('CSP: chặn mặc định, không unsafe-inline/unsafe-eval, không nguồn ngoài', () => {
  assert.match(CSP, /default-src 'none'/);
  assert.match(CSP, /frame-ancestors 'none'/);
  assert.doesNotMatch(CSP, /unsafe-inline|unsafe-eval|https?:|\*/);
});

test('mọi tài nguyên tĩnh đều có headers, kể cả 404', async () => {
  for (const p of ['/styles.css', '/src/app.js', '/data/lop1.json', '/manifest.webmanifest', '/sw.js', '/khong-co']) {
    const r = await raw(p);
    assert.equal(r.headers['x-content-type-options'], 'nosniff', p);
    assert.ok(r.headers['content-security-policy'], p);
  }
});

test('path traversal các kiểu đều bị chặn', async () => {
  const attacks = ['/../server.mjs', '/%2e%2e/server.mjs', '/%2e%2e%2fserver.mjs', '/..%2fpackage.json', '/src/../../server.mjs',
    '/..\\server.mjs', '/%5c..%5cserver.mjs', '/%00', '/src/%2e%2e/%2e%2e/headers.mjs', '//etc/passwd', '/%252e%252e/server.mjs'];
  for (const a of attacks) {
    const r = await raw(a);
    assert.ok([400, 404].includes(r.status), `${a} -> ${r.status}`);
    assert.doesNotMatch(r.body, /createServer|SECURITY_HEADERS|"name": "toan-lang-sen"|root:/, a);
  }
});

test('resolveSafe: chỉ trả đường dẫn trong thư mục public', () => {
  assert.equal(resolveSafe('/../x'), null);
  assert.equal(resolveSafe('/.env'), null);
  assert.equal(resolveSafe('/a/.git/config'), null);
  assert.equal(resolveSafe('/%zz'), null);
  assert.ok(resolveSafe('/styles.css').endsWith('/public/styles.css'));
});

test('chỉ cho GET/HEAD; không liệt kê thư mục; không lộ tệp ngoài public/loại lạ', async () => {
  for (const m of ['POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']) {
    const r = await raw('/', m); assert.equal(r.status, 405, m); assert.equal(r.headers.allow, 'GET, HEAD');
  }
  assert.equal((await raw('/', 'HEAD')).status, 200);
  const dir = await raw('/src/'); assert.equal(dir.status, 404);
  for (const p of ['/server.mjs', '/package.json', '/tests/helpers.mjs', '/headers.mjs', '/docs/01-yeu-cau.md']) assert.equal((await raw(p)).status, 404, p);
});

test('URL quá dài bị từ chối', async () => {
  const r = await raw('/' + 'a'.repeat(3000)); assert.equal(r.status, 414);
});

test('mã nguồn (js/css) luôn xác thực lại bằng ETag, tệp không đổi trả 304', async () => {
  const r = await raw('/styles.css');
  assert.equal(r.headers['cache-control'], 'no-cache');
  assert.ok(r.headers.etag);
  const status = await new Promise((resolve) => {
    http.get({ host: '127.0.0.1', port, path: '/styles.css', headers: { 'If-None-Match': r.headers.etag } }, (res) => { res.resume(); resolve(res.statusCode); });
  });
  assert.equal(status, 304);
});

test('sw.js và index.html không bị cache lâu (để cập nhật nhanh)', async () => {
  assert.equal((await raw('/sw.js')).headers['cache-control'], 'no-cache');
  assert.equal((await raw('/index.html')).headers['cache-control'], 'no-cache');
});
