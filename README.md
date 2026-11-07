# Toán Làng Sen – web game (MVP Lớp 1)

*Chạm bài toán thật – Bật sáng tư duy.* PWA học toán Lớp 1 qua bối cảnh chợ quê Việt Nam. Không quảng cáo, không theo dõi, dữ liệu chỉ lưu trên thiết bị.

## Chạy
```bash
npm start            # http://127.0.0.1:8080  (PORT=… HOST=… để đổi)
npm test             # 50 unit/security test (node:test, không cần cài gì)
npm run verify       # test + kiểm định nội dung
PLAYWRIGHT_PATH=/đường/dẫn/node_modules/playwright npm run test:e2e   # e2e trên Chromium
PLAYWRIGHT_PATH=/đường/dẫn/node_modules/playwright npm run test:e2e:farm   # e2e riêng cho nông trại
```
Cần Node ≥ 20. **Không có dependency.**

## Cấu trúc
`public/` (ứng dụng) · `server.mjs`, `headers.mjs` (server tĩnh + security headers) · `tests/` · `scripts/` · `docs/` (yêu cầu, thiết kế/threat model, kế hoạch test, rà soát bảo mật).

## Thêm nội dung
Sửa `public/data/lop1.json`. Mỗi template phải qua `validateTemplate` (xem `public/src/content-schema.js`); chỉ `review_status: "approved"` mới được phục vụ. Nhớ chạy `npm run verify`. Bộ hiện tại là **16 template mẫu** (≈ vài trăm biến thể), chưa phải 500 bài đã kiểm định sư phạm.
