# Backend Firebase của EcoShare

Chế độ đang chọn giữ **gói Spark**, chạy **Node 22 trên máy tính + Firebase Authentication/Firestore cloud**. API local ở `http://127.0.0.1:5002/v1`; dữ liệu và ảnh inline ở Firestore. Không triển khai Cloud Functions, không tạo/dùng Cloud Storage cho chế độ này. Source Functions v2 với các export `api`/`expireReservations` và adapter Storage vẫn còn trong repo để kiểm thử hoặc phát triển sau. `database/schema.sql` là tài liệu tham chiếu.

Ngày **19/10/2026**, Firebase CLI đã đăng nhập; Authentication Email/Password, Firestore Rules/Indexes đã triển khai vào project `recycling-share-app`. Database `(default)` nằm ở `nam5`, billing vẫn tắt. Tài khoản Auth/Admin thật đã bootstrap và chủ tài khoản đã tự đặt mật khẩu. Seed cloud đã tạo **23 document** gắn với Admin thật; đã kiểm tra đọc dữ liệu, ảnh và sửa–đọc–khôi phục bài qua database/API. Tên bucket `recycling-share-app.firebasestorage.app` trong Android JSON không có nghĩa Storage đang được dùng. Các luồng Android chính và Admin web đã nối API; xem [community-release.md](community-release.md).

## Chạy Spark với dữ liệu cloud

Mở PowerShell tại gốc với Node 22 đã ở PATH. Cài dependency bằng `npm --prefix backend ci` nếu chưa có. Tài khoản Firebase CLI trên máy phải có quyền project. Helper `backend/scripts/cloud-context.mjs` dùng phiên CLI đã được cấp quyền ở phía server; không đưa token hay service account vào frontend. Tắt các biến Emulator trong terminal này:

```powershell
$env:GCLOUD_PROJECT='recycling-share-app'
$env:FIRESTORE_EMULATOR_HOST=$null
$env:FIREBASE_AUTH_EMULATOR_HOST=$null
$env:FIREBASE_STORAGE_EMULATOR_HOST=$null
npm --prefix backend run dev:cloud
```

Server chỉ bind `127.0.0.1:5002`, kiểm tra project khớp `google-services.json`, dùng Auth thật và Firestore cloud. `ECOSHARE_MEDIA_BACKEND=firestore` được helper thiết lập. Tác vụ hết hạn đơn được chạy trong process local mỗi 5 phút; không có Cloud Scheduler. Cần giữ máy tính và server chạy khi dùng app/panel.

Khi API sẵn sàng, ở PowerShell khác:

```powershell
$env:GCLOUD_PROJECT='recycling-share-app'
node admin-web/scripts/configure-firebase.mjs --local-cloud
python -m http.server 5173 --directory admin-web --bind 127.0.0.1
```

Mở `http://127.0.0.1:5173/`, đăng nhập bằng email Admin thật và mật khẩu đã đặt. Cấu hình local được sinh từ public Android config, có `emulator:false`, `localCloudProxy:true` và API cổng 5002. Chỉ cho HTTP khi cả trang và API đều loopback; Auth/refresh vẫn gọi Google qua HTTPS. File local bị loại khỏi Git và bản Hosting deploy. Admin hiện có đã bootstrap theo tài khoản thật; vai trò Admin không tự cấp VERIFIED.

Chế độ cloud local không dùng tài khoản/mật khẩu mẫu Emulator. Chưa có backend/public Hosting triển khai cho Spark; không chạy lệnh deploy Functions/Storage để sử dụng cấu hình này.

## Chạy Firebase Emulator riêng trên Windows

Cần Node 22 và Java 21 trở lên. Máy hiện tại có Node portable tại `.tools/node-v22.23.3-win-x64` và JBR của Android Studio. Chạy từ thư mục gốc:

```powershell
$env:PATH=(Resolve-Path '.tools/node-v22.23.3-win-x64').Path+';'+$env:PATH
$env:JAVA_HOME='C:/Program Files/Android/Android Studio/jbr'
$env:PATH=$env:JAVA_HOME+'/bin;'+$env:PATH
Set-Location backend
npm ci
npm run emulators
```

Trên máy khác, cài Node/Java rồi bỏ ba dòng cấu hình đường dẫn trên. CLI đã nằm trong devDependencies; không cần cài Firebase toàn máy. Emulator dùng **project demo-recycling-share**, không kết nối dữ liệu cloud. Các cổng:

| Dịch vụ | Địa chỉ |
|---|---|
| Emulator UI | http://127.0.0.1:4000 |
| Auth | 127.0.0.1:9099 |
| Firestore | 127.0.0.1:8180 |
| Storage | 127.0.0.1:9199 |
| Functions API | http://127.0.0.1:5001/demo-recycling-share/asia-southeast1/api/v1 |
| Admin web | http://127.0.0.1:5174/ |

Firestore dùng 8180 vì cổng 8080 bị chặn trên máy hiện tại. Dữ liệu Emulator mất khi tắt; muốn giữ, dùng các tùy chọn import/export của Firebase CLI. Không chạy hai bộ Emulator cùng cổng.

Mở PowerShell thứ hai tại gốc, cấu hình PATH của Node rồi seed:

```powershell
$env:GCLOUD_PROJECT='demo-recycling-share'
$env:FIRESTORE_EMULATOR_HOST='127.0.0.1:8180'
$env:FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:9099'
$env:FIREBASE_STORAGE_EMULATOR_HOST='127.0.0.1:9199'
npm --prefix backend run seed:emulator
```

Seed chỉ thêm dữ liệu thiếu, không xóa/ghi đè dữ liệu hiện có. Chỉ chạy được với project `demo-*` và đủ ba emulator. Các tài khoản `admin@ecoshare.test`, `moderator@ecoshare.test`, `seller@ecoshare.test`, `buyer@ecoshare.test` có mật khẩu **EcoShareDemo123!**, chỉ dùng local. Seed gồm bài chia sẻ, mẹo hay, tin bán/đơn hàng, bạn bè/thông báo, SCAN riêng tư và ảnh Storage; [danh sách dữ liệu mẫu](community-release.md).

Sao chép `admin-web/firebase-config.example.js` thành `firebase-config.local.js` với:

```javascript
export default {
  projectId:'demo-recycling-share', apiKey:'demo-key',
  apiBase:'/api/v1', emulator:true, authEmulatorHost:'127.0.0.1:9099'
};
```

Mở trang Admin web ở cổng 5174 để đăng nhập. Chưa chạy Functions Emulator thì có thể dùng `npm --prefix backend run dev` với các biến emulator trên; API sẽ ở `http://127.0.0.1:5050/v1`, cần sửa `apiBase` tương ứng. Web client tự làm mới Firebase ID token; token chỉ ở bộ nhớ, tải lại trang cần đăng nhập lại.

## Kiểm thử

Nếu chưa chạy Emulator, từ `backend`:

```powershell
npm run test:emulators
```

Lệnh tự khởi động Auth/Firestore/Storage, build, chạy toàn bộ test và tắt Emulator. Nếu đang chạy bộ Emulator, dùng PowerShell đã đặt đủ các biến host như trên rồi chạy `npm --prefix backend test`. Chạy `npm test` không có host chỉ kiểm tra unit, các suite integration sẽ báo SKIP; không coi đó là kiểm thử toàn bộ.

Các test dùng token Auth Emulator thật cho ứng dụng chính, Firestore transaction thật, Storage upload thật và Rules Unit Testing. Các harness tách module chỉ dùng header giả trong file test, không tồn tại trên API triển khai.

## Cấu trúc và dữ liệu

| File | Vai trò |
|---|---|
| `backend/src/core.ts`, `app.ts`, `index.ts` | Firebase context, xác thực, lỗi, CORS, HTTP Functions |
| `marketplace.ts` | Bài bán, duyệt bài, tồn kho, checkout, đơn hàng, hết hạn |
| `community.ts` | Hồ sơ, địa chỉ, xác minh, chat, tương tác, báo cáo, đánh giá |
| `social.ts`, `social-admin.ts` | Bài chia sẻ, mẹo, bình luận, thích/lưu, bạn bè, thông báo, SCAN và quản trị cộng đồng |
| `payments.ts` | Adapter MoMo/VNPay, callback, đối soát, hoàn tiền |
| `admin.ts` | Phân quyền, CRUD tham chiếu/nội dung, thống kê, cấu hình, sổ điểm |
| `media.ts` | Phiên upload, kiểm tra tệp, phân quyền tải xuống |
| `firestore.rules`, `storage.rules` | Chặn client sửa nghiệp vụ và đọc dữ liệu riêng tư |
| `firestore.indexes.json`, `firebase.json` | Index, Functions, Emulator và Hosting |

Giữ **20 collection nghiệp vụ** theo `docs/domain-model.json`: `users`, `verifications`, `addresses`, `categories`, `listings`, `listing_items`, `media_assets`, `interactions`, `orders`, `order_items`, `payments`, `conversations`, `messages`, `reviews`, `reports`, `collection_points`, `green_ledger`, `content_entries`, `audit_logs`, `system_settings`. Không sinh thêm lớp domain. Các module service/client không phải lớp thực thể.

Document ID bằng trường `id`; các khóa ngoại là ID chuỗi. Thời gian lưu ISO 8601 UTC để khớp Java DTO. VND là số nguyên, không nhận giá/tổng tiền từ client. Các trường bắt đầu `_` là dữ liệu kỹ thuật như `_member_ids`, `_verification_id`, `_request_hash`, `_reservation_state`, `_reserved`. `users.points_balance` là số dư được cập nhật cùng transaction sổ điểm. `system_settings` còn chứa khóa kỹ thuật chống phát lại biên nhận và con trỏ quét đơn hết hạn; API cấu hình chỉ cho sửa `app`, `moderation`, `contact`, `maintenance`.

## Quy tắc vận hành

- Firebase ID token xác định UID. Vai trò và khóa tài khoản đọc từ document `users` hiện tại; client/custom claims không tự cấp quyền. Tài khoản mới luôn MEMBER/ACTIVE; không thể gửi role lúc cập nhật hồ sơ.
- Người mua và người bán đều cần tài khoản ACTIVE, hồ sơ VERIFIED chưa hết hạn. Backend kiểm tra bản ghi xác minh thật, không chỉ nhãn trên hồ sơ. Admin duyệt thủ công sau khi có tệp chứng minh riêng tư và không được tự duyệt; đây chưa phải dịch vụ eKYC tự động.
- Bài bán mới/chỉnh sửa/đổi ảnh phải duyệt lại. Mỗi đơn có tối đa 20 dòng, một người bán, không tự mua, dùng địa chỉ thuộc người mua. Checkout transaction chụp giá/địa chỉ và giảm tồn kho khả dụng. Chỉ một người mua được món cuối.
- Đơn chờ thanh toán giữ hàng 20 phút. Job chạy mỗi 5 phút hủy đơn hết hạn chưa có thanh toán đang xử lý. Đơn có PENDING/không rõ kết quả cần đối soát trước khi giải phóng hàng. Con trỏ quét được lưu để các đơn này không chặn các đơn phía sau.
- Luồng thông thường: `PENDING_PAYMENT → PAID → SHIPPED → COMPLETED`. Người bán xác nhận gửi, người mua xác nhận nhận. Khiếu nại chuyển `DISPUTED`; admin đóng báo cáo rồi dùng API khôi phục có kiểm tra thanh toán hoặc hoàn tiền. Không có API tùy ý sửa trạng thái tài chính.
- Giá giao hàng hiện **0 đồng**, điểm hoàn tất **10 điểm cho người mua**; đây là hằng số backend. Cấu hình Admin hiện là nội dung hiển thị, không tự thay đổi giá, điểm, chính sách truy cập hoặc bật/tắt hệ thống.
- Chỉ callback có chữ ký/đối soát server được xác nhận tiền. Trang quay về từ cổng thanh toán không được đổi trạng thái. Callback lặp không cộng tiền/điểm/tồn kho lặp; tiền đến muộn vẫn ghi nhận và chuyển xử lý khiếu nại. Hoàn tiền dùng Payment riêng; hoàn trước giao hàng khôi phục tồn một lần, sau giao hàng cần quy trình nhận lại hàng thực tế.
- Không sửa trực tiếp Firestore từ ứng dụng, kể cả tài khoản Admin. Các thao tác phải đi qua API để kiểm tra điều kiện và ghi nhật ký. Admin SDK trên server dùng IAM, không chịu Security Rules; vì vậy cả API lẫn Rules đều được kiểm thử.

Upload Spark: tạo `/media`, nhận `upload_mode:FIRESTORE`, `upload_path`, `max_bytes:393216`; PUT byte ảnh với Bearer token và đúng Content-Type, rồi POST `/media/:id/complete`. Dữ liệu ảnh và metadata nằm trong collection `media_assets`, không tạo thêm lớp nghiệp vụ. Giới hạn **384 KiB/tệp**, JPEG/PNG/WebP; PDF chỉ cho hồ sơ/báo cáo riêng tư. Download luôn qua API và kiểm tra quyền của bản ghi cha; SCAN chỉ chủ ảnh/Admin. Không tạo URL Storage công khai hoặc tự xác minh danh tính.

Adapter Storage dành cho Emulator/môi trường khác vẫn hỗ trợ ticket Storage và giới hạn 10 MiB. Chưa dùng adapter này trong cấu hình Spark cloud; các kiểm tra Storage trước đây thuộc môi trường Emulator. Chưa tích hợp quét malware/ML hoặc dọn upload bỏ dở.

## Project thật đang dùng Spark

Firebase CLI đã xác thực và đã triển khai Authentication Email/Password, Firestore Rules/Indexes cho **`recycling-share-app`**. Database `(default)` ở **`nam5`**; billing vẫn tắt. Tài khoản Auth/Admin của chủ project đã bootstrap và đã đặt mật khẩu; không tạo hồ sơ VERIFIED.

`app/google-services.json` cung cấp public config cho client. `backend/scripts/cloud-context.mjs` dùng quyền CLI đã được cấp để chạy server local; không cần đưa service account hoặc token vào app/web. Helper từ chối biến Emulator còn sót và project khác Android config. Không dùng API public Functions ở chế độ này.

Trang `setup-password.html#oobCode=...` chỉ dùng trên localhost với cấu hình Spark. Trang lấy mã từ fragment rồi xóa ngay khỏi thanh địa chỉ, xác minh với Google HTTPS và hiển thị email. Người dùng nhập hai mật khẩu khớp nhau, từ 8 ký tự; mật khẩu gửi trực tiếp đến Firebase, không qua Node, log hoặc storage trình duyệt. Trang không gửi email và không tự cấp quyền. Liên kết/mã đặt mật khẩu không được lưu trong repo.

Cấu hình Hosting production vẫn có chốt từ chối Emulator/proxy local và loại file local/trang đặt mật khẩu khỏi artifact. Chưa triển khai backend/public Hosting cho Spark. Các nguồn Functions/Storage trong repo không làm bật billing hoặc tự chạy trên cloud.

Seed Emulator `seed-emulator.ts` bị giới hạn project `demo-*`; không dùng script đó vào project thật. Script riêng `backend/scripts/seed-cloud.mjs` đã tạo 23 document cloud: **3 POST, 2 TIP, 1 SCAN riêng tư, 3 tin bán PENDING + 3 dòng hàng, 1 danh mục, 9 ảnh inline và 1 audit**. Tác giả/chủ ảnh là tài khoản Admin thật. Script mặc định chỉ lập kế hoạch, chỉ tạo dữ liệu còn thiếu thuộc bộ mẫu, không ghi đè nội dung đã sửa và dừng khi trùng ID ngoài bộ mẫu. Không tạo tài khoản demo, KYC, đơn hàng hoặc thanh toán giả. Tin bán chờ xác minh và duyệt hợp lệ nên chưa xuất hiện trong chợ công khai.

Kiểm tra cloud đã xác nhận API trả 3 POST/2 TIP, ảnh tải về giữ nguyên byte, tải SCAN riêng tư khi chưa đăng nhập trả 401, và sửa–đọc–khôi phục bài trong database/API thành công. Chưa tự động hóa phiên browser Admin đăng nhập cloud; cách kiểm tra thủ công trên panel và phạm vi kết quả được ghi tại [verification.md](verification.md).

## Giới hạn hiện tại

Các luồng cộng đồng, hồ sơ, xác minh, tin bán/đơn hàng và Admin mobile cơ bản đã nối API. Chat và một số tùy chọn cài đặt/khu vực phụ còn prototype. SCAN chụp/lưu ảnh; chưa có ML, eKYC tự động, FCM push, tìm kiếm toàn văn hay redeem thưởng. Spark local dùng máy tính làm backend, ảnh tối đa 384 KiB và cần máy tính tiếp tục chạy. MoMo/VNPay thật đang tắt; chưa có callback merchant public hoặc nghiệm thu thanh toán.

Dependencies runtime được kiểm tra bằng `npm audit --omit=dev` (0 cảnh báo). Dev tools Firebase CLI có 7 cảnh báo transitive còn lại; xem [kết quả kiểm tra](backend-verification.md). Trước khi mở giao dịch thật cần hoàn tất cấu hình project, merchant sandbox nghiệm thu, bảo vệ chống lạm dụng (App Check/rate limiting), sao lưu và vận hành đối soát. Các phần này chưa được báo là đã triển khai.
