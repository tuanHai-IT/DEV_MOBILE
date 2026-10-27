# Quản trị bài chia sẻ, mẹo hay và ảnh SCAN

Trang mặc định trong `admin-web/index.html` dùng Firebase Auth và API thật. `content_entries` tiếp tục lưu các loại POST, TIP và SCAN; bình luận lưu trong `interactions` với type COMMENT. Không tăng số lớp nghiệp vụ hoặc tạo collection mới.

| API | Quyền và hành vi |
| --- | --- |
| `POST /admin/community` | Admin tạo POST/TIP với tác giả là chính mình; `reason` và `Idempotency-Key` bắt buộc |
| `GET /admin/community?kind=POST\|TIP\|SCAN&status=...&author_id=...` | Admin/Moderator; Moderator chỉ POST/TIP; phân trang `limit`, `cursor` |
| `GET /admin/community/:id` | Toàn văn; SCAN chỉ Admin và ghi nhật ký truy cập |
| `PATCH /admin/community/:id` | Sửa trường nội dung cho phép; bắt buộc `reason` |
| `DELETE /admin/community/:id` | Lưu trữ, giữ bản ghi/tệp/liên kết; bắt buộc `reason` |
| `GET /admin/community/:id/comments` | Bình luận POST/TIP, lọc `status=PUBLISHED\|HIDDEN`, phân trang |
| `PATCH /admin/comments/:id` | Sửa `body` và/hoặc `status`, bắt buộc `reason` |
| `DELETE /admin/comments/:id` | Ẩn bình luận, bắt buộc `reason` |

POST/TIP có trạng thái DRAFT, PUBLISHED, HIDDEN hoặc ARCHIVED. SCAN chỉ PRIVATE hoặc ARCHIVED. Ảnh SCAN không được đổi thành bài công khai, không cho Moderator xem, không có bình luận công khai.

PATCH bài cho phép `title` (tối đa 120 ký tự), `body` (500 ký tự), `materials` (12 mục, mỗi mục 60 ký tự), `weight_kg` (0–100000 hoặc null), `tags` (12 mục, mỗi mục 40 ký tự), `status`, `reason`. Bài chia sẻ/mẹo hay không được để nội dung trống. SCAN chỉ sửa tên, ghi chú hoặc trạng thái riêng tư/lưu trữ. Không cho sửa tác giả, loại nội dung, thời gian tạo hay bộ đếm qua payload.

Tệp được xem qua `/media?parent_kind=CONTENT\|SCAN&parent_id=...` và `/media/:id/download`, với kiểm tra quyền của bản ghi cha. Panel không hiển thị đường dẫn public vĩnh viễn cho ảnh SCAN. Bình luận được sửa trong transaction cùng bộ đếm: ẩn lặp lại không trừ thêm; khôi phục chỉ cộng một lần. Role/status của người xử lý được đọc lại trong transaction để từ chối quyền đã bị thu hồi.

`backend/test/social-admin.test.ts` kiểm tra bảy tình huống bằng Firestore Emulator: quyền và SCAN riêng tư, kể cả đường dẫn quản trị cũ; tạo bài một lần kèm nhật ký; sửa thật; chặn payload/đổi danh tính/quyền cũ; lưu trữ SCAN; bộ đếm bình luận khi ẩn/khôi phục; giữ dữ liệu tham chiếu khi lưu trữ. `admin-web/tests/social-smoke.html` kiểm tra đăng nhập, xem toàn văn/bình luận, sửa/ẩn trong panel và đọc lại qua API công khai. Các kiểm thử bị giới hạn ở localhost với project demo.

Đã xác nhận bằng Emulator: **7/7** kiểm thử quản trị; **5/5** kiểm thử router thực tế với Firebase ID token; **4/4** kiểm tra HTTP qua Functions/Auth/Firestore/Storage/Hosting; **6/6** tình huống trên trình duyệt Edge. Kiểm tra trình duyệt xác nhận trang mặc định đọc bài từ database, mở toàn văn và bình luận, ẩn bình luận cập nhật bộ đếm, sửa bài được lưu thật, bài ẩn không còn đọc công khai, và Moderator không thấy khu vực SCAN. Kiểm tra HTTP còn tải JPEG SCAN thật từ Storage và sửa/đọc lại/khôi phục một bài mẫu. Đây là dữ liệu Firebase Emulator cục bộ; chưa phải xác nhận triển khai cloud.

`backend/test/social-app.test.ts` chạy toàn bộ `createApp` với token do Auth Emulator cấp, kiểm tra các đường dẫn `/content`, `/admin/content`, `/interactions` cũ không làm lộ SCAN hoặc bỏ qua bộ đếm mới. Suite không xóa database và dùng mã ngẫu nhiên cho dữ liệu kiểm tra. Log cục bộ: `.qa/social-admin-tests.txt`, `.qa/social-app-tests.txt`, `.qa/social-http-smoke.txt`; ảnh kết quả trình duyệt: `.qa/social-browser-result.png`.
