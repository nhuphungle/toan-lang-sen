// Server tĩnh tối giản, an toàn: chỉ GET/HEAD, chống path traversal, không liệt kê thư mục,
// chặn dotfile, kèm security headers. Dùng cho dev/self-host; production nên đặt sau HTTPS.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SECURITY_HEADERS } from './headers.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function send(res, status, body, extra = {}) {
  res.writeHead(status, { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8', ...extra });
  res.end(body);
}

/** Trả về đường dẫn tuyệt đối an toàn trong ROOT, hoặc null. Export để test. */
export function resolveSafe(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  } catch {
    return null;
  }
  if (decoded.includes('\0') || decoded.includes('\\')) return null;
  const segments = decoded.split('/').filter(Boolean);
  if (segments.some((s) => s === '..' || s.startsWith('.'))) return null; // traversal + dotfile
  const abs = path.resolve(ROOT, ...segments);
  if (abs !== ROOT && !abs.startsWith(ROOT + path.sep)) return null;
  return abs;
}

export function createServer() {
  return http.createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return send(res, 405, 'Method Not Allowed', { Allow: 'GET, HEAD' });
    }
    if ((req.url ?? '').length > 2048) return send(res, 414, 'URI Too Long');
    let abs = resolveSafe(req.url ?? '/');
    if (!abs) return send(res, 400, 'Bad Request');

    fs.stat(abs, (err, st) => {
      if (!err && st.isDirectory()) abs = path.join(abs, 'index.html');
      fs.stat(abs, (err2, st2) => {
        if (err2 || !st2.isFile()) return send(res, 404, 'Not Found');
        const type = MIME[path.extname(abs).toLowerCase()];
        if (!type) return send(res, 404, 'Not Found'); // chỉ phục vụ loại tệp đã biết
        // Mã nguồn (html/js/css/json/manifest) luôn xác thực lại bằng ETag để máy chơi không kẹt bản cũ;
        // chỉ ảnh/âm thanh mới cache dài.
        const revalidate = /\.(html|js|mjs|css|json|webmanifest)$/i.test(abs);
        const etag = `W/"${st2.size.toString(16)}-${Math.trunc(st2.mtimeMs).toString(16)}"`;
        if (revalidate && req.headers['if-none-match'] === etag) {
          res.writeHead(304, { ...SECURITY_HEADERS, ETag: etag, 'Cache-Control': 'no-cache' });
          return res.end();
        }
        res.writeHead(200, {
          ...SECURITY_HEADERS,
          'Content-Type': type,
          'Content-Length': st2.size,
          ...(revalidate ? { ETag: etag } : {}),
          'Cache-Control': revalidate ? 'no-cache' : 'public, max-age=3600',
        });
        if (req.method === 'HEAD') return res.end();
        fs.createReadStream(abs).pipe(res);
      });
    });
  });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const port = Number(process.env.PORT) || 8080;
  // Mặc định chỉ lắng nghe localhost; đặt HOST=0.0.0.0 có chủ đích khi cần.
  const host = process.env.HOST || '127.0.0.1';
  createServer().listen(port, host, () => console.log(`Toán Làng Sen: http://${host}:${port}`));
}
