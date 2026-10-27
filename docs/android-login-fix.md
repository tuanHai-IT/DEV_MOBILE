# Sửa lỗi app tự thoát khi đăng nhập — 19/10/2026

Đã xác định lỗi từ log thực tế của app: `NetworkOnMainThreadException` xảy ra ở `FirebaseBackendClient.signOut()` khi `ConnectionPool.evictAll()` đóng kết nối TLS trên main thread. Đường gọi là callback đăng nhập/tải hồ sơ thất bại → `MainActivity.loginFailed()` → `BackendSession.signOut()`. Việc đóng TLS có thể ghi gói `close_notify` ra mạng nên vẫn phải chạy ngoài UI, kể cả khi chỉ dọn socket nhàn rỗi.

Thiết bị chưa có tệp cấu hình lựa chọn backend. Bản cũ mặc định Cloud Functions, trong khi project hiện giữ Spark và dùng Node local cổng 5002. Vì vậy, sau bước Firebase Auth, request `/me` đi tới backend Cloud Functions chưa triển khai; đường xử lý lỗi lại gặp lỗi dọn TLS trên main thread. Log crash xác nhận vị trí lỗi; không cần đọc hoặc lưu mật khẩu để chẩn đoán.

## Bản sửa

- `FirebaseBackendClient.signOut()` xóa phiên và tăng thế hệ callback ngay; hủy request và dọn TLS trên worker riêng. Client theo dõi toàn bộ request đang chạy, gồm các request ảnh.
- Lần đăng nhập tiếp theo có connection pool và dispatcher riêng. Tác vụ dọn phiên cũ chỉ tác động tới request/pool cũ, tránh hủy nhầm lần đăng nhập mới. `close()` cũng dọn TLS ngoài main thread và gọi lặp lại an toàn. Chính sách HTTPS, kiểm tra chứng chỉ/hostname và timeout được giữ nguyên.
- `BackendSession` mặc định Spark cho bản debug đúng project `recycling-share-app` khi chưa lưu môi trường. Lựa chọn đã lưu và cấu hình Emulator cũ được giữ lại; project khác không tự chọn Spark, bản release luôn dùng backend HTTPS.
- Màn hình đăng nhập phân biệt lỗi xác thực với lỗi tải hồ sơ qua `/me`. Lỗi backend Spark nêu cổng 5002 và quyền mạng nội bộ; lỗi quyền/tài khoản `401/403` giữ thông báo thực. Không đổi nhầm sang tài khoản hoặc database Emulator khi kết nối cloud thất bại.

Các file chính: `app/src/main/java/com/example/recyclingshareapp/data/remote/FirebaseBackendClient.java`, `BackendSession.java` cùng thư mục, và `app/src/main/java/com/example/recyclingshareapp/MainActivity.java`.

## Kiểm tra hồi quy

Ba kiểm thử `FirebaseTlsCleanupTest` đã đạt trên Android 17/API 37 với socket TLS keep-alive thực, server chỉ bind loopback trong thiết bị kiểm thử:

1. Đăng xuất trên main thread khi còn TLS nhàn rỗi, phiên bị xóa ngay và đăng nhập lại ngay lập tức thành công; pool/dispatcher mới tách khỏi phiên đang dọn.
2. `close()` trên main thread không thực hiện mạng, gọi lặp lại và gọi `signOut()` sau khi đóng vẫn an toàn.
3. Đối chứng: gọi trực tiếp `evictAll()` đồng bộ theo cách cũ trên main thread thực sự tạo `NetworkOnMainThreadException`. Test bắt ngoại lệ kỳ vọng; đây là bằng chứng fixture tái hiện đúng lỗi cũ.

Sáu kiểm thử `BackendSessionModeTest` kiểm tra mặc định Spark của project hiện tại, release HTTPS, project khác/thiếu cấu hình, lựa chọn đã lưu, Emulator legacy và giá trị lưu sai. JVM toàn bộ đã đạt **17/17**. Các kiểm thử TLS local không đăng nhập tài khoản Firebase thật; cấu hình tin chứng chỉ của fixture chỉ áp dụng trên instance trong test.

Lượt đầy đủ sau bản sửa đạt **15/15 Android và 17/17 JVM**, không lỗi hoặc bỏ qua. Kết quả tính năng trước bản sửa: 127 backend, 12 Android, 11 JVM, 13 kiểm tra mô hình và 11 tình huống browser Emulator. Backend, mô hình và browser không chạy lại trong lần sửa chỉ ở Android này; phạm vi xác nhận tại [verification.md](verification.md).

Log trên máy phát triển: `.qa/android-user-login-crash.txt`, `.qa/login-fix-tls-tests.txt`, `.qa/login-fix-full-android-tests.txt`; số lượng tổng hợp ở `.qa/login-fix-final-test-counts.json`. `.qa` không được commit. Báo cáo Android ở `app/build/reports/androidTests/connected/debug/index.html`; báo cáo JVM ở `app/build/test-results/testDebugUnitTest`.

## Cách dùng bản sửa

APK debug: `app/build/outputs/apk/debug/app-debug.apk`. Cài cập nhật APK hoặc Run module `app` bằng Android Studio; không cần xóa dữ liệu app để sửa lỗi này.

Đã cài đè APK bằng `install -r` trên thiết bị người dùng và giữ dữ liệu app. App mở ổn định ở màn hình đăng nhập, đã xác nhận nhãn Spark; log AndroidRuntime kể từ cập nhật không ghi nhận crash. Backend local cổng 5002 tiếp tục chạy để người dùng thử lại. Chưa nhập mật khẩu hoặc tự động hóa đăng nhập tài khoản cloud của người dùng.

Giữ backend chạy bằng `npm --prefix backend run dev:cloud` rồi mở bản debug của project `recycling-share-app`. App tự dùng Spark và bỏ cấu hình kết nối cũ; màn hình đăng nhập không còn nút chọn backend. Trên Android Emulator, API máy tính là `10.0.2.2:5002`; cho phép quyền mạng nội bộ trên API 37 khi được hỏi. Sau đó đăng nhập bằng tài khoản Firebase thật và mật khẩu đã đặt. Bản sửa chưa đồng nghĩa đã kiểm thử phiên đăng nhập cloud bằng mật khẩu của người dùng.

Xem [hướng dẫn kết nối Android](android-firebase.md) và [backend Spark](firebase-backend.md) để khởi động lại môi trường.
