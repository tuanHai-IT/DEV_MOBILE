# Kiểm tra bàn giao — 20/10/2026

Kết quả mới nhất ngày 23/10/2026 và ma trận chức năng nằm tại [báo cáo rà soát toàn hệ thống](system-audit-2026-10-23.md). Các số liệu bên dưới là lịch sử kiểm thử ngày 20/10, trước khi bổ sung màn Điều khoản & Chính sách và các ca backend mới.

Cấu hình hiện tại giữ gói Spark: Node local cổng 5002, Firebase Authentication/Firestore cloud, ảnh inline tối đa 384 KiB. Dữ liệu mẫu cloud đã được lưu và đọc lại; tài khoản Admin thật đã sẵn sàng, chủ tài khoản đã tự đặt mật khẩu. Kiểm thử nghiệp vụ/giao diện chủ yếu dùng Emulator riêng; lượt Android chỉ GET công khai trên cloud được ghi riêng. Không đồng nhất các kết quả đó với nghiệm thu mọi luồng trên cloud.

**Cập nhật giao diện sau chỉnh sửa (20/10/2026):** Admin Web hiển thị điểm Eco và nội dung vừa sửa ngay khi API xác nhận, sau đó đồng bộ tab đang mở khoảng mỗi 20 giây. Android đọc mới `/me`, danh sách đang mở và chi tiết bài/mẹo khoảng mỗi 15 giây ở tiền cảnh, bỏ qua cache GET còn hạn nhưng giữ nội dung đã xem khi mạng lỗi. Đã đạt **3/3 kiểm thử DOM Admin**, **6/6 kiểm thử cache Android** và **3/3 kiểm thử giao diện phân trang Android** trên Firebase Emulator riêng; ca phân trang xác nhận bài thứ năm tự hiện nội dung chỉnh sửa mà không rời Trang chủ. Đã biên dịch app và androidTest; không chỉnh sửa dữ liệu cloud trong các lượt kiểm thử này. Backend Spark và Admin Web vẫn phản hồi HTTP 200 sau kiểm thử.

## Kết quả tại thời điểm 20/10/2026

| Phạm vi | Kết quả đã xác nhận |
| --- | --- |
| Layout native | Có 52 file `fragment_*.xml`, ngoài `activity_main.xml`; không đồng nghĩa mọi màn hình đã kiểm tra runtime |
| Backend đầy đủ | **130/130 đạt, 9 suite, 0 lỗi, 0 bỏ qua** với Auth/Firestore/Storage Emulator sau bổ sung phân trang tin nhắn và kiểm thử Admin Web. Log: `.qa/current-backend-audit.log`. |
| Backend hồi quy dữ liệu và phân trang | **21/21 đạt, 3 suite, 0 lỗi, 0 bỏ qua**: social, social-app và inline-media; kiểm tra trang 3+3+1 POST, 3+1 TIP, trạng thái thích/lưu và quyền SCAN |
| Client web và biểu mẫu | **9/9 đạt**, nằm trong tổng backend: đăng xuất, đổi tài khoản, refresh đồng thời và checkbox bỏ chọn |
| Cấu hình web | **10/10 đạt**, nằm trong tổng backend: cấu hình production và chốt Spark local |
| Trang đặt mật khẩu | **5/5 đạt** với HTTP mock, nằm trong tổng backend; chủ tài khoản đã hoàn tất đặt mật khẩu thật với Google |
| Ảnh inline backend | **5/5 đạt** với Emulator, nằm trong tổng backend: upload/complete/download, so sánh byte, quyền riêng tư và chặn gọi Storage |
| Android JVM | **17/17 đạt** sau bản sửa mạng; chính sách endpoint, nghiệp vụ Java và 6 ca lựa chọn môi trường |
| Android instrumentation với Firebase Emulator | **39/39 đạt, 0 lỗi, 0 bỏ qua** trên Pixel 6a/API 37 sau khi ghép offline, xoay ngang và chat; gồm hồ sơ, đăng nhập/Admin, giao dịch, phân trang, cache, ảnh, mạng/TLS. Log: `.qa/current-android-full.log`. |
| Android SQLite và giao diện offline sau khi mất phiên — 20/10 | **3/3 cache và 1/1 giao diện đạt, 0 lỗi, 0 bỏ qua** trên Pixel 6a/API 37. Ca giao diện nạp trước bài/mẹo/chi tiết/bình luận, tạo lại client không còn phiên, giả lập lỗi kết nối, mở nội dung từ màn đăng nhập, kiểm tra chế độ chỉ đọc và chặn đơn hàng. XML: `.qa/current-offline-snapshot.xml`, `.qa/current-offline-guest-ui.xml`. Lỗi mạng được giả lập; chưa thử chế độ máy bay trên thiết bị thật. |
| Android chat và cloud chỉ đọc | **1/1 chat UI đạt** ở lượt riêng: mở hội thoại, gửi rồi đọc lại từ Firestore Emulator. **1/1 cloud GET đạt** ở lượt riêng: đọc bài/mẹo trên project thật, không ghi dữ liệu. |
| Android hồ sơ | **2/2 đạt**: dữ liệu tài khoản/điểm thật, không sinh bài demo cho hồ sơ rỗng, đọc media[], hiển thị lượt thích bằng 0 và tải ảnh thật. |
| Seed Emulator | Tài khoản demo cũ được đồng bộ role và verification record qua script chỉ chạy với project demo-*; test Admin/checkout qua sau khi seed lại. |
| Trang QA DOM cũ | Đã bỏ kết quả passed viết sẵn; trang hiện báo not-run vì module runner không tồn tại, không còn hiển thị kết quả giả. |
| Android đọc cloud | **1/1 đạt ở lượt riêng sau thay đổi cache**: health và 3 vòng tips/posts cách nhau 6,5 giây; không đăng nhập hoặc ghi dữ liệu cloud. Lượt trước ghi nhận hai EOF sau nhàn rỗi và đã tự phục hồi. |
| Mô hình/layout/sơ đồ | **13/13 đạt**, giữ 20 thực thể nghiệp vụ và quy tắc riêng tư SCAN trong SQL tham chiếu |
| Browser cộng đồng trên Emulator | **6/6 đạt** trên Edge: đọc bài DB, toàn văn/bình luận, ẩn bình luận/cập nhật bộ đếm, sửa bài, chặn bài ẩn công khai, ẩn SCAN với Moderator |
| Browser quản trị cơ bản trên Emulator | **5/5 đạt**: đăng nhập/dashboard, form danh mục kể cả checkbox bỏ chọn, lọc tin, chi tiết/media và menu Moderator; thêm ca chặn phản hồi ảnh đến muộn. 375px và desktop không tràn ngang. |
| HTTP qua Functions/Hosting Emulator | **4/4 đạt**: trang Admin, sửa/đọc lại bài mẫu, tương tác/bình luận/ẩn bài, JPEG SCAN thật trong Storage |
| Firebase cloud Spark | Đã triển khai Auth Email/Password, Rules/Indexes; seed 23 document; đọc 3 POST/2 TIP; ảnh giữ nguyên byte; SCAN ẩn danh bị chặn 401; sửa–đọc–khôi phục database/API đạt |
| APK debug | Build thành công tại `app/build/outputs/apk/debug/app-debug.apk` |
| Hạ tầng | Billing vẫn tắt; không triển khai Functions, Storage, Cloud Scheduler hoặc Hosting công khai |
| Thanh toán merchant | Chưa nghiệm thu MoMo/VNPay thật; không xử lý tiền thật trong các kiểm tra này |

Các số lượng của suite con đã nằm trong tổng backend, không cộng thêm lần nữa. Lượt 107 backend/9 Android/8 JVM là lịch sử trước khi bổ sung Spark. Các kết quả cũ hơn ghi tại [backend-verification.md](backend-verification.md) và [frontend-review.md](frontend-review.md). Ngày 20/10/2026, cấu hình OAuth Android/Web đã có trong `google-services.json`; `:app:assembleDebug` thành công và resource `default_web_client_id` được sinh. **Chưa nghiệm thu đăng nhập Google cloud trên thiết bị**, đồng thời chưa xác minh trực tiếp trạng thái Google provider; xem [cách kiểm tra](android-firebase.md#bật-đăng-nhập-google).

Chỉ mục Firestore mới cho `messages` theo `conversation_id` tăng dần và `sent_at` giảm dần đã được triển khai lên project `recycling-share-app`. Trước khi triển khai, cloud có 52 chỉ mục và file local có 53, chỉ khác chỉ mục này; Firestore Admin API hiện trả trạng thái **READY** cho chỉ mục mới. Chưa thực hiện gửi tin bằng tài khoản cloud thật. Không thay đổi Rules hoặc dữ liệu cloud trong lượt này.

`lintDebug` phát hiện hai thuộc tính padding trong style chỉ có từ API 26 trong khi `minSdk` là 24; đã đổi sang `paddingStart/End/Top/Bottom`. Lint cũng chỉ ra nhánh `NoCredentialException` còn thiếu trong Google Sign-In; đã thêm thông báo hướng dẫn đăng nhập email hoặc thêm tài khoản Google. Ngày 20/10 chạy lại `assembleDebug`, `testDebugUnitTest` và `lintDebug` đều đạt, **0 lỗi lint**. Báo cáo vẫn có cảnh báo không chặn build, chủ yếu tài nguyên layout/vector hiện chưa được tham chiếu tĩnh và cảnh báo thiết kế/chuỗi văn bản; xem `app/build/reports/lint-results-debug.html`.

## Tải dữ liệu theo trang và nạp trước — 19/10/2026

Sau Firebase Auth, client bắt đầu tải 3 bài chia sẻ song song với `/me`; sau khi hồ sơ sẵn sàng, chờ tối đa 2 giây để trang bài đầu có thể hiển thị ngay. Các màn Mẹo hay, Chợ đồ cũ, thông báo, lời mời kết bạn và bài cá nhân được nạp tiếp theo ở nền. GET trùng nhau dùng cùng kết quả. Cache RAM được giới hạn theo tài khoản; bản SQLite chỉ giữ nội dung/ảnh công khai đã xem để đọc khi mất kết nối. Đăng xuất xóa cache riêng tư và callback cũ. Danh sách chính lấy 3 mục mỗi trang, tải tiếp khi người dùng cuộn gần cuối; quay lại từ chi tiết giữ trang và vị trí đã xem. [Thiết kế chi tiết](data-loading.md).

Đã chạy lại bộ tổng hợp trên **EcoShareReview emulator-5556**: **32/32 Android, 17/17 JVM, 13/13 kiểm tra mô hình**, không lỗi hoặc bỏ qua. Hai ca UI mới xác nhận 3 bài đầu, cuộn mới lấy tiếp, bỏ ID trùng và giữ dữ liệu khi đổi tab. Bốn ca cache mới kiểm tra dùng chung request, bộ nhớ đệm theo phiên, làm mới sau thao tác ghi và đăng xuất. Lượt Android chỉ đọc cloud nằm trong tổng 32 ca; không dùng tài khoản/mật khẩu cloud để tự động hóa đăng nhập. Kết quả tại `.qa/paging-full-tests.txt`, `.qa/paging-full-android-results.xml`, `.qa/paging-final-counts.json`.

Backend biên dịch và **21/21 ca liên quan đạt**. API cloud mới ở cổng 5002 đã đọc thử `/posts?limit=2` được 2 bài rồi 1 bài với cursor, `/tips?limit=3` được 2 mẹo. Đối chiếu chỉ đọc trước/sau tối ưu trả JSON giống nhau, SCAN ẩn danh vẫn bị chặn. Không tạo hoặc sửa dữ liệu cloud trong lượt này.

APK mới đã cài bằng `adb install -r` lên emulator người dùng **5554**, mở MainActivity và tiến trình app còn chạy; không gỡ app hoặc xóa dữ liệu. Phiên đăng nhập chỉ ở bộ nhớ nên cần đăng nhập lại sau khi cài. API Spark cổng 5002 và Admin web cổng 5173 vẫn chạy.

## Sửa lỗi tải dữ liệu chập chờn — 19/10/2026

Đã ghi nhận EOF trước HTTP headers trong tiến trình app trên thiết bị người dùng khi gọi backend Spark 5002. Quyền mạng local đã được cấp, ping máy tính 1–3 ms và API kiểm tra trên máy tính trả HTTP 200; chưa xác định thành phần đóng kết nối ban đầu. Các thông báo chung trước đây không phân biệt được gián đoạn socket, timeout hay server chưa chạy.

Client nay chỉ phục hồi GET JSON/ảnh một lần bằng socket mới khi gặp EOF/reset, có kiểm tra hủy request và thế hệ phiên. Không tự gửi lại thao tác ghi vì lỗi mạng; lỗi HTTP, timeout, TLS, DNS, quyền hoặc kết nối bị từ chối không đi vào nhánh này. Màn hình giữ thông báo cụ thể và thao tác chạm để tải lại; lỗi đến muộn từ tab Khám phá cũ không thay nội dung tab mới. Feed chỉ truy vấn MIME của ảnh thay vì tải dư `_inline_bytes` từ Firestore; JSON và quyền SCAN giữ nguyên.

Lượt đầy đủ sau sửa đạt **25/25 Android và 17/17 JVM**, không lỗi hoặc bỏ qua. Tám ca socket kiểm tra server dừng, timeout, EOF lặp lại chỉ thử tối đa hai lần, GET phục hồi bằng socket mới, POST không gửi lại, đăng xuất hủy retry/callback cũ, HTTP 503 giữ đúng lỗi và log không lộ query/ID. Hai ca UI kiểm tra hiển thị lỗi rồi chạm tải lại thành công, và bỏ qua lỗi tab cũ. Backend chạy lại ba suite liên quan đạt **20/20**; lượt đầy đủ 127 và browser 11 là bằng chứng lịch sử, không phải kết quả chạy lại lần này.

Log cục bộ: `.qa/network-full-android-results.xml`, `.qa/network-full-android-tests.txt`, `.qa/network-transport-tests.txt`, `.qa/network-social-metadata-tests.txt`, `.qa/network-social-cloud-projection-readback.txt`. Backend đã khởi động lại để nạp bản tối ưu metadata, log tại `.qa/network-spark-server.txt`. Chi tiết và cách kiểm tra tại [network-fix.md](network-fix.md).

Lượt Android chỉ đọc cloud chạy riêng đạt **1/1**, không lỗi hoặc bỏ qua. Sau GET health, app đọc `/tips` và `/posts` ba vòng, nghỉ 6,5 giây giữa các vòng. Hai vòng sau ghi nhận EOF trước headers khi đọc tips; client đã dùng lần phục hồi và cả ba vòng đều nhận 2 TIP/3 POST. Đây là phục hồi thực qua backend Spark và Firestore cloud, ngoài fixture socket. Không đăng nhập hoặc ghi dữ liệu cloud. Báo cáo tại `.qa/network-spark-readonly-results.xml`; các dòng bằng chứng đã lọc tại `.qa/network-spark-readonly-evidence.txt`, tổng hợp tại `.qa/network-final-counts.json`.

APK mới đã cài cập nhật bằng `install -r` trên thiết bị người dùng và mở ổn định; không gỡ app hoặc xóa dữ liệu. Tiến trình mới không giữ token trong bộ nhớ của tiến trình cũ nên cần đăng nhập lại. Backend Spark cổng 5002 đang chạy bản mới.

## Sửa lỗi tự thoát khi đăng nhập — 19/10/2026

Log từ bản app trên thiết bị xác nhận `NetworkOnMainThreadException` tại `FirebaseBackendClient.signOut()` → `ConnectionPool.evictAll()`, được gọi qua `MainActivity.loginFailed()`. Thiết bị chưa lưu cấu hình kết nối nên bản cũ chọn Cloud Functions, trong khi backend hiện tại là Spark local. Đã sửa việc dọn kết nối TLS sang worker và dùng pool/dispatcher riêng cho phiên mới; bản debug mới của project hiện tại mặc định Spark khi chưa có lựa chọn, giữ lựa chọn đã lưu và cấu hình release HTTPS.

Ba kiểm thử TLS local đã đạt: đăng xuất khi còn TLS keep-alive rồi đăng nhập lại ngay; đóng client trên main thread an toàn/lặp lại; và đối chứng chủ động tái hiện `NetworkOnMainThreadException` khi gọi cách đóng TLS cũ trên main thread. Fixture chỉ chạy loopback trong thiết bị kiểm thử, không đăng nhập hoặc gửi request tới Firebase cloud. Sáu kiểm thử JVM mới kiểm tra lựa chọn kết nối. Lượt đầy đủ sau bản sửa đạt **15/15 Android và 17/17 JVM**, không lỗi hoặc bỏ qua. Chi tiết tại [android-login-fix.md](android-login-fix.md).

APK đã cài cập nhật bằng `install -r` trên thiết bị người dùng, không gỡ app hoặc xóa dữ liệu. Sau khi mở, tiến trình còn hoạt động và hierarchy giao diện xác nhận nhãn Spark; log AndroidRuntime kể từ cập nhật không có crash. Đây là kiểm tra khởi động/môi trường, chưa phải phiên đăng nhập cloud bằng mật khẩu của người dùng.

Log cục bộ của lần sửa: `.qa/android-user-login-crash.txt`, `.qa/login-fix-tls-tests.txt`, `.qa/login-fix-full-android-tests.txt`; tổng hợp số lượng tại `.qa/login-fix-final-test-counts.json`. Kết quả 127 backend và 11 tình huống browser bên trên thuộc lượt kiểm tra tính năng trước đó, không phải lần chạy lại do bản sửa Android này. Chưa dùng mật khẩu của người dùng để tự động hóa đăng nhập cloud trên Android.

## Xác nhận dữ liệu cloud

Project **`recycling-share-app`** có database `(default)` ở `nam5`. Firebase CLI đã xác thực; Authentication Email/Password, Rules và Indexes đã triển khai. Tài khoản Admin thật đã bootstrap, chủ tài khoản tự đặt mật khẩu qua trang local; mật khẩu gửi trực tiếp đến Google HTTPS, không qua backend Node/log/chat. Quyền Admin không tự cấp VERIFIED.

Seed cloud đã tạo **23 document** gắn với tài khoản Admin thật: 3 POST, 2 TIP, 1 SCAN riêng tư, 3 tin bán PENDING và 3 dòng hàng, 1 danh mục, 9 ảnh JPEG inline và 1 audit. Không tạo Auth demo, KYC, đơn hàng hoặc thanh toán giả. Tin bán chưa xuất hiện trong chợ công khai, cần xác minh và duyệt hợp lệ. Script chỉ tạo bản ghi mẫu còn thiếu và giữ nội dung đã sửa.

Đọc lại qua API local dùng Firestore cloud xác nhận 3 POST và 2 TIP công khai. Ảnh tải về giống từng byte với dữ liệu đã lưu; request SCAN riêng tư chưa đăng nhập trả 401. Kiểm tra sửa bài trực tiếp qua SDK, đọc nội dung qua API rồi khôi phục có điều kiện thành công; bước khôi phục chỉ ghi khi bài vẫn mang đúng thay đổi kiểm tra, tránh ghi đè thay đổi khác.

Đây là bằng chứng **database/API cloud**, chưa phải kiểm thử browser Admin đã đăng nhập cloud. Để kiểm tra panel thủ công, giữ API `npm --prefix backend run dev:cloud` chạy, mở **http://127.0.0.1:5173/** và đăng nhập email Admin thật với mật khẩu đã đặt. Vào **Bài chia sẻ**, chọn bài có nhãn mẫu, sửa nội dung kèm lý do rồi lưu/mở lại; API/app phải hiển thị cùng nội dung. **Mẹo hay**, **Ảnh SCAN** và **Chợ đồ cũ** đọc cùng database.

Log cloud cục bộ: `.qa/spark-cloud-provision.txt`, `.qa/spark-cloud-indexes.txt`, `.qa/spark-cloud-seed.txt`, `.qa/spark-cloud-readback.txt`, `.qa/spark-final-cloud-state.txt`. Kiểm tra cuối xác nhận billing vẫn tắt, Admin đã sẵn sàng đăng nhập mật khẩu và 3 POST/2 TIP đã xuất bản. Tệp `.qa` bị loại khỏi Git; không ghi token/mật khẩu hoặc liên kết đặt mật khẩu vào tài liệu.

## Xác nhận trên Emulator

Project kiểm thử **`demo-recycling-share`** dùng Auth/Firestore/Storage/Functions/Hosting Emulator, tách biệt dữ liệu cloud. Seed tạo tài khoản Admin/Moderator/người mua/người bán, 3 bài chia sẻ, 2 mẹo hay, 3 tin bán cộng đồng cộng tin đèn từ seed cơ bản, 2 đơn hàng, lời mời/thông báo, SCAN riêng tư và ảnh Storage. Chi tiết tại [community-release.md](community-release.md).

HTTP smoke đã sửa bài mẫu từ Admin API, đọc lại qua API công khai và khôi phục. Tạo bài QA qua API, thích lặp lại chỉ tăng một lần, lưu giữ trạng thái, gửi/ẩn bình luận cập nhật bộ đếm; bài ẩn trả 404 công khai. SCAN tải được JPEG thật từ Storage và từ chối Moderator. Ảnh được kiểm tra tải lên/tải xuống và so sánh byte.

Router dùng ID token thật từ Auth Emulator. Các route `/content` và `/admin/content` cũ không lộ SCAN; `/interactions` cũ không cho bỏ qua bộ đếm cộng đồng. Khi quyền Admin trong Firestore bị thu hồi, token còn hạn không tiếp tục cấp quyền quản trị.

Ảnh inline có suite backend riêng dùng Firestore Emulator với adapter Storage bị chặn, kiểm tra quyền/chủ sở hữu, hoàn tất upload và đọc lại byte. `FirebaseInlineMediaTest` trên Android gọi API riêng cổng 5003 với Auth/Firestore Emulator, upload byte thực, complete, download và đối chiếu byte; factory chỉ dùng bản debug, cố định project demo và endpoint local. Android còn kiểm tra xoay EXIF, giới hạn kích thước và nén ảnh. Các lỗi đã sửa gồm PATCH làm mất vật liệu/trọng lượng/tags không gửi lại; multipart hỏng đầu ảnh Storage; socket cũ sau đăng xuất; phiên web cũ quay lại sau đăng xuất; checkbox không thể bỏ chọn.

Log kiểm tra tính năng trước bản sửa đăng nhập: `.qa/spark-full-tests.txt`, `.qa/spark-android-final-tests.txt`, `.qa/social-design-tests.txt`. Android/JVM đã chạy lại sau bản sửa mạng như phần tương ứng phía trên. Báo cáo Android ở `app/build/reports/androidTests/connected/debug/index.html` có thể được thay bằng lượt chạy cuối; báo cáo đầy đủ 25 ca đã sao chép riêng trong `.qa/network-full-android-results.xml`. Báo cáo JVM ở `app/build/test-results/testDebugUnitTest`. Ảnh chụp giao diện thuộc Emulator, lưu tại [previews/community](previews/community/01-home.png). Bộ mẫu Emulator sạch từng được export tại `.qa/firebase-community-export`; tests có thể tạo/dọn dữ liệu QA, cần seed lại trước khi xem mẫu.

## Chạy lại

Khởi chạy Emulator kiểm thử riêng theo [firebase-backend.md](firebase-backend.md), hoặc để CLI tự tạo/tắt Emulator:

```powershell
npm --prefix backend run test:emulators
```

Nếu Emulator đã chạy, đặt đủ các biến host theo hướng dẫn backend rồi chạy `npm --prefix backend test`. Thiếu các biến host sẽ làm suite integration bị SKIP; không coi kết quả đó là kiểm tra toàn bộ. Rules tests có thao tác làm sạch Firestore Emulator; seed lại trước khi duyệt bộ mẫu. Các script test/seed Emulator không được chạy vào cloud.

Để kiểm tra toàn bộ Android, cần bộ Emulator đã seed và một API ảnh inline riêng cổng 5003. Trong terminal đã đặt ba biến host Emulator:

```powershell
$env:GCLOUD_PROJECT='demo-recycling-share'
$env:ECOSHARE_MEDIA_BACKEND='firestore'
$env:PORT='5003'
npm --prefix backend run dev
```

Giữ terminal trên chạy. Trong terminal khác:

```powershell
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
./gradlew.bat :app:assembleDebug :app:testDebugUnitTest --no-configuration-cache
# Chọn đúng thiết bị theo kết quả adb devices.
$env:ANDROID_SERIAL = 'emulator-5556'
./gradlew.bat :app:connectedDebugAndroidTest '-Pandroid.testInstrumentationRunnerArguments.ecoshareEmulator=true' '-Pandroid.testInstrumentationRunnerArguments.ecoshareInlineEmulator=true' '-Pandroid.testInstrumentationRunnerArguments.notClass=com.example.recyclingshareapp.FirebaseSparkReadOnlyTest' --no-configuration-cache
python tools/validate_design.py
```

Kiểm thử Android chỉ đọc cloud là lượt opt-in riêng, cần API Spark 5002 đang chạy và cấu hình project thật. Không cần tài khoản/mật khẩu; ca này chỉ GET công khai:

```powershell
./gradlew.bat :app:connectedDebugAndroidTest '-Pandroid.testInstrumentationRunnerArguments.class=com.example.recyclingshareapp.FirebaseSparkReadOnlyTest' '-Pandroid.testInstrumentationRunnerArguments.ecoshareCloudReadOnly=true' --no-configuration-cache
```

Trên API 37, bản debug cần cấp quyền `ACCESS_LOCAL_NETWORK` để dùng Emulator hoặc Spark local. Quyền khai báo riêng trong debug manifest và được yêu cầu ở luồng đăng nhập local. Bản cloud release dùng HTTPS. Hướng dẫn kết nối tại [android-firebase.md](android-firebase.md).

Để kiểm tra browser, khởi chạy Functions/Hosting Emulator, đặt cấu hình local demo, seed và mở `http://127.0.0.1:5174/tests/runner.html`. Các trang QA chỉ chấp nhận project demo trên localhost; cấu hình Spark hiện tại cần được đổi về Emulator trước khi chạy chúng.

Generator Android cũ dừng khi thấy `CommunityFragment.java`; layout Firebase được duy trì trực tiếp trong `app/src/main/res/layout/`. `tools/configure_native.py --check` chỉ đọc và kiểm tra host/theme.

## Giới hạn xác nhận

Giữ Spark/billing tắt nghĩa là Node backend chạy trên máy tính cổng 5002, Auth/Firestore ở cloud và ảnh inline tối đa 384 KiB. Cần giữ máy tính/server chạy; chưa có backend public để điện thoại dùng độc lập bên ngoài máy phát triển. Functions, Cloud Storage, Scheduler và Hosting công khai chưa triển khai. Kiểm thử Emulator không chứng minh các dịch vụ này chạy trên cloud.

Admin mobile cơ bản đã nối API tổng quan, duyệt tin bán và xử lý báo cáo kèm kiểm tra quyền. Tin nhắn giữa hai tài khoản đã nối API; một số tùy chọn cài đặt/màn hình phụ còn prototype; phạm vi tại [screen-mapping.md](screen-mapping.md). SCAN chụp/lưu ảnh, chưa nhận diện ML. Chưa có OTP/eKYC tự động. MoMo/VNPay merchant thật đang tắt; hoàn tiền VNPay tự động chưa triển khai.

Chưa tự động hóa phiên đăng nhập cloud của Android hoặc Admin browser; không suy từ ảnh Emulator rằng mọi luồng đã nghiệm thu trên cloud. Kiểm thử chưa bao phủ mọi thiết bị, khả năng truy cập hoặc mọi tình huống mạng.
