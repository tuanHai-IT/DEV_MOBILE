# API Firebase v1

Base cloud: `https://asia-southeast1-PROJECT_ID.cloudfunctions.net/api/v1` hoặc cùng Hosting `/api/v1`. Base Emulator xem [hướng dẫn](firebase-backend.md).

Header xác thực: `Authorization: Bearer <Firebase ID token>`. Dùng `Content-Type: application/json`. Lỗi có dạng `{error:{code,message,request_id?,fields?}}`. Danh sách thường `{items,next_cursor}`, nhận `limit=1..100` (mặc định 25) và `cursor=<last document ID>`. Chat dùng con trỏ thời gian + ID do response trả về. Thanh toán dùng `{data:...}`, chi tiết và mutation khác trả trực tiếp object. DELETE thành công trả 204.

Checkout, tạo bài bán, tạo phiên thanh toán, gửi chat và điều chỉnh điểm cần `Idempotency-Key` ổn định cho cùng thao tác (8–128 ký tự chữ/số/`_`/`-`; UUID dùng được). Timeout phải thử lại cùng khóa và cùng body. Không tạo khóa mới để giải quyết tình trạng chưa rõ đã thu tiền hay chưa.

| Phạm vi | Method / path | Nội dung |
|---|---|---|
| Công khai | GET `/health` | Trạng thái API |
| Công khai | GET `/categories`, `/collection-points`, `/content`, `/content/:id` | Danh mục/điểm hoạt động, nội dung xuất bản |
| Công khai | GET `/listings`, `/listings/:id` | Bài đã duyệt; danh sách lọc city/seller_id |
| Công khai | GET `/users/:id`, `/users/:id/reviews` | Hồ sơ công khai và đánh giá đã lọc PII |
| Cá nhân | GET/PATCH `/me` | Hồ sơ; PATCH chỉ display_name, phone, bio, city, avatar_key, cover_key |
| Nhận tiền | GET/PUT `/me/payout-account` | Khai báo riêng tư BANK hoặc MOMO; chỉ chính chủ. `/me` trả thêm `payout_account_ready`. Xem [chi tiết](payout-account.md). |
| Cá nhân | GET/POST `/me/addresses`, PATCH/DELETE `/me/addresses/:id` | Địa chỉ; recipient, phone, line, city, is_default |
| Xác minh | GET/POST `/me/verifications` | POST `{}` mở hồ sơ PENDING rồi upload chứng minh qua media |
| Bài bán | GET `/me/listings`, POST `/listings`, PATCH `/listings/:id` | Tạo mới/gửi lại phải VERIFIED và đã khai báo tài khoản nhận tiền; đưa lại hàng chờ duyệt |
| Tồn kho | PATCH `/listing-items/:id/stock` | Người bán đặt số lượng còn có thể bán: `{stock}` |
| Sản phẩm | PATCH `/listing-items/:id` | Người bán sửa trường sản phẩm/giá; thay đổi nội dung đưa bài về PENDING, đơn cũ giữ snapshot |
| Đơn hàng | POST `/orders`, GET `/me/orders`, GET `/orders/:id` | Checkout theo snapshot server; giới hạn người tham gia |
| Đơn hàng | POST `/orders/:id/cancel` | `{reason}`; chỉ chưa thanh toán/chưa có khoản đang xử lý |
| Đơn hàng | POST `/orders/:id/ship` | Seller `{carrier,tracking_code}`; cần PAID |
| Đơn hàng | POST `/orders/:id/complete` | Buyer `{}`; cần SHIPPED, cộng điểm một lần |
| Thanh toán | POST `/orders/:id/payment-sessions` | Buyer `{provider:"MOMO"|"VNPAY"|"EMULATOR"}`; EMULATOR chỉ local |
| Thanh toán | GET `/orders/:id/payments` | Người tham gia hoặc Admin |
| Chat | GET/POST `/conversations`, GET `/conversations/:id` | POST `{member_id,order_id?}`; xem chi tiết chỉ dành cho hai thành viên |
| Chat | GET/POST `/conversations/:id/messages` | POST `{body}` (hoặc text); GET `?newest=1&limit=20` đọc tin mới nhất trước, `cursor` đọc tin cũ; chỉ thành viên |
| Tương tác | GET `/me/interactions`, POST `/interactions`, DELETE `/interactions/:id` | LIKE/SAVE/FOLLOW/JOIN/REGISTER theo loại đích |
| Thông báo | GET `/me/notifications`, POST `/me/notifications/:id/read` | Thông báo trong app; chưa phải push |
| Điểm | GET `/me/points` | Số dư và ledger cá nhân |
| Khiếu nại | POST `/reports`, GET `/me/reports` | `{reason,listing_id? OR target_user_id? OR order_id?}`; đúng một đích |
| Đánh giá | POST `/orders/:id/reviews` | `{rating:1..5,body}` sau COMPLETED, một lần mỗi bên |
| Tệp | POST `/media`, POST `/media/:id/complete`, GET `/media/:id/download` | Ticket upload, kiểm tra file, tải có phân quyền |
| Tệp | GET `/media?parent_kind=...&parent_id=...` | Danh sách tệp READY; kiểm tra quyền của parent trước khi trả kết quả |

## Admin web và mobile

Các API cùng kiểm tra vai trò phía server; mobile chỉ nên hiển thị các chức năng cơ bản. Không nhúng vai trò admin trong APK.

| Vai trò | Method / path | Nội dung |
|---|---|---|
| ADMIN/MODERATOR | GET `/admin/dashboard`, `/admin/stats` | Moderator chỉ thấy số liệu kiểm duyệt |
| ADMIN | GET `/admin/users`, `/admin/users/:id`; PATCH `/admin/users/:id`; DELETE `/admin/users/:id` | PATCH `{role?,status?,reason}`; DELETE `{confirmation,reason}` gỡ Firebase Auth và `users/{uid}`, yêu cầu nhập lại email/UID; không cho xóa tài khoản đang đăng nhập; lưu audit và giữ các dữ liệu lịch sử/liên quan |
| ADMIN | GET `/admin/verifications`; POST `/admin/verifications/:id/review` | `{status:"VERIFIED"|"REJECTED",reason,expires_at?}` |
| ADMIN/MODERATOR | GET `/admin/listings`; POST `/admin/listings/:id/review`; DELETE `/admin/listings/:id` | Review: `{status:"APPROVED"|"REJECTED"|"HIDDEN",reason}`. DELETE: `{reason}` (5–1000 ký tự), trả 204, chuyển bài sang HIDDEN và ghi audit; người kiểm duyệt không được xử lý bài của chính mình. |
| ADMIN | GET `/admin/orders`; POST `/admin/orders/:id/resume` | Khôi phục sau khiếu nại `{reason}` nếu thanh toán/tồn kho hợp lệ và mọi report đã đóng |
| ADMIN | GET `/admin/payments`; POST `/admin/payments/:id/reconcile`, `/admin/payments/:id/refund` | Hoàn toàn bộ `{reason}` qua gateway, không sửa số tiền từ client |
| ADMIN/MODERATOR | GET `/admin/reports`; POST `/admin/reports/:id/resolve` | `{status:"RESOLVED"|"DISMISSED",reason}`; report đơn chỉ ADMIN |
| ADMIN | GET/POST `/admin/categories`, GET/PATCH/DELETE `/admin/categories/:id` | name, description, active; mutation kèm reason |
| ADMIN | GET/POST `/admin/collection-points`, GET/PATCH/DELETE `/admin/collection-points/:id` | manager_id?, name, address, latitude, longitude, materials, opening_hours, status; reason |
| ADMIN/MODERATOR | GET/POST `/admin/content`, GET/PATCH/DELETE `/admin/content/:id` | kind, title, body, status, parent_id?, starts_at?, ends_at?, points_cost?, metadata?; reason |
| ADMIN | GET `/admin/green-ledger`; POST `/admin/users/:id/points` | Đặt số dư đích `{points,reason}` (0–1.000.000), ghi chênh lệch vào sổ điểm và cập nhật balance cùng transaction; idempotent |
| ADMIN | GET `/admin/settings`, `/admin/settings/:key`; PATCH `/admin/settings/:key` | `{value,reason}`; whitelist key, không sửa receipt của payment |
| ADMIN | GET `/admin/audit-logs` | Nhật ký; filter actor_id/entity_type |

Danh sách `/admin/listings` mặc định hàng PENDING; muốn lịch sử dùng `?status=APPROVED`/REJECTED/HIDDEN. DELETE bài bán là ẩn mềm: bài biến khỏi chợ công khai, còn sản phẩm và đơn hàng đã phát sinh được giữ để đối soát. Bộ lọc payment: provider,kind,status,order_id. Bảng tham chiếu DELETE là tắt/ẩn mềm. Mutation Admin yêu cầu lý do, phần lớn ít nhất 5 ký tự; hoàn tiền/khôi phục cần ít nhất 10.

## Ví dụ checkout

```http
POST /api/v1/orders
Authorization: Bearer FIREBASE_ID_TOKEN
Content-Type: application/json
Idempotency-Key: 479c9be3-e876-49eb-b0af-49cb6537da1c

{"address_id":"OWN_ADDRESS_ID","items":[{"listing_item_id":"ITEM_ID","quantity":1}]}
```

Sau đó tạo payment-session của order trả về. Client mở `data.pay_url` theo response của cổng thanh toán. Không tự ghi PAID khi browser quay về; gọi GET order để lấy trạng thái backend. Chi tiết xem [tài liệu payment](payments-firebase.md).

Tạo bài bán gồm `title, description, city, tags?, latitude?, longitude?, items`. Mỗi item gồm `category_id,name,material,condition,price_vnd,stock,unit`; condition là NEW/LIKE_NEW/GOOD/FAIR/USED. Không nhận seller_id/status từ client.

Media ticket gồm `{parent_kind:"LISTING"|"MESSAGE"|"CONTENT"|"REPORT"|"VERIFICATION"|"AVATAR",parent_id,content_type}`. Ảnh đại diện và ảnh bìa dùng `parent_kind:"AVATAR"`, `parent_id` là UID; PATCH /me chỉ nhận media ID đã READY thuộc chính tài khoản đó. Media upload không truyền giấy tờ Base64 trong JSON API.

Gateway callback: POST `/payments/momo/ipn`, GET `/payments/vnpay/ipn`; không cần bearer nhưng bắt buộc chữ ký merchant đúng. POST `/emulator/payments/:id/result` chỉ tồn tại khi kết nối đủ emulator, yêu cầu ADMIN và provider EMULATOR; đây là công cụ kiểm thử, không deploy thành API xác nhận tiền thật.
