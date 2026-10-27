# Rà soát giao diện Android — 18/10/2026

Giữ lại thiết kế mới của màn hình đăng nhập, bảng tin, khám phá, tin nhắn và hồ sơ. Không thay source Figma/React hoặc Admin web vì thay đổi người dùng nằm ở Android native.

## Điều chỉnh giao diện

- Đồng bộ khoảng cách và vùng chạm tối thiểu 48dp cho các điều khiển; toolbar và tab bar phù hợp hơn với nội dung và cỡ chữ.
- Ẩn thanh tab trên màn hình con và khi bàn phím mở, dành thêm không gian cho chat và biểu mẫu.
- Tăng tương phản chữ phụ và nhãn màu vàng; hiện trạng thái đã thích/đã lưu ngay trên nút.
- Chat dùng bubble native, tự xuống dòng, tự cuộn, hỗ trợ gửi từ bàn phím và các câu trả lời nhanh.
- Bộ lọc vật liệu và các tab Bài đăng/Mẹo/Đã lưu trên hồ sơ hoạt động với dữ liệu mẫu; có trạng thái rỗng phù hợp.
- Nút chia sẻ mở trình chọn chia sẻ của Android; Google/Apple và gọi điện thông báo chưa kết nối thay vì giả vờ hoàn tất.

## Lỗi đã sửa

1. Tin nhắn gửi xong bị ẩn và input bị xóa: render bubble trực tiếp, lưu trước khi xóa input.
2. Chọn Hoa/Minh/Anh/Hùng đều mở cùng một hội thoại: tách lịch sử theo liên hệ, đồng bộ tên/avatar/preview, liên hệ người bán mở đúng Minh.
3. UI hiện 1.240 điểm nhưng đơn đầu chỉ còn 10: tất cả màn hình và thanh tiến độ đọc cùng số dư thực, bắt đầu từ 0.
4. Sửa tiểu sử/thành phố nhưng hồ sơ không đổi: bổ sung binding và quay về hồ sơ sau lưu.
5. Địa chỉ đã lưu nhưng mở lại form trống: nạp dữ liệu vào cả Addresses và Checkout.
6. OTP khôi phục mật khẩu đăng nhập thành tài khoản mới: tách mục đích đăng ký/khôi phục, giữ mục đích qua recreate Activity; khôi phục quay về Login.
7. Mất đường vào Admin, nhóm, sự kiện và phần thưởng: khôi phục trong Settings/Explore.
8. Test mua hàng vẫn tham chiếu `nav_market` đã xóa: dùng lối vào Chợ đồ cũ từ Home.
9. `configure_native.py` có thể ghi đè thanh điều hướng mới: mặc định/`--check` chỉ kiểm tra; `--format` chỉ căn lề XML hiện có.
10. Màn chi tiết đơn hiện các nút không hợp lệ ở mọi trạng thái: chỉ hiện thao tác phù hợp; không hiện thử thanh toán lại sau khi đã trả tiền.
11. Không có kết quả tìm kiếm nhưng vẫn có nút mở sản phẩm: ẩn nút khi dữ liệu mẫu không khớp.

## Nguồn sửa và kiểm tra

`tools/generate_android.py` chứa thiết kế; `tools/native_refinements.py` bổ sung tương tác/ID/vùng chạm để sinh lại layout vẫn giữ các bản sửa. `MainActivity` quản lý navigation/binding; `ui/ChatPresenter` quản lý giao diện và lịch sử chat cục bộ. Các DTO nghiệp vụ và sơ đồ không thay đổi.

Build debug và unit test đã qua. Instrumentation chạy trên emulator tách riêng để kiểm tra 51 layout, luồng mua bán và các regression mới. Chi tiết kết quả ở `verification.md`. Các kiểm thử dùng callback View trên UI thread, có kiểm tra recreate Activity; ảnh preview chụp qua thao tác chạm thực bằng ADB.

Ảnh giao diện:

- [Trang chủ](previews/android-home-review.png)
- [Hồ sơ](previews/android-profile-review.png)
- [Chat đúng người và tin nhắn vừa gửi](previews/android-chat-review.png)
- [Đăng nhập](previews/android-login-review.png)

Ứng dụng vẫn dùng dữ liệu demo, chưa kết nối Auth/KYC/thanh toán hoặc đồng bộ backend thật. Đây là giới hạn của prototype, không thay đổi trong lần rà soát giao diện này.
