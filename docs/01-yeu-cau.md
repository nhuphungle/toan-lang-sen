# 01 – Phân tích yêu cầu (MVP Lớp 1)

## Phạm vi
Web game (PWA) "Toán Làng Sen", MVP cho **Lớp 1**, 1 vùng: *Đồng bằng Bắc Bộ – Chợ quê của mẹ*.
Các vùng khác hiển thị "Sắp ra mắt".

## Yêu cầu chức năng (FR)
| ID | Yêu cầu | Tiêu chí chấp nhận |
|----|---------|--------------------|
| FR1 | Tạo hồ sơ bé: biệt danh + nhân vật (Nghé Con / Bé Tí / Bông) | Biệt danh 1–20 ký tự, chỉ chữ/số/khoảng trắng; lưu cục bộ |
| FR2 | Bản đồ vùng, mở khóa theo tiến độ | Vùng 1 mở; các vùng khác khoá |
| FR3 | Bài học 8 câu sinh từ template: đếm, cộng, trừ (phạm vi 10/20), nhận biết hình | Mỗi phiên khác nhau; đáp án luôn đúng và có đúng 1 lựa chọn đúng |
| FR4 | 3 kiểu tương tác: trắc nghiệm hình ảnh, xếp vật vào giỏ, phân loại vào giỏ tròn/vuông | Dùng được bằng chạm/chuột/bàn phím |
| FR5 | Gợi ý 3 mức (lời → hình ảnh → thao tác mẫu) | Hiện dần khi sai/xin gợi ý |
| FR6 | XP, xu, vật phẩm Nông trại, huy hiệu | Công thức XP và điều kiện huy hiệu có test |
| FR7 | Thích ứng độ khó (luật): sai 2 lần liên tiếp hạ độ khó; đúng 5 liên tiếp tăng | Có test cho từng nhánh |
| FR8 | Parent Hub: khoá PIN, thống kê, radar năng lực, nhắc nghỉ mắt, gợi ý "sư phạm gia đình", xuất/xoá dữ liệu | PIN 4–8 số, khoá tạm sau 5 lần sai |
| FR9 | Chạy offline (PWA) | Service worker cache vỏ ứng dụng và dữ liệu bài |

## Yêu cầu phi chức năng (NFR)
- NFR1 **Kid-safe**: không quảng cáo, không tracker, không script/font/ảnh bên thứ ba, không gọi mạng ra ngoài.
- NFR2 **Riêng tư**: không thu thập PII; dữ liệu chỉ nằm trong trình duyệt; xuất và xoá được.
- NFR3 **Bảo mật**: CSP chặt, không `eval`/`innerHTML`, kiểm tra mọi dữ liệu đọc từ bộ nhớ và nội dung.
- NFR4 **Hiệu năng**: lần tải đầu < 300 KB (chưa tính media), không build step.
- NFR5 **Khả dụng**: mobile-first, nút chạm ≥ 48px, tương phản tốt, hỗ trợ `prefers-reduced-motion`, dùng được bằng bàn phím.

## Ngoài phạm vi MVP (để các pha sau)
Lớp 2–5, video micro-learning, voice-over 3 miền, backend/đồng bộ tài khoản, thanh toán, âm nhạc thu sẵn (MVP dùng âm báo tổng hợp bằng WebAudio).

## Giả định cần xác nhận
- Mapping bài ↔ "yêu cầu cần đạt" GDPT 2018 hiện chỉ dùng nhãn chủ đề mô tả; **cố vấn sư phạm cần đối chiếu mã chính thức** trước khi phát hành.
- Bộ nội dung hiện là **bộ mẫu (template)**, chưa phải 500 bài đã kiểm định.
