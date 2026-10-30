# Sơ đồ EcoShare — phạm vi tính năng trên app (23/10/2026)

- `class-diagram`: 18 thực thể có luồng giao diện đang dùng trong Android/Admin Web, cùng thuộc tính và quan hệ.
- `runtime-class-diagram`: các lớp Java chính điều khiển luồng Android; sơ đồ này mô tả cấu trúc chạy, không phải danh sách tính năng.
- `erd`: ERD logic phạm vi app gồm 18 thực thể. `Review` và `CollectionPoint` chỉ có model/API, không có luồng giao diện tương ứng nên được lược khỏi hai sơ đồ dữ liệu. `Payment` được giữ vì Admin Web có trang quản lý/đối soát giao dịch.
- `function-diagram`: các tính năng có giao diện đang sử dụng trên Android/Admin Web. Thanh toán MoMo/VNPay được ghi rõ là demo lưu trên thiết bị, không chuyển tiền thật.

Các file `.mmd`, `.drawio`, `.svg` và `.png` lần lượt là nguồn Mermaid, bản chỉnh diagrams.net, bản xem/in và ảnh raster. ZIP chứa cả bộ cùng tài liệu đối chiếu. Sinh lại bằng `python tools/generate_current_diagrams.py` sau khi thay đổi mô hình hoặc phạm vi tính năng.

Sơ đồ dữ liệu là mô hình logic; Firestore là nguồn dữ liệu vận hành và `database/schema.sql` là schema SQLite tham chiếu. `docs/domain-model.json` cùng `docs/firestore-physical-map.md` tiếp tục mô tả đủ 20 mô hình/collection backend, kể cả hai mục đã lược khỏi sơ đồ phạm vi app. Thanh toán trong Android chỉ lưu kết quả demo trên thiết bị; không tạo giao dịch thật. Xem `docs/system-audit-2026-10-23.md` để biết căn cứ phân loại giao diện.
