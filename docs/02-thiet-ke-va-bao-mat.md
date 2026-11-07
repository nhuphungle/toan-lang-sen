# 02 – Thiết kế & mô hình đe dọa

## Kiến trúc
```
public/                    (thư mục được phục vụ)
  index.html, styles.css, manifest.webmanifest, sw.js
  data/lop1.json           ngân hàng template (được validate khi tải)
  src/
    rng.js                 PRNG có seed (test tái lập được)
    content-schema.js      validate template (allowlist, không eval)
    generator.js           template -> câu hỏi + chấm điểm
    adaptive.js            luật điều chỉnh độ khó
    rewards.js             XP, xu, shop, huy hiệu
    storage.js             load/save + validate state (không tin dữ liệu lưu)
    pin.js                 PBKDF2 PIN + khoá tạm
    play-clock.js          đồng hồ học & nhắc nghỉ mắt
    dom.js                 helper tạo DOM an toàn (textContent only)
    audio.js, app.js, screens/*  UI
server.mjs  headers.mjs    server tĩnh + security headers
```
Logic thuần (không DOM) tách khỏi UI để test bằng `node:test`.

## Luồng dữ liệu
JSON template → `validateBank` → `generateQuestion(seed)` → UI → `checkAnswer` → `adaptive/rewards` → `saveState(localStorage)`.
Không có request ra ngoài; chỉ tải tệp cùng origin.

## Mô hình đe dọa (STRIDE rút gọn)
| # | Đe dọa | Biện pháp |
|---|--------|-----------|
| T1 | XSS qua nội dung bài/biệt danh | Chỉ dùng `textContent`; CSP `script-src 'self'`; cấm `innerHTML` (test quét mã) |
| T2 | Dữ liệu localStorage bị sửa tay (XP giả, prototype pollution, JSON hỏng) | `validateState` dựng object mới theo allowlist, ép kiểu/giới hạn; test `__proto__` |
| T3 | Bypass PIN phụ huynh | PBKDF2-SHA256 150k vòng + salt, so sánh hằng thời gian, khoá tạm leo thang. *Giới hạn:* đây là cổng chặn trẻ em, không phải xác thực chống kẻ tấn công có quyền truy cập thiết bị |
| T4 | Path traversal / lộ tệp ở server | Resolve + kiểm tra nằm trong root, chặn dotfile, chỉ GET/HEAD, không liệt kê thư mục |
| T5 | Clickjacking | `frame-ancestors 'none'` + `X-Frame-Options: DENY` |
| T6 | Rò rỉ dữ liệu bên thứ ba | `connect-src 'self'`, không SDK/CDN; `Referrer-Policy: no-referrer` |
| T7 | Service worker cache độc | SW chỉ cache GET cùng origin, danh sách tệp cố định, phiên bản cache |
| T8 | Nội dung bài sai/không phù hợp | Chỉ phục vụ template `review_status: approved`; script `verify-content` kiểm tra mọi biến thể |
| T9 | Chuỗi cung ứng | Zero dependency runtime và dev |
| T10| Từ chối dịch vụ do input | Giới hạn độ dài, số phần tử, kích thước file template |

## Quyết định thiết kế
- **Không dùng `eval` cho công thức**: mỗi template chọn `op` trong tập cố định.
- **PRNG có seed** để tái hiện lỗi và test hàng nghìn biến thể.
- **Template→biến thể** thay vì viết tay từng bài, đáp ứng mục tiêu mở rộng tới 500 bài.
