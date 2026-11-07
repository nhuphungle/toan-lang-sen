# 04 – Báo cáo rà soát bảo mật (MVP)

## Đã thực hiện (đối chiếu mô hình đe dọa ở tài liệu 02)
| # | Đe dọa | Trạng thái | Bằng chứng |
|---|--------|-----------|-----------|
| T1 XSS | Giảm thiểu | Chỉ `textContent`/`createElement`; helper `dom.js` allowlist thuộc tính; CSP `script-src 'self'`; test quét cấm `innerHTML`/`eval`; e2e chèn `<img onerror>` không thực thi |
| T2 Dữ liệu lưu bị sửa | Giảm thiểu | `validateState` dựng object mới theo allowlist; test `__proto__`, số cực lớn, id lạ, JSON hỏng |
| T3 Bypass PIN | Giảm thiểu một phần | PBKDF2-SHA256 150k + salt, so sánh hằng thời gian, khoá leo thang. **Giới hạn:** chỉ là cổng chặn trẻ em, người có quyền truy cập thiết bị vẫn có thể xoá `localStorage` |
| T4 Path traversal | Giảm thiểu | `resolveSafe` + test 11 kiểu tấn công kể cả mã hoá kép; chỉ phục vụ loại tệp đã biết; chỉ GET/HEAD |
| T5 Clickjacking | Giảm thiểu | `frame-ancestors 'none'` + `X-Frame-Options` |
| T6 Rò rỉ bên thứ ba | Giảm thiểu | `default-src 'none'`, `connect-src 'self'`, test tĩnh và e2e không request ngoài origin |
| T7 SW độc | Giảm thiểu | chỉ GET cùng origin, danh sách shell cố định, test đối chiếu tệp |
| T8 Nội dung xấu | Giảm thiểu | validate allowlist, `<` `>` bị cấm, chỉ phục vụ `approved` |
| T9 Chuỗi cung ứng | Loại bỏ | Zero dependency (test khẳng định) |
| T10 DoS đầu vào | Giảm thiểu | giới hạn độ dài, số template, kích thước tệp, URI, localStorage 64 KB |

## Về `npm audit`
Dự án **không có dependency** nên không có gì để audit; registry npm cũng bị chính sách mạng chặn khi tôi thử cài thư viện. Nếu sau này thêm thư viện, bổ sung `npm audit` và khoá phiên bản (lockfile) vào quy trình CI.

## Rủi ro còn lại / việc cần làm trước khi phát hành thật
1. **Triển khai HTTPS** và đặt đúng headers ở tầng hosting (nguồn: `headers.mjs`). HSTS chỉ có tác dụng qua HTTPS. Cần thêm bước sinh tệp `_headers`/cấu hình cho nhà cung cấp hosting đã chọn.
2. **Tuân thủ pháp lý dữ liệu trẻ em** (Nghị định 13/2023/NĐ-CP và quy định liên quan): hiện không thu thập dữ liệu ra ngoài thiết bị, nhưng khi thêm tài khoản/đồng bộ cần: đồng ý của phụ huynh, chính sách quyền riêng tư, tối thiểu hoá dữ liệu. **Cần luật sư/chuyên gia xác nhận**, tôi không thay thế được.
3. Khi thêm backend: xác thực phía server, rate limit, kiểm tra đầu vào phía server (PIN phía client không thay thế được).
4. Penetration test độc lập trước khi ra mắt.
5. Subresource Integrity không cần thiết lúc này (không có tài nguyên ngoài); cần xem lại nếu dùng CDN.
