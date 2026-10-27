# Khôi phục giao diện Admin web — 19/10/2026

Admin web đã trở lại phong cách của [thiết kế ban đầu](previews/admin-desktop.png): sidebar xanh đậm, mục đang chọn màu xanh chanh, nền trắng ngà, tiêu đề Playfair Display và chữ Be Vietnam Pro. Font được phục vụ từ project để giao diện không phụ thuộc Google Fonts.

Sidebar gom chức năng theo nhóm, hiển thị tài khoản đang đăng nhập và giữ phần nội dung rộng rãi hơn. Tổng quan có bốn thẻ chỉ số, biểu đồ công việc đang chờ xử lý, hàng chờ quản trị và bảng đơn hàng. Các số liệu đọc từ API; biểu đồ thể hiện dữ liệu công việc hiện có.

Bảng quản trị có tìm kiếm trong trang hiện tại, lọc trạng thái, nhãn vai trò/trạng thái bằng tiếng Việt và thời gian theo múi giờ Việt Nam. Tìm kiếm trong trang không thay thế truy vấn trên toàn bộ database. Bảng rộng cuộn ngang trong khung riêng. Trên điện thoại, sidebar chuyển thành menu trượt, hỗ trợ bàn phím và trả focus về nút mở menu khi nhấn Escape.

`index.html` và `backend.html` dùng cùng giao diện kết nối Firebase. Các luồng đăng nhập, phân quyền, chỉnh sửa và kiểm duyệt tiếp tục dùng API hiện có.

## Kiểm tra

Kiểm tra trên Edge headless với profile QA riêng, tại origin localhost cổng 5175. Cấu hình demo được cấp riêng trong bộ phục vụ QA; cấu hình Spark đang dùng tại cổng 5173 giữ nguyên. Chỉ dùng Firebase Emulator `demo-recycling-share`, không đọc phiên trình duyệt của người dùng và không ghi Firebase cloud.

| Kiểm tra | Kết quả |
| --- | --- |
| Client web, cấu hình và trang đặt mật khẩu | 22/22 kiểm thử đạt |
| Đăng nhập, tổng quan, tạo danh mục, lọc tin bán, chi tiết và quyền tệp đính kèm | 5/5 luồng trình duyệt đạt, gồm phân quyền Moderator |
| Bài chia sẻ, nội dung đầy đủ, bình luận, sửa bài, ẩn bài và quyền SCAN | 6/6 luồng trình duyệt đạt |
| Tìm kiếm không có kết quả và xóa từ khóa để khôi phục bảng | Đạt |
| Desktop: sidebar, bốn thẻ chỉ số, bảng người dùng và hộp chi tiết | Đạt; không tràn ngang toàn trang |
| Mobile 375 × 812: bảng, menu trượt và biểu mẫu tạo bài | Đạt; bảng cuộn trong khung, hộp thoại nằm trong viewport |
| Menu mobile: mở, Tab quay vòng trong menu, Escape trả focus, chọn mục đóng menu | Đạt |
| Bộ lọc bài đã đăng và hộp thoại tạo nội dung | Đạt |
| Lỗi JavaScript chưa xử lý trong các lượt chạy | 0 |

Các lượt tạo/sửa/ẩn bài kiểm thử chỉ tác động Emulator. Tài khoản cloud, quyền Admin và dữ liệu cloud hiện có giữ nguyên. Ảnh bên dưới dùng dữ liệu Emulator, có nhãn môi trường ở thanh trên.

Lượt rà soát tích hợp tiếp theo phát hiện phản hồi tải media đến muộn có thể chèn tệp vào một hộp thoại khác đã mở sau đó. Hộp thoại chi tiết hiện gắn mã phiên cho yêu cầu media và bỏ qua phản hồi cũ; lỗi tải media hiển thị trong chính hộp thoại. Bài kiểm thử trình duyệt giữ yêu cầu media ở trạng thái chờ, chuyển sang form duyệt rồi trả phản hồi, xác nhận form không bị thay đổi. Bộ browser 11/11 và kiểm tra desktop/375px chạy lại đạt.

## Ảnh sau khi chỉnh sửa

- [Tổng quan desktop](previews/admin-restored/dashboard.png)
- [Người dùng desktop](previews/admin-restored/users.png)
- [Hộp chi tiết desktop](previews/admin-restored/detail.png)
- [Danh sách trên mobile](previews/admin-restored/mobile-users.png)
- [Menu mobile](previews/admin-restored/mobile-menu.png)
- [Bài chia sẻ trên mobile](previews/admin-restored/mobile-posts.png)
- [Biểu mẫu tạo bài trên mobile](previews/admin-restored/mobile-composer.png)

Chạy panel theo [hướng dẫn Admin web](../admin-web/README.md). Nếu trình duyệt đang mở giao diện cũ, tải lại bằng **Ctrl + F5**.
