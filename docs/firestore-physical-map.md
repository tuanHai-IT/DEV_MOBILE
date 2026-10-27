# Đối chiếu ERD logic với Firestore đang dùng

[Class Diagram](../Recycling%20Share%20App/diagrams-current/class-diagram.svg) và [ERD logic](../Recycling%20Share%20App/diagrams-current/erd.svg) chỉ vẽ **18 thực thể có luồng giao diện trong app/Admin Web**. Tài liệu này đối chiếu toàn bộ **20 collection backend** từ `docs/domain-model.json` và `database/schema.sql`; do đó còn liệt kê `reviews` và `collection_points`, vốn không xuất hiện trong sơ đồ phạm vi app. `payments` được giữ trong sơ đồ vì Admin Web có trang quản lý/đối soát giao dịch. File SQL là schema SQLite **tham chiếu**, không phải database đang chạy. Backend dùng Firebase Authentication cho định danh và Cloud Firestore cho dữ liệu; quan hệ trong Firestore được lưu bằng ID và được kiểm tra trong API/transaction, không có khóa ngoại do Firestore áp đặt. Android còn có SQLite riêng để cache nội dung công khai; cache đó không thuộc ERD nghiệp vụ.

## Collection và cấu trúc vật lý

Đối chiếu lời gọi `collection(...)` trong `backend/src/*.ts` với `firestore.rules` cho thấy backend hiện truy cập đúng 20 collection **cấp cao nhất** sau, tương ứng 1–1 với 20 thực thể logic:

| Nhóm | Collection cấp cao nhất |
| --- | --- |
| Tài khoản | `users`, `verifications`, `addresses` |
| Cộng đồng | `content_entries`, `interactions`, `conversations`, `messages`, `media_assets` |
| Chợ và giao dịch | `categories`, `listings`, `listing_items`, `orders`, `order_items`, `payments`, `reviews`, `reports` |
| Vận hành | `collection_points`, `green_ledger`, `audit_logs`, `system_settings` |

Backend không tạo subcollection dưới document và không tạo collection riêng cho story, SCAN, thông báo, lời mời kết bạn, ảnh chat, hóa đơn cổng thanh toán hoặc con trỏ quét đơn. Các loại bản ghi đó dùng collection trong bảng trên. Đây là kết quả kiểm tra **mã nguồn hiện tại**, không phải phép đếm document trên Firestore production; một collection có thể đang rỗng.

## Các trường vật lý có tác động đến sơ đồ

`domain-model.json` ghi các trường nền tảng. Firestore còn có trường lưu trạng thái vận hành và dữ liệu đa hình dưới đây; một số trường đã được đồng bộ vào ERD trong lượt rà soát. Bảng liệt kê những chi tiết cần biết để đọc ERD, không coi mỗi trường là một thực thể mới.

| Document | Trường/loại phát sinh trong backend | Ý nghĩa |
| --- | --- | --- |
| `users` | `points_balance`, `_verification_id`, `_pending_verification_id`, `verification_status`, `updated_at` | Điểm hiện tại và liên kết nhanh đến hồ sơ xác minh; `User.id` là Firebase Auth UID. [Nguồn](../backend/src/core.ts#L275), [xác minh](../backend/src/community.ts#L479) |
| `content_entries` | `POST`, `TIP`, `SCAN`, `STORY` và nội dung biên tập khác cùng collection; `materials`, `weight_kg`, `tags`, `created_at`, `updated_at`, `like_count`, `saved_count`, `comment_count`; story có `expires_at`, `duration_ms` | SCAN là bản ghi riêng tư, story có hạn 24 giờ, bài/mẹo có bộ đếm và vật liệu. [Bài/mẹo](../backend/src/social.ts#L209), [story](../backend/src/social.ts#L396) |
| `interactions` | `status`, `subtype`, `_member_ids`, `parent_comment_id`, `like_count`; `type` gồm `COMMENT_LIKE`, `FRIEND_REQUEST`, `NOTIFICATION`, `CHALLENGE_COMPLETION` | Bình luận và phản hồi, thích bình luận, bạn bè, thông báo và hoàn thành thử thách cùng một collection. [Bình luận](../backend/src/social.ts#L275), [bạn bè](../backend/src/social.ts#L560) |
| `conversations` | `status`, `request_sender_id`, `request_recipient_id`, `accepted_at`, `updated_at`, `last_message`, `_member_ids` | Tin nhắn chờ là hội thoại `PENDING`; chấp nhận/từ chối đổi trạng thái trên cùng document. [Nguồn](../backend/src/community.ts#L700) |
| `messages` | `content_id`, `content_kind`, `_member_ids`, `_idempotency_key` | Tin nhắn chia sẻ POST/TIP giữ liên kết nội dung; ảnh chat là `media_assets` liên kết qua `message_id`. [Nguồn](../backend/src/community.ts#L855), [ảnh](../backend/src/media.ts#L262) |
| `media_assets` | `_parent_type`, `_parent_id`, `_status`, `_storage_backend`, `_inline_bytes`, `_inline_sha256`, `size_bytes` | Ảnh avatar, bài, tin bán, chat, SCAN, bằng chứng dùng quan hệ cha đa hình. Chế độ Spark lưu bytes trong document; adapter Storage là tùy chọn. [Nguồn](../backend/src/media.ts#L20), [tạo ảnh](../backend/src/media.ts#L262) |
| `listing_items` | `_reserved` | Số lượng đang giữ cho đơn chờ thanh toán; `stock` là phần còn bán được. [Nguồn](../backend/src/marketplace.ts#L686) |
| `orders` | `expires_at`, `_reservation_state`, `_active_payment_id`, `_member_ids`, `_request_hash` cùng cờ đối soát/giải phóng tồn kho | Đơn giữ hàng 20 phút và quản lý trạng thái đặt chỗ/đối soát. [Nguồn](../backend/src/marketplace.ts#L656), [đối soát](../backend/src/payments.ts#L620) |
| `payments` | `user_id`, `merchant_id`, `provider_reference`, `provider_transaction_id`, `pay_url`, `expires_at`, `_gateway_state`, `_member_ids` | Chỉ được tạo bởi API backend khi cổng được cấu hình hoặc chạy Firebase Emulator; giao diện MoMo/VNPay **demo** hiện tại của Android lưu kết quả trong SharedPreferences, không tạo giao dịch tiền thật. [Backend](../backend/src/payments.ts#L920), [Android](../app/src/main/java/com/example/recyclingshareapp/ui/CommunityFragment.java#L3306) |
| `system_settings` | Document `internal_expiry_scan` và `receipt_<hash>` bên cạnh cấu hình admin | Lưu con trỏ quét đơn hết hạn và khóa chống dùng lại mã giao dịch; đây không phải collection mới. [Quét đơn](../backend/src/marketplace.ts#L143), [receipt](../backend/src/payments.ts#L700) |

`collection_points` có API đọc/quản trị trong backend, nhưng không có màn hình hay luồng truy cập đang dùng trong Android và đã được gỡ khỏi menu Admin Web. Giữ collection này trong ERD dữ liệu hiện có; không đưa nó vào sơ đồ chức năng đang sử dụng của app. [API đọc](../backend/src/marketplace.ts#L202), [API quản trị](../backend/src/admin.ts#L674).

## Giới hạn giữa SQL tham chiếu và Firestore

- `database/schema.sql` đã khai báo `STORY`, `CHALLENGE_COMPLETION`, `Interaction.parent_comment_id`, `Message.content_id/content_kind` và `Report.content_id` để khớp chức năng đang chạy. `ContentEntry.created_at` và các trường vận hành trong bảng trên vẫn là phần mở rộng Firestore, chưa nằm trong SQL tham chiếu.
- Ràng buộc SQL `media_assets` yêu cầu đúng một trong năm cột cha (`listing_id`, `message_id`, `content_id`, `report_id`, `verification_id`) có giá trị. Ảnh avatar/cover thật có năm cột này bằng `null`, dùng `_parent_type='AVATAR'` và `_parent_id=<uid>`. Vì vậy không thể dùng CHECK đó để khẳng định SQL tái hiện đầy đủ avatar của Firestore. Quyền đọc/ghi ảnh vẫn được API kiểm tra theo cha.
- Đừng hiểu `payments` trong ERD là bằng chứng app đang thanh toán qua MoMo/VNPay thật. Backend chứa cổng thanh toán có điều kiện cấu hình, còn luồng người dùng đang dùng `payment_demo`; hai trạng thái triển khai cần được ghi riêng trong sơ đồ chức năng.

Kiểm tra xác nhận: `python tools/validate_design.py` đạt 14/14; `npm --prefix backend test` với Auth/Firestore/Storage Emulator demo đạt 147/147, không bỏ qua ca tích hợp.
