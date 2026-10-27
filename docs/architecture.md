# Kiến trúc và quy tắc EcoShare

## Phạm vi hiện tại

Chế độ đang chọn là **Firebase Spark**, giữ nguyên gói miễn phí: Firebase Authentication và Firestore chạy trên Google Cloud; API Node trong `backend/` chạy trên máy phát triển ở cổng **5002**. Ảnh nhỏ được lưu trực tiếp trong document MediaAsset của Firestore. Cloud Functions và Cloud Storage chưa được triển khai hoặc bật billing cho chế độ này.

Project thật là `recycling-share-app`, database Native `(default)` giữ vị trí hiện có `nam5`. Authentication Email/Password, Firestore rules và indexes đã được cấu hình trên project thật. Android native Java/XML và Admin web đã nối các luồng cộng đồng; trang Admin chính là `admin-web/index.html`, `backend.html` là trang tương đương. Các bài hiển thị lấy từ database, không dùng danh sách bài cố định ở frontend. Tài liệu hiện hành: [Firebase backend](firebase-backend.md), [API](firebase-api.md), [Android](android-firebase.md).

`backend/scripts/dev-cloud.mjs` khởi chạy bằng `npm --prefix backend run dev:cloud`. Server dùng phiên Firebase CLI đã đăng nhập của chủ project trong bộ nhớ để truy cập Firestore/Auth; không chép token hoặc khóa service account vào repo. Client vẫn phải gửi Firebase ID token và mọi endpoint vẫn kiểm tra role/status/quyền của người dùng. Trình duyệt Admin dùng `http://127.0.0.1:5002/v1`; bản Android debug của project hiện tại tự dùng Spark với `http://10.0.2.2:5002/v1`. Máy chủ Node cần chạy khi sử dụng các luồng này; chưa có API public được host trên Cloud Functions. Tác vụ hết hạn đơn chạy theo timer 5 phút của server local, không dùng Cloud Scheduler ở chế độ Spark.

Cloud có bộ mẫu tạo bằng `backend/scripts/seed-cloud.mjs`: 3 POST, 2 TIP, 1 SCAN riêng tư, 3 bài SALE/PENDING và ảnh trong Firestore, tất cả thuộc UID Admin thật. Script mặc định dry-run; `--apply` chỉ tạo bản ghi thiếu có prefix/marker sở hữu, giữ nguyên chỉnh sửa và dừng khi trùng ID không thuộc bộ mẫu. Không tạo tài khoản mật khẩu demo, KYC, đơn hàng hoặc thanh toán giả. Bài bán chờ người bán xác minh và người có quyền xét duyệt. Kiểm thử tự động và bộ mẫu giao dịch mô phỏng vẫn chỉ dùng project `demo-recycling-share` trên Emulator.

Thanh toán qua cổng đang tắt trong server Spark; sử dụng thật cần merchant, secret và hạ tầng callback phù hợp. SCAN là chụp/chọn ảnh rồi lưu riêng tư; chưa có mô hình nhận diện vật liệu. Các màn hình còn dùng prototype được ghi rõ trong tài liệu kiểm thử; việc nối cộng đồng không tự động nối toàn bộ tính năng cũ như OTP, bản đồ và đổi thưởng.

## 20 lớp nghiệp vụ

| # | Lớp / collection | Trách nhiệm |
| --- | --- | --- |
| 1 | User / users | Tài khoản, vai trò, hồ sơ và trạng thái |
| 2 | Verification / verifications | Xác minh chung cho người mua/người bán; lịch sử xét duyệt |
| 3 | Address / addresses | Địa chỉ nhận hàng |
| 4 | Category / categories | Danh mục sản phẩm |
| 5 | Listing / listings | Tin bán đồ cũ, vị trí, tags, kiểm duyệt; COMMUNITY giữ tương thích thiết kế cũ |
| 6 | ListingItem / listing_items | Sản phẩm, giá nguyên VNĐ, vật liệu, tình trạng, tồn kho |
| 7 | MediaAsset / media_assets | Metadata, quyền của ảnh/tệp; liên kết đúng một đối tượng |
| 8 | Interaction / interactions | Thích, lưu, bình luận, kết bạn, lịch sử, thông báo, theo dõi, tham gia |
| 9 | Order / orders | Đơn một người bán; snapshot giao hàng và tổng tiền |
| 10 | OrderItem / order_items | Chốt tên, giá, số lượng khi mua |
| 11 | Payment / payments | Thanh toán/hoàn tiền; liên kết khoản gốc |
| 12 | Conversation / conversations | Chat giữa hai tài khoản; có thể gắn đơn |
| 13 | Message / messages | Nội dung, người gửi, thời gian đọc; tệp qua MediaAsset |
| 14 | Review / reviews | Đánh giá sau khi đơn hoàn tất |
| 15 | Report / reports | Báo cáo tin/tài khoản, tranh chấp đơn và kết quả xử lý |
| 16 | CollectionPoint / collection_points | Điểm thu gom, đơn vị quản lý, tọa độ, giờ mở, vật liệu tiếp nhận |
| 17 | GreenLedger / green_ledger | Sổ điểm chống cộng trùng; User giữ cache số dư |
| 18 | ContentEntry / content_entries | POST, TIP, SCAN riêng tư và nội dung biên tập cũ |
| 19 | AuditLog / audit_logs | Nhật ký chỉ ghi thêm: người thao tác, đối tượng, lý do |
| 20 | SystemSetting / system_settings | Cấu hình có schema và khóa kỹ thuật nội bộ |

Giới hạn 20 áp dụng cho DTO nghiệp vụ và thực thể trong ERD logic; Class Diagram lớp Android đang chạy được vẽ riêng, gồm Activity, Fragment, client, repository và cache. Vai trò/trạng thái là enum có validation, không tạo bảng chỉ chứa tên trạng thái. DTO Java giữ cùng danh sách trường nền tảng với ERD; snake_case ở SQL đổi sang camelCase ở Java. Khóa là String/UUID, thời gian ISO-8601 UTC, tiền là số nguyên VNĐ. `User.id` liên kết Firebase Auth UID; DTO không lưu mật khẩu. Luồng Android hiện xử lý `JSONObject` và chưa khởi tạo 20 DTO đó trong các màn live.

## Cộng đồng và bạn bè

`ContentEntry.kind` có `POST`, `TIP`, `SCAN`, `STORY` và các loại biên tập `ARTICLE`, `GROUP`, `EVENT`, `CHALLENGE`, `REWARD`, `BADGE`. Trang chủ chỉ truy vấn POST/PUBLISHED; khám phá lấy TIP/PUBLISHED cùng Listing SALE/APPROVED và thử thách từ API. Nội dung POST/TIP tối đa 500 ký tự, có vật liệu, cân nặng, tags. API trả projection tác giả và ảnh hoàn tất upload. Trong Firestore, `materials`, `weight_kg`, `tags` có schema phía API; `metadata_json` giữ cho loại biên tập cũ. Bộ đếm, `_social`, khóa chống gửi trùng và cursor là chi tiết lưu trữ, không tạo thêm lớp nghiệp vụ.

Thích, lưu, bình luận dùng Interaction với `content_id`. PUT phản ứng khai báo trạng thái `active`, nên retry không cộng trùng. Bình luận PUBLISHED/HIDDEN và bộ đếm cập nhật cùng transaction, kể cả khi Admin ẩn/hiện lại. Danh tính người thích/lưu không công khai; SAVE không thông báo cho tác giả. POST/TIP được chia sẻ bằng Message có `content_id`/`content_kind`; không tạo Interaction kiểu SHARE. PATCH giữ nguyên vật liệu/cân nặng/tags nếu các trường đó không được gửi. Feed sắp bài mới trước, bình luận từ cũ đến mới; cursor có thời gian và ID để không bỏ sót bản ghi cùng timestamp. Bài HIDDEN/ARCHIVED không công khai, chỉnh sửa của tác giả không tự bỏ quyết định kiểm duyệt.

Kết bạn dùng Interaction/FRIEND_REQUEST: `user_id` là người gửi, `target_user_id` là người nhận, trạng thái PENDING/ACCEPTED/DECLINED, `_member_ids` chứa hai tài khoản. Mỗi cặp có một khóa xác định; chỉ người nhận được phản hồi. Thông báo dùng Interaction/NOTIFICATION với subtype và `read_at`; thích, bình luận, kết bạn tạo thông báo phía server trong cùng transaction. Không thêm bảng Friend, Comment hay Notification. JOIN/REGISTER tiếp tục tham chiếu ContentEntry; Conversation chỉ có hai người, chưa có chat nhóm.

## SCAN và quyền ảnh

SCAN lưu ContentEntry/SCAN trạng thái PRIVATE. Trong chế độ Spark, bytes ảnh nằm ngay trong document `media_assets`, không gọi Storage API. MediaAsset liên kết bằng `content_id`, `_parent_type=SCAN`, visibility bắt buộc PRIVATE. Xóa lịch sử chuyển thành ARCHIVED. REST API và Firestore rules chỉ cho chủ ảnh hoặc ADMIN đọc, kể cả bản ghi lỗi vô tình có status PUBLISHED. MODERATOR không xem SCAN. Admin được sửa tên/ghi chú và lưu trữ, không được công khai hóa ảnh.

`ECOSHARE_MEDIA_BACKEND=firestore` bật media Spark: ticket trả `upload_mode=FIRESTORE`, client PUT bytes vào `/media/:id/upload` bằng Bearer ID token rồi POST complete. JPEG/PNG/WebP tối đa **384 KiB**; PDF cùng giới hạn chỉ dành cho xác minh/báo cáo riêng tư. Server kiểm tra MIME, chữ ký đầu tệp, dung lượng, SHA-256 và quyền đối tượng cha trước READY. Bytes lưu trong `_inline_bytes`, có marker `_storage_backend=FIRESTORE`; trường nhị phân được miễn index và không xuất hiện trong JSON danh sách. Download kiểm tra quyền rồi trả bytes với MIME đúng; retry cùng ảnh không ghi trùng và không được ghi đè bằng ảnh khác. Trường kỹ thuật này không thêm lớp, collection hoặc trường nền tảng vào Class/ERD: mô hình vẫn đúng 20 lớp.

Adapter Storage vẫn có trong source như tùy chọn cho một triển khai Blaze riêng: upload ticket Storage, thu hồi token download dài hạn, URL có hạn. Nó không được gọi ở chế độ media Firestore và không phải dịch vụ đã bật trên project Spark hiện tại. Hồ sơ xác minh, báo cáo, tin nhắn, SCAN luôn riêng tư trong cả hai adapter; ảnh POST/TIP chỉ công khai khi bài PUBLISHED. User.avatar_key và User.cover_key chỉ nhận MediaAsset AVATAR công khai do chính tài khoản tải lên.

SQL tham chiếu và CHECK trong `tools/generate_design.py` bổ sung enum `STORY`/`CHALLENGE_COMPLETION` và ràng buộc SCAN riêng tư, giữ nguyên 20 bảng. Khi chỉ sửa CHECK không chạy toàn bộ generator vì nó còn sinh lại DTO và các artifact đã chỉnh riêng; sơ đồ hiện hành được sinh độc lập bằng `tools/generate_current_diagrams.py`.

## Mua bán và thanh toán

1. Xem công khai không cần xác minh; thao tác cá nhân cần đăng nhập.
2. Đăng bán cần ACTIVE và Verification VERIFIED còn hạn. Tin phải được duyệt trước khi niêm yết.
3. Đặt mua cần cả hai bên ACTIVE, VERIFIED, còn hạn và khác tài khoản. Sản phẩm cùng người bán, tin APPROVED, giá/số lượng hợp lệ, còn tồn. Không có trao đổi hiện vật hoặc COD trong luồng này.
4. Transaction đọc giá từ database, giữ tồn, chốt OrderItem, tổng tiền, địa chỉ. Idempotency-Key chống đơn trùng. Giỏ nhiều người bán tách thành nhiều đơn.
5. API tạo phiên thanh toán kiểm tra lại xác minh và hạn giữ tồn. Adapter backend có thể tạo Payment PENDING và gọi MoMo/VNPay khi được cấu hình; app hiện chỉ dùng màn thanh toán demo, không gọi API này.
6. Return URL giúp quay về app; kết quả tiền dựa trên IPN/query có chữ ký, đối chiếu merchant, giao dịch, số tiền. Callback lặp không cộng điểm hoặc ghi tiền trùng.
7. Tiền thực nhận vẫn ghi SUCCEEDED khi đơn hết hạn hoặc xác minh bị thu hồi; đơn DISPUTED để đối soát/hoàn tiền, không bỏ mất khoản tiền.
8. Người bán giao hàng, người mua hoàn tất; ledger cộng điểm một lần. Hủy đơn chỉ hoàn tồn khi xác định không còn khoản thanh toán đang chờ/chưa rõ kết quả.
9. Hoàn tiền tạo Payment/REFUND liên kết khoản gốc; cổng xác nhận kết quả rồi mới hoàn tất, đảo điểm một lần nếu cần.

Order: PENDING_PAYMENT, PAID, SHIPPED, COMPLETED, CANCELLED, DISPUTED, REFUND_PENDING, REFUNDED. Payment: PENDING, SUCCEEDED, FAILED, CANCELLED. `_reservation_state`, `_reserved`, receipt là chi tiết transaction Firestore. Provider EMULATOR chỉ chạy trong emulator; SQL tham chiếu production giữ MOMO/VNPAY.

## Quyền quản trị

Web là nơi làm việc chính của ADMIN: tài khoản, xác minh, nội dung, đơn, thanh toán, tranh chấp, danh mục, điểm xanh, cấu hình và nhật ký. API điểm thu gom có trong backend nhưng chưa có mục Admin Web hoặc luồng app. MODERATOR xử lý nội dung công khai trong phạm vi endpoint, không xem SCAN hoặc dữ liệu xác minh/tài chính. Mobile admin chỉ cung cấp chức năng cơ bản; các màn hình còn là prototype không được xem như nghiệp vụ đã kết nối.

Backend xác minh Firebase ID token và đọc role/status hiện tại trong User, không tin role từ app hoặc custom claim cũ. Mutation kiểm tra quyền, chủ sở hữu, trạng thái trong transaction. Client không ghi trực tiếp nghiệp vụ Firestore. Admin không sửa PAID/SUCCEEDED qua form tổng quát; receipt nội bộ không xuất hiện trong cấu hình có thể sửa. AuditLog không có API sửa/xóa. Xem hồ sơ xác minh và ảnh SCAN từ Admin được ghi nhật ký.

## API hiện hành

Chế độ Spark hiện tại dùng `http://127.0.0.1:5002/v1` trên máy phát triển; Android Emulator đổi host thành `10.0.2.2`. Cấu hình Cloud Functions `/v1` và Hosting rewrite `/api/v1` trong repo là tùy chọn triển khai riêng, chưa hoạt động trên project Spark. Danh sách/payload đầy đủ tại [firebase-api.md](firebase-api.md).

| Route | Trách nhiệm |
| --- | --- |
| Firebase Authentication SDK/REST | Đăng nhập/đăng ký; Bearer ID token cho API |
| /me, /me/addresses, /me/verifications | Hồ sơ, địa chỉ, xác minh |
| /posts, /tips; /posts/:id, /tips/:id | Feed, tạo/sửa/xóa theo chủ sở hữu |
| /posts/:id/comments, /posts/:id/reactions/:type | Bình luận và LIKE/SAVE; tips có route tương ứng |
| /friends, /friends/requests, /friends/requests/:id/respond | Bạn bè và lời mời |
| /notifications, /notifications/read-all, /notifications/:id/read | Thông báo riêng và đã đọc |
| /scans, /scans/:id, /media, /media/:id/upload, /media/:id/complete | SCAN, ticket, PUT bytes Firestore và hoàn tất upload |
| /listings, /listing-items/:id, /orders, /me/orders | Chợ đồ cũ, tồn kho, đặt mua |
| /orders/:id/payment-sessions, /orders/:id/payments | Khởi tạo thanh toán và đọc kết quả |
| /payments/momo/ipn, /payments/vnpay/ipn | Callback có chữ ký |
| /conversations, /conversations/:id/messages | Chat có quyền |
| /admin/community, /admin/community/:id/comments, /admin/comments/:id | Quản lý POST/TIP, SCAN và bình luận |
| /admin/users, /admin/verifications, /admin/orders, /admin/payments | Quản trị tài khoản, xác minh, giao dịch |

`database/schema.sql` là mô hình SQLite tham chiếu để review/test Class và ERD, không phải database production. Android có SQLite riêng `ecoshare_public_snapshots.db` chỉ giữ bản đọc công khai đã xem để mở khi mất mạng; các trang riêng tư trong cùng phiên chỉ ở RAM. Firestore vẫn là nguồn dữ liệu chính. Backend dùng Firestore transaction cho xác minh, tồn kho, giá, thanh toán và điểm. Ràng buộc SQL không thay thế validation, phân quyền hay state machine trên server.

## Tài liệu cổng thanh toán

MoMo: [Payment Notification](https://developers.momo.vn/v3/docs/payment/api/result-handling/notification/). VNPay: [Kết nối cổng thanh toán](https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html). Adapter server ở `backend/src/payments.ts` kiểm tra chữ ký, merchant, số tiền; cần secret merchant để sử dụng thật. Hoàn tiền VNPay tự động chưa triển khai; API trả lỗi rõ ràng thay vì ghi nhận hoàn tiền giả.
