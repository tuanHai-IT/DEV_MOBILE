# Tải dữ liệu Android theo trang

Cập nhật 20/10/2026: các tab Trang chủ, Khám phá, Tin nhắn và Hồ sơ giữ lại giao diện đã mở khi đổi tab, dừng polling ở tab ẩn và đọc lại ở nền khi có thay đổi. Lượt đọc foreground độc lập chạy trong pool tối đa 3 worker để một màn hình tải chậm không chặn màn hình khác hoặc thao tác ghi. Bitmap lấy mẫu theo kích thước hiển thị và được giữ trong LRU có giới hạn; các tác vụ ảnh/story và mã hóa hồ sơ chạy ở nền. Chi tiết nguyên nhân, số đo và kiểm thử ở [performance-review.md](performance-review.md).

Sau khi Firebase Auth xác thực thành công, app bắt đầu đọc `/posts?limit=6` song song với `/me`. Khi hồ sơ đã sẵn sàng, app chờ tối đa 2 giây cho trang bài đầu rồi mở Trang chủ. Nếu API chậm hoặc lỗi, Trang chủ vẫn mở và hiển thị trạng thái tải hoặc nút thử lại. Việc đăng nhập không phụ thuộc vào các màn hình được nạp trước.

Trang chủ chỉ hiển thị `POST` đã xuất bản. Mỗi lần đọc lấy tối đa 6 bài; khi người dùng cuộn gần cuối, app dùng `next_cursor` của API để lấy 6 bài kế tiếp. Mẹo hay, Chợ đồ cũ, bạn bè, thông báo, lịch sử SCAN, đơn hàng, tin bán và bài trong hồ sơ cũng đọc theo trang. Không tải toàn bộ tập dữ liệu khi mở một màn hình. Các danh sách ghép từ hai nguồn độc lập, như bài đã lưu trong hồ sơ, giữ nút “Xem thêm” riêng cho từng nguồn.

Các trang thường mở sau đăng nhập được nạp tuần tự ở nền: Mẹo hay, Chợ đồ cũ, thông báo, lời mời kết bạn và bài trong hồ sơ. App chỉ nạp trước ảnh đầu tiên của tối đa 3 bài viết và 3 mẹo đầu; ảnh khác tải khi nội dung được dựng. Tác vụ nền không chặn thao tác ở màn hình hiện tại và các yêu cầu trùng đường dẫn được gộp lại.

Dữ liệu JSON và ảnh đã đọc được giữ **trong bộ nhớ của phiên đăng nhập** với giới hạn dung lượng và thời hạn ngắn. App dùng dữ liệu này để vẽ lại ngay khi đổi tab hoặc quay về từ chi tiết, đồng thời giữ vị trí cuộn. Khi mất kết nối, các trang riêng tư đã xem như thông báo, đơn hàng và hội thoại có thể đọc từ bộ nhớ của **đúng tài khoản trong phiên hiện tại**. Đăng xuất/đổi tài khoản xóa dữ liệu riêng tư; token và dữ liệu riêng tư không được ghi vào SQLite.

Khi app đang ở tiền cảnh, màn hình đang mở kiểm tra dữ liệu mới khoảng mỗi 15 giây. Lần kiểm tra này đi tới API thay vì lấy lại JSON còn hạn trong bộ nhớ: điểm Eco đọc lại từ `/me`, danh sách đọc lại những hàng đã tải (tối đa 100 hàng), và chi tiết bài/mẹo chỉ thay thẻ bài khi nội dung đổi. Vị trí cuộn và ô bình luận được giữ khi cập nhật. App ngừng kiểm tra khi màn hình rời tiền cảnh; thay đổi từ Admin Web sẽ xuất hiện khi có kết nối và đến lượt kiểm tra tiếp theo, không cần chuyển tab hay tải lại trang.

Các trang công khai đã tải thành công (bài chia sẻ, mẹo hay, tin bán đã duyệt, chi tiết, bình luận và ảnh công khai) còn được lưu trong SQLite `ecoshare_public_snapshots.db`, tối đa 120 trang và 16 ảnh. Nếu lỗi mạng hoặc backend tạm ngắt, app đọc bản đã xem từ SQLite; lỗi phân quyền 401/403 không dùng bản lưu để vượt quyền. Các thao tác ghi cần mạng và sẽ làm vô hiệu bản cache liên quan sau khi thành công. Cơ sở dữ liệu snapshot không tham gia sao lưu/di chuyển thiết bị theo `backup_rules.xml` và `data_extraction_rules.xml`; máy mới sẽ đọc lại từ Firestore qua API.

API áp dụng `limit` từ 1 đến 100 và trả `{ items, next_cursor }`. Ví dụ:

```text
GET /v1/posts?limit=3
GET /v1/posts?limit=3&cursor=<next_cursor>
```

`next_cursor` rỗng hoặc `null` nghĩa là đã hết dữ liệu. Bài viết được sắp theo thời điểm tạo giảm dần rồi theo ID để các trang ổn định; client chống hiển thị trùng ID khi dữ liệu thay đổi giữa các lần đọc. Phản hồi lỗi khi lấy trang tiếp theo giữ nguyên các bài đã tải và có nút thử lại hoặc tải lại từ đầu nếu cursor không còn hợp lệ.

Chế độ Spark miễn phí vẫn cần API Node cục bộ tại cổng 5002 để đọc Firestore thật. Khi API ngắt, app chỉ xem được bản đã lưu; không lấy nội dung mới, đồng bộ thay đổi hoặc gửi bài/tin nhắn/giao dịch. Nếu mở lại app khi đã mất mạng và phiên đăng nhập trong RAM không còn, chọn **Xem nội dung công khai** ở màn đăng nhập để đọc các trang đã lưu. Chế độ này chỉ có Trang chủ, Khám phá và chi tiết bài/mẹo/tin bán công khai; thao tác thích, lưu, bình luận, mua hàng và các màn riêng tư cần đăng nhập cùng kết nối. Bản riêng tư trong RAM mất khi tiến trình app kết thúc; SQLite chỉ giữ dữ liệu công khai đã xem.

Để tự kiểm tra: cài APK debug mới, đăng nhập khi có mạng và mở một bài chia sẻ, một mẹo hoặc tin bán đã duyệt; chờ nội dung và ảnh tải xong. Sau đó ngắt mạng hoặc dừng API cổng 5002, đóng hẳn app rồi mở lại. Ở màn đăng nhập, chọn **Xem nội dung công khai** và mở lại đúng mục đã xem. Mục chưa từng mở sẽ báo chưa có bản lưu; khi kết nối trở lại, chạm để thử tải lại.

Lượt kiểm tra tích hợp ngày 19/10/2026 đạt **39/39 Android với Emulator**, **1/1 chat UI riêng**, **1/1 Android chỉ đọc Firebase cloud**, **17/17 JVM** và **130/130 backend**. Trong 39 ca có 3 ca SQLite offline, 2 ca xoay ngang. Ngày 20/10/2026 đã chạy lại riêng **3/3 ca SQLite** và **1/1 ca giao diện offline sau khi mất phiên**, dùng lỗi kết nối giả lập. Bằng chứng và lệnh kiểm tra nằm tại [verification.md](verification.md).
