# Kiểm tra backend Firebase — 18/10/2026

**Lịch sử lượt kiểm tra backend ban đầu.** Phần cộng đồng sau đó đã nối giao diện Android và Admin mặc định vào Firebase API. Các con số 74/5 trong báo cáo dưới đây thuộc lượt trước, khi chưa triển khai cloud. Kết quả hiện tại và phạm vi xác nhận ở [verification.md](verification.md), tính năng và dữ liệu mẫu ở [community-release.md](community-release.md).

Lượt kiểm tra lịch sử dùng Windows, Node 22.23.3, Firebase CLI 15.34.0, JBR 25 đi kèm Android Studio và project Emulator `demo-recycling-share`; lượt đó không triển khai hoặc ghi dữ liệu vào Firebase project thật.

**Cập nhật 19/10/2026:** sau bản sửa đăng nhập, **15/15 Android** và **17/17 JVM** đạt. Lượt kiểm tra tính năng trước đó đạt **127/127 backend**, **13/13 mô hình** và **11 tình huống browser trên Emulator** (6 cộng đồng + 5 quản trị cơ bản); không chạy lại các suite này cho thay đổi chỉ ở Android. Cloud `recycling-share-app` đã có Auth Email/Password, Firestore Rules/Indexes, Admin thật đã đặt mật khẩu và 23 document mẫu; đã kiểm tra đọc ảnh/dữ liệu và sửa–đọc–khôi phục qua database/API. Giữ Spark/billing tắt, API Node local cổng 5002; chưa triển khai Functions/Storage/Hosting công khai. Báo cáo hiện tại và giới hạn nghiệm thu ở [verification.md](verification.md); các bảng/mục sau giữ kết quả lịch sử.

**Bản sửa Android ngày 19/10/2026:** đã xác định và sửa `NetworkOnMainThreadException` khi dọn kết nối TLS sau lỗi đăng nhập; đồng thời chọn Spark mặc định cho bản debug của project hiện tại khi chưa lưu môi trường. Ba kiểm thử TLS local có đối chứng tái hiện lỗi cũ đã đạt. Bản sửa này không thay đổi nghiệp vụ backend hoặc dữ liệu cloud; kết quả backend/browser ở trên là lượt trước. Chi tiết tại [android-login-fix.md](android-login-fix.md).

| Kiểm tra | Kết quả |
|---|---|
| TypeScript strict build | Đạt |
| `npm --prefix backend run test:emulators` | **74/74 test đạt, 0 fail, 0 skip**; CLI tự khởi động và tắt Auth/Firestore/Storage |
| Android `:app:assembleDebug :app:testDebugUnitTest` | Đạt; **8 JVM test**, gồm 5 test URL policy mới |
| Release manifest | Có INTERNET; không chứa cấu hình cleartext/debug của Emulator |
| `python tools/validate_design.py` | **11/11 đạt**; vẫn 20 domain model/bảng và đầy đủ layout/sơ đồ |
| Functions Emulator | Nhận đúng export `api`, `expireReservations`; Node 22, region Singapore |
| Hosting rewrite `/api/v1/health` | HTTP 200, `{service:"ecoshare-api",status:"ok",emulator:true}` |
| Web client gọi Auth/Functions thật trong Emulator | Đăng nhập, refresh token, đọc hồ sơ/dashboard, POST/PATCH danh mục thành công |
| Browser smoke bằng Edge headless | **5/5 tình huống đạt** trên HTML/JS thật |
| `npm audit --omit=dev` | **0 lỗ hổng runtime được npm ghi nhận** tại thời điểm kiểm tra |
| `npm audit` toàn bộ | Còn **7 cảnh báo dev-only: 3 high, 4 moderate**, nêu dưới đây |

74 test bao gồm kiểm tra token Firebase thật, chống tự cấp quyền, hai bên VERIFIED, tranh chấp tồn kho cuối, retry checkout, quyền địa chỉ/đơn/chat, vòng đời mua bán, hết hạn, xử lý khiếu nại, ledger đúng một lần, chữ ký MoMo/VNPay, callback lặp/tiền đến muộn, hoàn tiền và tồn kho, admin CRUD, PATCH giữ trường không sửa, phân quyền Firestore, upload Storage và riêng tư hồ sơ. Các cảnh báo PERMISSION_DENIED trong log là những yêu cầu bị từ chối theo kỳ vọng của test.

Browser chạy tại `http://127.0.0.1:5174/tests/firebase-smoke.html` sau khi seed và cấu hình local theo [hướng dẫn](firebase-backend.md). Test tự từ chối project không phải `demo-recycling-share`/không phải loopback. Test thêm một danh mục QA trong Emulator và kiểm tra:

1. Đăng nhập Firebase và tải dashboard dữ liệu server.
2. Biểu mẫu tạo danh mục ghi qua Functions API.
3. Lọc bài đăng APPROVED tải đúng dữ liệu.
4. Chi tiết và truy vấn tệp đính kèm có phân quyền.
5. Moderator không có menu người dùng/thanh toán.

Test browser phát hiện và đã sửa trường hợp submit bằng Enter/`requestSubmit()` không có `event.submitter`; form nay dùng nút submit mặc định. Cũng đã sửa lỗi Firebase CLI từ chối biến môi trường tự đặt có tiền tố `FIREBASE_`: cấu hình bucket dùng `ECOSHARE_STORAGE_BUCKET`.

Preview trang đăng nhập: [admin-firebase-login.png](previews/admin-firebase-login.png). Test HTML nằm trong `admin-web/tests/`, được loại khỏi bản deploy Hosting. Các test harness không tạo cửa hậu đăng nhập trên API.

## Dependencies và giới hạn xác nhận

Đã override `@grpc/grpc-js` lên 1.14.6, loại bản 1.9.16 được Firestore test SDK kéo theo, rồi chạy lại đầy đủ Emulator tests. Cảnh báo còn lại thuộc Firebase CLI/dev tooling: `braces → chokidar → firebase-tools` (high), `@opentelemetry/core → @google-cloud/pubsub` và `uuid → gaxios` (moderate). Không ép nâng major/downgrade Firebase CLI hoặc SDK để làm sạch báo cáo khi chưa có bản sửa tương thích. Chúng không nằm trong dependencies runtime của Functions; tiếp tục cập nhật công cụ trước khi dùng trên môi trường khác.

Ở lượt lịch sử này, Emulator không bắt buộc composite index như production; cấu hình index đã xuất nhưng chưa được triển khai/kiểm tra trên project thật. Khi đó chưa đăng nhập CLI hoặc có merchant; Secret Manager/IAM, URL ký GCS, Cloud Scheduler và thanh toán thật chưa được xác nhận trên cloud. Hiện tại CLI đã xác thực và Rules/Indexes đã triển khai theo cập nhật Spark bên trên; source Functions/Storage không được triển khai trong chế độ Spark. Hoàn tiền VNPay tự động trả 503 trước khi ghi dữ liệu; MoMo và EMULATOR có adapter hoàn toàn bộ.

Ở lượt backend ban đầu, màn hình Android còn dùng DemoRepository và chưa chạy lại instrumentation UI. Bản cập nhật cộng đồng tiếp theo đã nối các luồng chính qua API; Admin mobile cơ bản đã nối tổng quan/duyệt tin bán/báo cáo; chat và một số tùy chọn cài đặt di động còn prototype. Xem phạm vi hiện tại tại [Android Firebase](android-firebase.md) và [kết quả mới](verification.md).

## Bổ sung cấu hình Android — 18/10/2026

Đã kiểm tra `app/google-services.json`: cấu trúc hợp lệ, một Android client, project `recycling-share-app`, bucket `recycling-share-app.firebasestorage.app`, package `com.example.recyclingshareapp` khớp `applicationId`. Không ghi API key hoặc app ID đầy đủ vào báo cáo. File không chứa OAuth client nên chưa xác nhận Google Sign-In.

Google Services plugin 4.5.0 được áp dụng có điều kiện theo sự hiện diện của file; factory `FirebaseBackendClient.fromGoogleServices(context)` đọc resource để chuẩn bị client REST. Lệnh Gradle gồm `:app:processDebugGoogleServices :app:processReleaseGoogleServices :app:assembleDebug :app:testDebugUnitTest` đã **BUILD SUCCESSFUL**, hoàn tất trong 1 phút 14 giây. Báo cáo XML xác nhận **8 JVM test đạt, 0 fail, 0 error, 0 skip**: 5 URL policy, 2 TradeRules và 1 ExampleUnitTest.

Đã đối chiếu bằng script các resource sinh tại `app/build/generated/res/processDebugGoogleServices/values/values.xml` và `app/build/generated/res/processReleaseGoogleServices/values/values.xml`: projectId, bucket, Android app ID và API key khớp JSON gốc, không hiển thị giá trị khóa. Đây là kiểm tra cấu hình/build; chưa xác nhận kết nối Firebase production và chưa chạy lại 74 backend test do không đổi nghiệp vụ backend.

Ở lượt cấu hình này, Firebase CLI `login:list` không có tài khoản đăng nhập; `projects:list --json --non-interactive` thất bại do chưa xác thực. Chưa deploy, chưa tạo database/bucket hoặc ghi dữ liệu cloud. Trạng thái CLI/cloud và các màn hình đã nối API trong bản cập nhật cộng đồng được ghi riêng ở [verification.md](verification.md).
