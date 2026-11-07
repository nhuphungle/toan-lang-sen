# 03 – Kế hoạch & kết quả kiểm thử

| Tầng | Công cụ | Phạm vi | Lệnh |
|------|---------|---------|------|
| Unit | `node:test` | rng, schema nội dung, generator, adaptive, rewards, storage, pin, play-clock, dom | `npm test` |
| Property-style | `node:test` | 1000 seed × mọi template: đúng 1 đáp án đúng, không nhiễu trùng, không còn placeholder | `npm test` |
| Nội dung | `scripts/verify-content.mjs` | 2000 seed × template, báo cáo số biến thể | `npm run verify` |
| Bảo mật server | `node:test` + `http` | headers, path traversal (11 kiểu), method, dotfile, URI dài | `npm test` |
| Bảo mật tĩnh | `node:test` | cấm eval/innerHTML/URL ngoài/SDK tracker/bí mật; SW; import; manifest | `npm test` |
| E2E | Playwright (có sẵn trên máy, không thêm dependency) + Chromium, viewport 390×780 | luồng chơi thật, XSS, PIN, offline, bàn phím, request ngoài origin | `PLAYWRIGHT_PATH=… npm run test:e2e` |

## Ánh xạ yêu cầu → kiểm thử
| Yêu cầu | Kiểm thử |
|---------|----------|
| FR1 | e2e "XSS biệt danh", "bỏ trống bị chặn"; unit `sanitizeNickname` |
| FR3 | unit property 1000 seed; e2e chơi trọn bài |
| FR4 | e2e (choice, basket); unit `checkAnswer` cho cả 3 kiểu (classify được kiểm ở unit; e2e chạm ngẫu nhiên chưa luôn gặp classify) |
| FR6 | unit XP/shop/huy hiệu; e2e XP tăng và xu = XP |
| FR7 | unit từng nhánh lên/xuống/thử thách |
| FR8 | unit PIN/khoá; e2e tạo PIN, sai, khoá 5 lần, đúng PIN khi đang khoá |
| FR9 | e2e offline sau khi SW cache |
| NFR1 | tĩnh (không URL ngoài/SDK) + e2e (không request ngoài origin) |
| NFR3 | toàn bộ nhóm bảo mật |
| NFR5 | e2e: không tràn ngang trên 4 màn hình; thao tác bằng Enter; ảnh chụp được xem thủ công |

## Lỗi tìm thấy trong quá trình test (và đã sửa)
1. **Enter ở ô tên tự kích hoạt nút "Vào chơi"** (phím rơi sang phần tử vừa nhận focus) → `preventDefault()`; có test hồi quy trong e2e.
2. **Nhãn biểu đồ radar bị cắt** trên màn hình hẹp (phát hiện qua ảnh chụp) → nhãn ngắn, 2 dòng, căn lề theo vị trí.
3. **`localStorage` có thể ném lỗi khi truy cập** ở chế độ riêng tư → bọc `getStorage()` có bộ nhớ dự phòng.

## Chưa kiểm thử (khoảng trống đã biết)
- Thiết bị thật: Safari iOS, Android tầm thấp, iPad (chỉ chạy Chromium giả lập viewport điện thoại).
- Kiểm thử người dùng với trẻ em và phụ huynh (Giai đoạn 2 của kế hoạch).
- Kiểm tra truy cập (a11y) bằng trình đọc màn hình thật; mới có nhãn ARIA và thao tác bàn phím.
- E2E chưa bao phủ chắc chắn kiểu "classify" mỗi lần chạy (ngẫu nhiên theo seed).
- Kiểm thử tải/hiệu năng; kiểm thử xâm nhập độc lập.
