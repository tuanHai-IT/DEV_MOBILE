# Kết nối Android với Firebase backend

Đã thêm lớp `data/remote/FirebaseBackendClient.java`: đăng ký/đăng nhập email và mật khẩu qua Firebase Auth REST, làm mới ID token, gọi API JSON có Bearer token và `Idempotency-Key`. Công việc mạng chạy trên worker; callback trả về main thread. Client dùng REST nên không cần thêm Firebase Android SDK hoặc service account trong APK. Có thể truyền cấu hình trực tiếp hoặc đọc cấu hình từ `google-services.json` bằng factory bên dưới.

**Các luồng chính đã kết nối Firebase qua `CommunityFragment` và `BackendSession`:** đăng nhập/đăng ký, hồ sơ, địa chỉ, xác minh, bài chia sẻ, mẹo hay, bình luận, thích/lưu, bạn bè, thông báo, SCAN, đăng bán, đơn hàng và trò chuyện giữa hai tài khoản. Trang chủ chỉ lấy POST đã xuất bản; Khám phá lấy TIP và tin bán. Dữ liệu bài viết/tin nhắn ở các tab chính không còn được tạo giả trong giao diện. Admin mobile cơ bản đã đọc tổng quan, duyệt tin bán và xử lý báo cáo qua API, có kiểm tra quyền mới nhất từ `/me`. Một số tùy chọn cài đặt/màn hình phụ vẫn còn prototype.

Đã nhận `app/google-services.json` cho project `recycling-share-app`; package `com.example.recyclingshareapp` khớp `applicationId`. **Đang giữ gói Spark**, dùng Firebase Auth/Firestore cloud và Node local cổng 5002, ảnh inline tối đa 384 KiB. Ngày 19/10/2026, CLI đã xác thực, Auth Email/Password và Rules/Indexes đã triển khai; tài khoản Admin thật đã bootstrap và chủ tài khoản đã đặt mật khẩu. Cloud đã có 3 bài chia sẻ, 2 mẹo hay, 1 SCAN riêng tư, 3 tin bán PENDING và ảnh thật. Không triển khai Functions/Storage hoặc backend public cho chế độ này; xem [phạm vi cập nhật](community-release.md).

## Chạy bằng Firebase Emulator

Khởi chạy và seed backend theo [hướng dẫn Firebase](firebase-backend.md). Bản debug không còn nút đổi backend trên màn hình đăng nhập; các bài kiểm thử Android chọn Emulator bằng `BackendSession.useEmulator(context, true)` trước khi mở màn hình. Dùng `buyer@ecoshare.test`, `seller@ecoshare.test`, `admin@ecoshare.test` hoặc `moderator@ecoshare.test`, mật khẩu local `EcoShareDemo123!`. Đây là tài khoản được tạo trong Auth Emulator.

Trên Android 17/API 37, bản debug cần quyền `ACCESS_LOCAL_NETWORK` để kết nối Emulator; màn hình đăng nhập yêu cầu quyền trước khi gọi mạng local. Cho phép quyền khi được hỏi. Quyền này được khai báo riêng trong debug manifest; bản cloud release dùng HTTPS. Yêu cầu của Android được mô tả tại [Local network permission](https://developer.android.com/privacy-and-security/local-network-permission).

Trên Android Emulator, địa chỉ máy Windows là `10.0.2.2`. Nếu cần tạo client trực tiếp:

```java
FirebaseBackendClient client = new FirebaseBackendClient(
    getApplicationContext(),
    "http://10.0.2.2:5001/demo-recycling-share/asia-southeast1/api/v1",
    "demo-key",
    "http://10.0.2.2:9099"
);

client.signIn("buyer@ecoshare.test", "<mật khẩu của tài khoản emulator>",
    new FirebaseBackendClient.Callback<FirebaseBackendClient.SessionInfo>() {
        @Override public void onSuccess(FirebaseBackendClient.SessionInfo account) {
            client.getMe(new FirebaseBackendClient.Callback<JSONObject>() {
                @Override public void onSuccess(JSONObject profile) {
                    // Callback đã ở main thread; ánh xạ profile sang dữ liệu màn hình.
                }
                @Override public void onError(FirebaseBackendClient.BackendException error) {
                    // Hiển thị error.getMessage(); không ghi token hoặc mật khẩu ra log.
                }
            });
        }
        @Override public void onError(FirebaseBackendClient.BackendException error) {
            // Hiển thị lỗi đăng nhập; error.code dùng để phân loại.
        }
    });
```

Import `com.example.recyclingshareapp.data.remote.FirebaseBackendClient` và `org.json.JSONObject`. Tài khoản emulator phải tồn tại hoặc được tạo bằng `client.signUp(...)`; API `/me` tạo hồ sơ MEMBER an toàn trong lần gọi đầu tiên. Không có tài khoản nào tự trở thành admin.

Nếu dùng điện thoại qua USB, chuyển cả hai URL sang `127.0.0.1` và chạy:

```powershell
adb reverse tcp:5001 tcp:5001
adb reverse tcp:9099 tcp:9099
adb reverse tcp:9199 tcp:9199
```

HTTP chỉ được mở cho chính xác `10.0.2.2` và `127.0.0.1` trong bản debug. Client không cho kết hợp Auth Emulator với API production. Constructor dùng loopback hỗ trợ kiểm tra qua USB; `BackendSession` mặc định debug dùng `10.0.2.2` cho Android Emulator. Bản release yêu cầu HTTPS và giữ kiểm tra chứng chỉ TLS.

## Spark: backend máy tính và Firebase thật

Khởi chạy `npm --prefix backend run dev:cloud` theo [hướng dẫn backend](firebase-backend.md). Bản debug của project `recycling-share-app` tự dùng **Spark miễn phí · Backend máy tính + Firestore cloud**; cấu hình kết nối cũ đã lưu được bỏ qua và xóa. Không còn nút chọn backend ở màn hình đăng nhập. Project khác hoặc thiếu cấu hình không tự chọn Spark, bản release luôn dùng backend HTTPS. Các bài kiểm thử vẫn có thể chọn Emulator bằng `BackendSession.useMode(...)` trong tiến trình kiểm thử. Factory `FirebaseBackendClient.forSparkLocal(context)` dùng `http://10.0.2.2:5002/v1` trên Android Emulator, public key từ Google Services và Auth/refresh Google HTTPS thật. Factory giới hạn bản debug, đúng project `recycling-share-app` và cổng local 5002; không dùng Auth Emulator. Cấp quyền mạng local trên API 37 khi được hỏi.

Dùng tài khoản Firebase thật đã được thiết lập mật khẩu; các tài khoản/mật khẩu `@ecoshare.test` chỉ thuộc Emulator. Đổi môi trường sẽ xóa phiên trong bộ nhớ. Cần giữ backend máy tính chạy; chưa có URL backend public cho điện thoại dùng độc lập bên ngoài máy phát triển.

Nếu đăng nhập báo **“Không tìm thấy máy chủ”**, kiểm tra DNS của Android Emulator trước khi kiểm tra tài khoản: app phải phân giải được `identitytoolkit.googleapis.com` để gọi Firebase Auth. Trên máy phát triển, đã ghi nhận `UnknownHostException` cho tên miền này dù backend `10.0.2.2:5002` vẫn truy cập được. Có thể kiểm tra bằng `adb shell ping -c 1 -W 3 identitytoolkit.googleapis.com`. Nếu báo `unknown host`, tắt máy ảo đang chạy rồi khởi động lại với DNS chỉ định rõ (thay `Pixel_6a` bằng tên từ lệnh `-list-avds`):

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\emulator\emulator.exe" -list-avds
& "$env:LOCALAPPDATA\Android\Sdk\emulator\emulator.exe" -avd Pixel_6a -dns-server 1.1.1.1,8.8.8.8 -no-snapshot-load
```

`-no-snapshot-load` khởi động máy ảo mới nhưng giữ dữ liệu ứng dụng. Sau khi máy ảo sẵn sàng, chạy lại lệnh `ping` và thử đăng nhập. Tham số DNS chỉ áp dụng cho lần chạy này; nếu mở AVD lại từ Android Studio mà lỗi tái diễn, kiểm tra DNS/VPN của Windows hoặc khởi động bằng lệnh trên. Xem [hướng dẫn DNS chính thức của Android Emulator](https://developer.android.com/studio/run/emulator-networking-dns).

Spark upload nhận `upload_mode:FIRESTORE`, PUT byte vào `upload_path` qua API, rồi hoàn tất. Ảnh/metadata được lưu ở `media_assets`, tối đa **384 KiB/tệp**. Android tự xử lý chiều EXIF, thu ảnh về tối đa 1024 pixel và nén JPEG trên worker trước khi gửi; báo lỗi nếu vẫn vượt giới hạn. Client chỉ nhận ticket đúng chế độ kết nối và API hiện tại. SCAN giữ quyền riêng tư chủ ảnh/Admin. Không tạo bucket hay signed URL Storage trong chế độ Spark.

## Cấu hình và adapter Cloud Functions trong source

`app/google-services.json` đã chứa cấu hình Android của project `recycling-share-app`. Google Services plugin **4.5.0** chỉ được áp dụng khi file này tồn tại tại `app/`; plugin sinh các resource như `project_id`, `google_api_key`, `google_app_id` và `google_storage_bucket`. Bản đóng gói GitHub cho team đã kèm file cấu hình client này. Nếu thiếu file, app vẫn có thể build nhưng cần thêm cấu hình trước khi đăng nhập. Bản debug hiện tự dùng backend Spark; chạy Firebase Emulator không tự đổi chế độ kết nối Android.

Factory Functions bên dưới vẫn được giữ trong source cho trường hợp backend HTTPS đã được triển khai riêng. **Không chọn factory này để chạy cấu hình Spark hiện tại**:

```java
FirebaseBackendClient client = FirebaseBackendClient.fromGoogleServices(
    getApplicationContext()
);
```

Factory đọc `project_id`/`google_api_key` và dùng region backend `asia-southeast1`, tương ứng `https://asia-southeast1-recycling-share-app.cloudfunctions.net/api/v1`. Factory báo lỗi cấu hình nếu thiếu resource; không tự đăng nhập, gọi mạng hoặc triển khai dịch vụ. Nếu triển khai region/endpoint khác, dùng constructor rõ ràng:

```java
FirebaseBackendClient client = new FirebaseBackendClient(
    getApplicationContext(),
    "https://asia-southeast1-<PROJECT_ID>.cloudfunctions.net/api/v1",
    "<FIREBASE_WEB_API_KEY>"
);
```

Web API key là cấu hình client; service account và các khóa bí mật MoMo/VNPay phải nằm ở phía server. Không dùng token của emulator trên project thật. Mọi thao tác giá tiền, tồn kho, vai trò, xác minh và điểm xanh vẫn được backend quyết định.

Thêm JSON không tự tạo Firestore database, bật Authentication/Storage hoặc deploy Cloud Functions. Nút Google trên màn hình đăng nhập dùng Android Credential Manager, sau đó đổi Google ID token thành Firebase ID/refresh token qua `accounts:signInWithIdp`. Backend tiếp tục xác minh Firebase ID token như đăng nhập email; người dùng mới được tạo hồ sơ MEMBER qua `/me`. Nút Apple chưa được kết nối nên đang ẩn.

### Bật đăng nhập Google

1. Vào Firebase Console → **Authentication** → **Sign-in method**, bật nhà cung cấp **Google** cho đúng project `recycling-share-app`.
2. Chạy `.\gradlew.bat :app:signingReport` để lấy SHA-1 và SHA-256 của chứng chỉ debug. Thêm các dấu vân tay này tại **Project settings** → ứng dụng Android `com.example.recyclingshareapp`. Nếu phân phối APK ký bằng chứng chỉ khác, thêm cả dấu vân tay của chứng chỉ đó.
3. Tải lại `google-services.json` từ Firebase Console, đặt tại `app/google-services.json`, rồi Sync Gradle và build lại APK. File mới phải có OAuth client Android và Web; plugin Google Services tạo resource `default_web_client_id` từ Web client ID. Không dùng Android client ID làm server client ID và không hardcode OAuth ID trong source.
4. Nếu màn hình chấp thuận OAuth đang ở chế độ thử nghiệm, thêm email thử nghiệm tại Google Auth Platform. Trên thiết bị có Google Play services, bấm **Google** ở màn hình đăng nhập. Với chế độ Spark, backend máy tính cổng 5002 phải đang chạy để tải `/me` và dữ liệu sau khi xác thực.

Ngày 20/10/2026, Firebase Console đã hiển thị SHA-1/SHA-256 debug đúng với `com.example.recyclingshareapp`; `app/google-services.json` mới có OAuth client Android và Web, và Gradle đã sinh `default_web_client_id`. `:app:assembleDebug` thành công. Chưa xác minh trực tiếp trạng thái Google provider qua Console hoặc đăng nhập thực tế vì không có thiết bị Android kết nối; cần kiểm tra Google hiện **Enabled** trong Authentication → Sign-in method rồi cài APK debug mới và thử đăng nhập. Khi phát hành APK ký bằng chứng chỉ khác, thêm SHA của chứng chỉ phát hành. Chế độ Auth Emulator của ứng dụng dùng tài khoản thử nghiệm email/mật khẩu; đăng nhập Google chỉ dùng project Firebase thật.

## Gọi nghiệp vụ

```java
JSONObject profile = new JSONObject().put("display_name", "Nguyễn An");
client.request("PATCH", "/me", profile, null, callback);

JSONObject message = new JSONObject().put("text", "Sản phẩm này còn không?");
String key = java.util.UUID.randomUUID().toString();
client.request("POST", "/conversations/<ID>/messages", message, key, callback);

client.getPublic("/listings?limit=20", callback);
```

`CommunityFragment` gọi `/posts`, `/tips`, các route bình luận/phản ứng, `/friends`, `/notifications` và `/scans`; `BackendSession` chia sẻ một phiên đăng nhập giữa các màn hình. Tạo bài hỗ trợ nội dung tối đa 500 ký tự, ảnh từ máy, vật liệu, trọng lượng và tags. Chi tiết hiển thị toàn văn và ô bình luận tại cuối trang. Nút thích/lưu phản ánh trạng thái đã lưu trên server; không có nút chia sẻ bài viết.

Sau xác thực, client nạp trước tối đa 6 bài chia sẻ, sau đó nạp các màn thường dùng ở nền. Danh sách bài, mẹo, chợ, bạn bè, thông báo, SCAN, đơn hàng, tin bán và hội thoại lấy theo trang bằng `limit`/`next_cursor`; cuộn gần cuối mới lấy tiếp. Cache riêng tư trong RAM được giới hạn theo phiên và xóa khi đăng xuất/đổi tài khoản. SQLite lưu có giới hạn các trang/ảnh **công khai đã xem** để đọc khi API tạm mất kết nối. Nếu mở lại app khi đang offline, chọn **Xem nội dung công khai** tại màn đăng nhập để đọc các trang đã lưu ở chế độ chỉ đọc; thao tác ghi vẫn cần mạng. [Chi tiết luồng tải và kiểm tra](data-loading.md).

Ảnh bài và ảnh SCAN dùng phiên upload `/media`. Spark lưu inline trong Firestore; adapter Emulator/Storage vẫn giữ luồng upload Storage riêng. SCAN mở camera hệ thống hoặc bộ chọn ảnh; lịch sử chỉ lấy ảnh của người dùng. Quyền download do API kiểm tra; client không gắn Firebase ID token vào URL ký GCS trong adapter Storage.

`callback` là `FirebaseBackendClient.Callback<JSONObject>`. Lưu cùng một khóa cho các lần thử lại của **cùng một** thao tác tạo đơn/thanh toán/tin nhắn. Không tạo khóa mới sau lỗi mạng khi chưa biết giao dịch đã được ghi nhận chưa. Các trang danh sách trả `items` và `next_cursor`; URL hóa giá trị tham số khi nối query.

Client tự làm mới token khi gần hết hạn và thử lại một lần nếu API trả 401. Với lỗi kết nối EOF/reset, GET JSON và tải ảnh được thử lại đúng một lần bằng socket mới nếu phiên vẫn còn hiệu lực. Không tự gửi lại POST/PATCH/PUT/DELETE vì lỗi mạng; timeout, lỗi HTTP, TLS, DNS, thiếu quyền hoặc kết nối bị từ chối cũng không kích hoạt cơ chế thử lại GET này. Không theo HTTP redirect, không ghi token vào SharedPreferences, file, log hay backup. Khi process của app kết thúc, phiên trong bộ nhớ mất và cần đăng nhập lại để dùng dữ liệu riêng tư; chế độ xem công khai offline không khôi phục phiên hoặc token.

Luồng hiện tại dùng `BackendSession.signOut()` khi đăng xuất và đóng client khi đổi môi trường. Fragment không đóng client dùng chung khi chỉ chuyển màn hình. Nếu tạo một client độc lập cho tác vụ riêng, chủ sở hữu cần gọi `close()` khi kết thúc để hủy tác vụ/callback.

Ngày 19/10/2026 đã sửa lỗi tự thoát sau đăng nhập: việc hủy request và đóng socket TLS trong `signOut()`/`close()` được chuyển sang worker dọn kết nối. Phiên và callback cũ bị vô hiệu ngay; lần đăng nhập tiếp theo dùng connection pool/dispatcher riêng, tránh việc dọn phiên cũ hủy request mới. Lỗi Auth vẫn hiển thị đúng; khi Auth thành công nhưng không tải được `/me`, app nêu lỗi backend và hướng dẫn kết nối Spark cổng 5002 khi phù hợp. Chi tiết và kiểm thử TLS thực tại [android-login-fix.md](android-login-fix.md).

## Xử lý lỗi mạng

Lượt kiểm tra tiếp theo ghi nhận EOF trước HTTP headers trong chính tiến trình app đang dùng; backend 5002 vẫn trả 200 và quyền mạng local đã được cấp. Chưa xác định thành phần nào đóng kết nối ban đầu. Đã bổ sung phục hồi GET bằng socket mới theo phạm vi trên, giữ kiểm tra phiên để đăng xuất/đổi tài khoản không khôi phục request cũ. Màn hình hiển thị thông báo lỗi cụ thể tại vùng nội dung và cho chạm để tải lại; phản hồi lỗi muộn từ tab Khám phá cũ không thay nội dung tab hiện tại.

Nếu backend dừng, app báo kiểm tra server máy tính; nếu server chậm, báo timeout. Bản debug có tag Logcat `EcoShareNetwork` để phân biệt lỗi HTTP, timeout, DNS, TLS, quyền và gián đoạn kết nối. Log chỉ chứa loại lỗi, phương thức và mẫu route; không ghi query, ID tài liệu, token, mật khẩu hoặc nội dung. Không tắt kiểm tra TLS và không tăng timeout để che lỗi. Hướng dẫn kiểm tra server/quyền và bằng chứng tại [network-fix.md](network-fix.md).

## Kiểm tra

```powershell
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
.\gradlew.bat :app:assembleDebug :app:testDebugUnitTest --no-configuration-cache
```

Đã xác nhận **17/17 JVM**, **25/25 instrumentation** trên API 37 sau bản sửa mạng. Tổng Android gồm 15 ca của bản sửa đăng nhập trước, thêm 8 ca socket/lỗi mạng và 2 ca giao diện lỗi/tải lại. Kiểm tra inline dùng API riêng cổng 5003, project demo và factory debug cố định; kiểm tra lỗi socket dùng server loopback trong thiết bị, không dùng tài khoản cloud. Lượt backend liên quan đạt **20/20**; đọc so sánh API cloud trước/sau tối ưu metadata ảnh cho JSON giống nhau, SCAN ẩn danh vẫn trả 401. Chưa dùng mật khẩu của người dùng để tự động hóa phiên đăng nhập cloud. Phạm vi, lần cài APK và kết quả cuối ghi tại [verification.md](verification.md).

Sau bổ sung SQLite offline, layout xoay ngang và chat, lượt tích hợp ngày 19/10 đạt **39/39 Android với Emulator**, **1/1 chat UI riêng**, **1/1 Android chỉ đọc cloud**, **17/17 JVM** và **130/130 backend**. Ngày 20/10 chạy lại **3/3 ca SQLite** và **1/1 ca giao diện mở nội dung offline sau khi mất phiên**, cùng `assembleDebug`, Android JVM và lint đều đạt; chi tiết tại [data-loading.md](data-loading.md) và [verification.md](verification.md).

Lượt riêng `FirebaseSparkReadOnlyTest` đạt **1/1**, không bỏ qua: Android gọi health rồi đọc tips/posts ba vòng, nghỉ 6,5 giây giữa các vòng. Ca này chỉ gọi GET công khai, không đăng nhập hoặc ghi dữ liệu cloud. Lượt kiểm tra trước từng ghi nhận hai lần EOF trước headers sau khi nhàn rỗi; cả hai đã được phục hồi và trả lại 2 TIP/3 POST.

Tài liệu chính thức: [Cấu hình Firebase cho Android](https://firebase.google.com/docs/android/setup), [Google Services plugin](https://firebase.google.com/docs/android/google-services-plugin-and-file), [Firebase Auth REST](https://firebase.google.com/docs/reference/rest/auth), [Auth Emulator](https://firebase.google.com/docs/emulator-suite/connect_auth), [Android network security configuration](https://developer.android.com/privacy-and-security/security-config).
