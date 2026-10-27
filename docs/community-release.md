# Bản cập nhật cộng đồng — 19/10/2026

Ứng dụng Android dùng giao diện native với 53 layout màn hình. Các luồng cộng đồng chính và trang quản trị đã nối Firebase API, thay cho dữ liệu bài viết tạo sẵn trong frontend.

## Luồng đã triển khai

- Trang chủ chỉ hiển thị **bài chia sẻ đã xuất bản**. Khám phá có **Mẹo hay** và **Chợ đồ cũ**.
- Nút **+** mở lựa chọn bài chia sẻ, mẹo hay hoặc tin bán. Soạn bài hỗ trợ 500 ký tự, ảnh từ máy, vật liệu, trọng lượng và tags.
- Chi tiết bài hiển thị toàn văn, ảnh và bình luận ở dưới; người dùng gửi bình luận ngay tại đó. Nút bình luận mở đúng bài và vùng nhập. Thích chuyển đỏ, lưu chuyển vàng; không còn nút chia sẻ.
- Thanh trên có bạn bè, thông báo và SCAN. Bạn bè gồm lời mời/chấp nhận/từ chối, danh sách và gợi ý. Thông báo hỗ trợ đọc từng mục/đọc tất cả và mở nội dung liên quan.
- SCAN chụp qua camera hệ thống hoặc chọn ảnh. Chế độ Spark lưu ảnh inline và metadata trong Firestore, tối đa 384 KiB/tệp; adapter Emulator vẫn có Storage riêng. Ảnh giữ riêng tư cho chủ ảnh và Admin; có lịch sử và thao tác ẩn khỏi lịch sử.
- Hồ sơ, địa chỉ, xác minh, đăng bán và đơn hàng dùng API. Server kiểm tra người mua/người bán đã xác minh, tồn kho, giá và trạng thái đơn.
- Admin web mặc định dùng Firebase Auth/API, có các mục bài chia sẻ/mẹo hay/SCAN, xem ảnh và bình luận, tạo/sửa/ẩn/lưu trữ cùng nhật ký. Moderator không có quyền xem SCAN riêng tư.
- Admin mobile cơ bản đã nối API: tổng quan, danh sách tin bán chờ duyệt và báo cáo OPEN có phân trang; duyệt/từ chối/giải quyết/bác bỏ kèm lý do. Quyền được đọc lại từ server; công việc quản trị đầy đủ tiếp tục thực hiện trên web.

Chat và một số tùy chọn cài đặt/khu vực phụ vẫn còn prototype. Chưa có nhận diện vật liệu bằng ML hoặc eKYC tự động. MoMo/VNPay thật cần merchant và nghiệm thu; hoàn tiền VNPay tự động chưa triển khai.

## Dữ liệu kiểm tra trong Firebase Emulator

`backend/scripts/seed-emulator.ts` tạo các tài khoản local và gọi `seed-social.ts`. Seed chỉ tạo bản ghi/tệp còn thiếu, giữ các chỉnh sửa đã lưu. Dữ liệu cộng đồng được lấy từ database qua API; frontend không tự khởi tạo các bài này.

| Dữ liệu | Mã tiêu biểu |
| --- | --- |
| 3 bài chia sẻ | `demo-post-planters`, `demo-post-glass`, `demo-post-corks` |
| 2 mẹo hay | `demo-tip-clean`, `demo-tip-planters` |
| 3 tin bán cộng đồng | `demo-planters`, `demo-glass`, `demo-corks`; còn tin đèn mẫu từ seed backend cơ bản |
| 2 đơn hàng | `demo-order-completed` và `demo-order-paid` |
| Ảnh SCAN riêng tư | `demo-scan-bottle`, thuộc `demo-buyer` |
| Ảnh đính kèm | 9 bản ghi media dùng 3 ảnh JPEG nguồn, tải vào Storage cho bài/tip/tin bán/SCAN |
| Quan hệ và thông báo | Lời mời từ người bán đến người mua; thông báo lời mời |

| Email local | Quyền |
| --- | --- |
| `buyer@ecoshare.test` | Người mua, xem SCAN mẫu và nhận lời mời |
| `seller@ecoshare.test` | Người bán, tác giả một số bài/tip/tin bán |
| `admin@ecoshare.test` | Admin web, quản lý đầy đủ |
| `moderator@ecoshare.test` | Duyệt nội dung/báo cáo theo quyền; không xem SCAN |

Mật khẩu chung **`EcoShareDemo123!`**, chỉ dùng trong Emulator. Các hồ sơ xác minh mẫu phục vụ kiểm thử; không chứng minh danh tính thật.

Khởi chạy/seed theo [firebase-backend.md](firebase-backend.md). Android debug chọn **Firebase Emulator trên máy tính** ở màn hình đăng nhập. Trên Android 17/API 37 cần cấp quyền mạng local khi được hỏi. Admin mở `http://127.0.0.1:5174/` hoặc server tĩnh cổng 5173 với API URL đầy đủ theo [admin-web/README.md](../admin-web/README.md).

Để kiểm tra sửa dữ liệu: dùng Admin mở **Bài chia sẻ**, chọn bài mẫu, sửa nội dung và nhập lý do; mở lại bài qua API/app để xem thay đổi. Với ảnh SCAN, dùng tài khoản người mua trên app và Admin trên web; Moderator phải bị từ chối. Seed lại không khôi phục nội dung cũ đã sửa. Lưu ý Emulator không giữ dữ liệu sau khi tắt nếu chưa cấu hình import/export.

Bản kiểm thử Emulator đã dọn dữ liệu QA, đọc lại bộ mẫu sạch và export vào `.qa/firebase-community-export` trên máy này. Cổng của bản Emulator là 4000/5174; cấu hình Spark được mô tả riêng bên dưới. Nếu khởi động lại để giữ bộ dữ liệu Emulator đó, dùng:

```powershell
node backend/node_modules/firebase-tools/lib/bin/firebase.js emulators:start --project demo-recycling-share --import .qa/firebase-community-export --export-on-exit .qa/firebase-community-export
```

Chỉ khởi động sau khi bộ Emulator cũ đã tắt. Bản export và cấu hình local nằm ngoài Git; máy mới có thể tạo lại dữ liệu bằng `npm --prefix backend run seed:emulator`.

## Trạng thái cloud và kiểm thử

Theo yêu cầu giữ gói **Spark**, Firebase CLI đã xác thực và đã triển khai Authentication Email/Password, Firestore Rules/Indexes cho **`recycling-share-app`**, database `(default)` ở `nam5`. Tài khoản Auth/Admin thật đã bootstrap và chủ tài khoản đã tự đặt mật khẩu. Quyền Admin không tự cấp trạng thái VERIFIED.

Backend Node chạy tại **`http://127.0.0.1:5002/v1`**, dùng Auth/Firestore cloud thật, ảnh inline tối đa **384 KiB/tệp**. Admin chạy localhost cổng 5173 với cấu hình `--local-cloud`; Android debug của project hiện tại tự dùng **Spark miễn phí · Backend máy tính + Firestore cloud** và bỏ lựa chọn kết nối cũ. Bản release dùng HTTPS. Billing vẫn tắt; không triển khai Functions/Storage hoặc backend Hosting công khai. Cần giữ máy tính/server local chạy.

Các bài/tài khoản ở bảng Emulator bên trên thuộc **`demo-recycling-share`**. Bộ mẫu cloud riêng đã được lưu bằng `backend/scripts/seed-cloud.mjs`: **23 document**, tác giả/chủ ảnh là tài khoản Admin thật, gồm:

| Dữ liệu cloud | ID tiêu biểu |
| --- | --- |
| 3 bài chia sẻ đã xuất bản | `cloud-sample-post-planters`, `cloud-sample-post-glass`, `cloud-sample-post-corks` |
| 2 mẹo hay đã xuất bản | `cloud-sample-tip-clean`, `cloud-sample-tip-planters` |
| 1 SCAN riêng tư | `cloud-sample-scan-glass` |
| 3 tin bán PENDING và 3 dòng hàng | `cloud-sample-sale-planters`, `cloud-sample-sale-glass`, `cloud-sample-sale-corks` |
| Ảnh và dữ liệu phụ | 9 ảnh JPEG inline, 1 danh mục và 1 bản ghi audit |

Không tạo các tài khoản `@ecoshare.test`, KYC, đơn hàng hoặc thanh toán giả trên project thật. Tin bán mẫu chưa hiện trong chợ công khai: cần xác minh người bán và duyệt hợp lệ; giao dịch tiếp tục yêu cầu cả người mua/người bán được xác minh. Seed chỉ tạo bản ghi còn thiếu thuộc bộ mẫu, giữ nội dung đã sửa.

Đã kiểm tra API cloud trả đúng 3 POST/2 TIP, ảnh tải về giống từng byte, SCAN riêng tư trả 401 khi chưa đăng nhập, và sửa–đọc–khôi phục bài qua database/API thành công. Đăng nhập panel tại **http://127.0.0.1:5173/** bằng email Admin thật cùng mật khẩu vừa đặt để xem/sửa bộ mẫu; chưa tự động hóa kiểm thử browser đăng nhập cloud. Cách chạy tại [firebase-backend.md](firebase-backend.md).

Sau bản sửa đăng nhập, **15/15 Android API 37** và **17/17 JVM** đạt; Android gồm kiểm tra upload/complete/download ảnh inline so sánh byte và 3 ca TLS local có đối chứng lỗi cũ. Lượt kiểm tra tính năng trước đó đạt **127/127 backend**, **13/13 mô hình/layout/sơ đồ** và **11/11 tình huống browser trên Emulator** (6 cộng đồng, 5 quản trị cơ bản); không chạy lại các suite này cho bản sửa chỉ ở Android. Kết quả và giới hạn tại [verification.md](verification.md), API quản trị tại [social-admin.md](social-admin.md).

## Ảnh giao diện và tệp bàn giao

Ngày 19/10/2026 đã sửa lỗi app tự thoát khi đăng nhập thất bại hoặc đăng xuất: dọn socket TLS được chuyển khỏi main thread, phiên mới dùng pool/dispatcher riêng và thông báo phân biệt lỗi Auth với backend không sẵn sàng. Xem [báo cáo sửa lỗi đăng nhập](android-login-fix.md). Không tạo tài khoản giả hoặc bỏ kiểm tra quyền để xử lý lỗi.

Ảnh chụp trực tiếp từ Android Emulator: [Trang chủ](previews/community/01-home.png), [Tạo bài đăng](previews/community/02-create-menu.png), [Soạn nội dung](previews/community/03-composer.png), [Chi tiết](previews/community/04-post-detail.png), [Bình luận](previews/community/04b-post-comments.png), [Bạn bè](previews/community/05-friends.png), [Thông báo](previews/community/06-notifications.png), [SCAN](previews/community/07-scan.png), [Admin mobile](previews/community/08-mobile-admin.png). Số liệu trong ảnh thuộc database Emulator lúc kiểm thử, không phải ảnh nghiệm thu bộ mẫu cloud.

APK debug tại `app/build/outputs/apk/debug/app-debug.apk`. [ZIP sơ đồ cập nhật](../Recycling%20Share%20App/diagrams-v2/ecoshare-diagrams-v2.zip) chứa Class/ERD/Function, SQL và data dictionary đồng bộ; vẫn giữ đúng 20 lớp nghiệp vụ.
