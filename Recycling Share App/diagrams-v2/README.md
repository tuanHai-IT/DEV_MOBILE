# Bộ sơ đồ EcoShare v2

Các file mới không ghi đè bản gốc. Mỗi sơ đồ có `.drawio` để chỉnh sửa bằng diagrams.net, `.svg` để mở trực tiếp/in, `.mmd` cho Mermaid và bản `.png` xuất bằng `tools/export_diagram_png.py`.

- `class-diagram`: đúng 20 lớp **nghiệp vụ**. Activity, Fragment, Repository, adapter và service hạ tầng không nằm trong giới hạn mô hình nghiệp vụ.
- `erd`: 20 bảng tương ứng 1:1 với 20 lớp; mọi khóa ngoại dùng cùng tên trường. Thuộc tính tham chiếu ghi rõ đích và [1] hoặc [0..1]; mỗi bản ghi cha có thể được 0..* bản ghi con tham chiếu. Mermaid có bội số trực tiếp trên đường quan hệ. Số [0..1] chỉ quan hệ nullable từ bản ghi con sang cha, không có nghĩa là quan hệ 1:1 toàn cục.
- `function-diagram`: thay yêu cầu trao đổi bằng mua bán, có xác minh hai bên, thanh toán, hoàn tiền và phạm vi admin.

Nguồn sinh: `tools/generate_design.py`; data dictionary: `docs/domain-model.json`; SQL tham chiếu: `database/schema.sql`.

User gộp Account/Role/Profile; Listing + ListingItem quản lý chợ đồ cũ; ContentEntry gộp POST/TIP/SCAN và nội dung biên tập; MediaAsset quản lý ảnh/tệp; Interaction gộp thích/lưu/bình luận/kết bạn/thông báo/tham gia; Order + OrderItem thay Request/Exchange/Handover; Payment quản lý thanh toán/hoàn tiền; GreenLedger quản lý điểm; AuditLog + SystemSetting dùng chung cho admin, không thêm lớp Admin riêng.
