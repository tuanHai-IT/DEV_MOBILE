# Phân công đưa source EcoShare lên GitHub — 5 thành viên

Bản phân công dùng nhãn Thành viên 1–5 để nhóm tự gán tên/GitHub sau. Mỗi người có 8 nhiệm vụ, tổng cộng 40 nhiệm vụ. Đây là trách nhiệm rà soát và bàn giao mã hiện có lên repo.

Gốc phân chia là gói `EcoShare-github-source-2026-10-23.zip`: 515 file được giao đúng một lần. Bổ sung hai file phân công này cho Thành viên 5, thành 517 file source/tài liệu khi ghép đủ 5 gói. File trong các gói giữ nguyên byte của snapshot gốc; chỉ thêm hai tài liệu phân công.

## Tổng quan

| Thành viên | Phần phụ trách | Nhiệm vụ | Số file | Nhánh gợi ý |
|---|---|---|---:|---|
| Thành viên 1 | Nền tảng Android, xác thực, kết nối và cache | ECO-01–ECO-08 | 57 | `upload/tv1-android-core` |
| Thành viên 2 | Giao diện Android và các luồng người dùng | ECO-09–ECO-16 | 204 | `upload/tv2-android-ui` |
| Thành viên 3 | Backend nền tảng, cộng đồng, media và Firebase | ECO-17–ECO-24 | 37 | `upload/tv3-backend-community` |
| Thành viên 4 | Backend giao dịch, quản trị, dữ liệu và sơ đồ | ECO-25–ECO-32 | 74 | `upload/tv4-backend-market-admin` |
| Thành viên 5 | Admin Web, React tham chiếu và tài liệu bàn giao | ECO-33–ECO-40 | 145 | `upload/tv5-admin-web-docs` |

## Tạo các nhiệm vụ theo mẫu GitHub Projects

Mỗi dòng trong bảng dưới là một task/issue: dùng cột Tên nhiệm vụ làm Title, gán người ở cột Thành viên, đặt trạng thái ban đầu `Todo`. Tên hiện để Thành viên 1–5; người quản lý thay bằng GitHub handle thật. Khi có commit/PR và đã đối chiếu phần việc mới chuyển `Done`. CSV đi kèm là bảng dữ liệu để copy hoặc dùng với công cụ nhập của nhóm; không giả định GitHub Projects tự nhập CSV.

| Mã | Tên nhiệm vụ | Thành viên | File/phần cần up |
|---|---|---|---|
| ECO-01 | Cấu hình project Android và Gradle | Thành viên 1 | `.gitignore`; `app/.gitignore`; `app/build.gradle.kts` và 10 file khác (xem danh sách đầy đủ bên dưới) |
| ECO-02 | Host điều hướng MainActivity và ScreenFragment | Thành viên 1 | `app/src/main/java/com/example/recyclingshareapp/MainActivity.java`; `app/src/main/java/com/example/recyclingshareapp/ui/ScreenFragment.java`; `app/src/main/res/layout-land/activity_main.xml` và 1 file khác (xem danh sách đầy đủ bên dưới) |
| ECO-03 | Quản lý phiên Firebase và lưu token cục bộ | Thành viên 1 | `app/src/main/java/com/example/recyclingshareapp/data/remote/BackendSession.java`; `app/src/main/java/com/example/recyclingshareapp/data/remote/SessionVault.java` |
| ECO-04 | REST client Android và chính sách endpoint | Thành viên 1 | `app/src/main/java/com/example/recyclingshareapp/data/remote/BackendEndpointPolicy.java`; `app/src/main/java/com/example/recyclingshareapp/data/remote/FirebaseBackendClient.java` |
| ECO-05 | Cache offline và trạng thái cục bộ Android | Thành viên 1 | `app/src/main/java/com/example/recyclingshareapp/data/DemoRepository.java`; `app/src/main/java/com/example/recyclingshareapp/data/TradeRules.java`; `app/src/main/java/com/example/recyclingshareapp/data/remote/OfflineSnapshotStore.java` |
| ECO-06 | Manifest, cấu hình Firebase client và bản debug | Thành viên 1 | `app/google-services.json`; `app/src/debug/AndroidManifest.xml`; `app/src/debug/res/xml/network_security_config_debug.xml` và 4 file khác (xem danh sách đầy đủ bên dưới) |
| ECO-07 | Layout xác thực, cài đặt và theme chung | Thành viên 1 | `app/src/main/res/layout-land/fragment_login.xml`; `app/src/main/res/layout/fragment_forgot_password.xml`; `app/src/main/res/layout/fragment_login.xml` và 10 file khác (xem danh sách đầy đủ bên dưới) |
| ECO-08 | Kiểm thử Android về phiên, mạng và offline | Thành viên 1 | `app/src/androidTest/java/com/example/recyclingshareapp/BackendSessionProfileTest.java`; `app/src/androidTest/java/com/example/recyclingshareapp/ExampleInstrumentedTest.java`; `app/src/androidTest/java/com/example/recyclingshareapp/FirebaseNetworkFailureTest.java` và 10 file khác (xem danh sách đầy đủ bên dưới) |
| ECO-09 | Runtime giao diện CommunityFragment | Thành viên 2 | `app/src/main/java/com/example/recyclingshareapp/ui/CommunityFragment.java` |
| ECO-10 | Xử lý ảnh tải lên và lớp phủ SCAN | Thành viên 2 | `app/src/main/java/com/example/recyclingshareapp/ui/PhotoUploadEncoder.java`; `app/src/main/java/com/example/recyclingshareapp/ui/ScanOverlayView.java` |
| ECO-11 | Layout cộng đồng, khám phá và tin nhắn | Thành viên 2 | `app/src/main/res/layout/fragment_chat.xml`; `app/src/main/res/layout/fragment_create_menu.xml`; `app/src/main/res/layout/fragment_create_post.xml` và 9 file khác (xem danh sách đầy đủ bên dưới) |
| ECO-12 | Layout hồ sơ và địa chỉ người dùng | Thành viên 2 | `app/src/main/res/layout/fragment_addresses.xml`; `app/src/main/res/layout/fragment_edit_profile.xml`; `app/src/main/res/layout/fragment_help_center.xml` và 3 file khác (xem danh sách đầy đủ bên dưới) |
| ECO-13 | Layout chợ đồ cũ, đơn hàng và thanh toán | Thành viên 2 | `app/src/main/res/layout/fragment_checkout.xml`; `app/src/main/res/layout/fragment_create_listing.xml`; `app/src/main/res/layout/fragment_market.xml` và 6 file khác (xem danh sách đầy đủ bên dưới) |
| ECO-14 | Tài nguyên ảnh, icon và hiệu ứng Android | Thành viên 2 | `app/src/main/res/anim/screen_enter.xml`; `app/src/main/res/anim/screen_exit.xml`; `app/src/main/res/anim/screen_pop_enter.xml` và 140 file khác (xem danh sách đầy đủ bên dưới) |
| ECO-15 | Layout SCAN, admin mobile và XML bổ trợ | Thành viên 2 | `app/src/main/res/layout/fragment_admin_dashboard.xml`; `app/src/main/res/layout/fragment_admin_moderation.xml`; `app/src/main/res/layout/fragment_admin_reports.xml` và 17 file khác (xem danh sách đầy đủ bên dưới) |
| ECO-16 | Kiểm thử UI Android và các luồng người dùng | Thành viên 2 | `app/src/androidTest/java/com/example/recyclingshareapp/CommunityNetworkUiTest.java`; `app/src/androidTest/java/com/example/recyclingshareapp/CommunityPagingUiTest.java`; `app/src/androidTest/java/com/example/recyclingshareapp/CommunityProfileUiTest.java` và 8 file khác (xem danh sách đầy đủ bên dưới) |
| ECO-17 | Khởi tạo backend Node/TypeScript và routing API | Thành viên 3 | `backend/.env.demo-recycling-share`; `backend/.env.example`; `backend/README.md` và 6 file khác (xem danh sách đầy đủ bên dưới) |
| ECO-18 | Middleware xác thực và tiện ích backend | Thành viên 3 | `backend/src/core.ts` |
| ECO-19 | API nội dung, tương tác và mạng xã hội | Thành viên 3 | `backend/src/social.ts` |
| ECO-20 | API hồ sơ, xác minh và hội thoại | Thành viên 3 | `backend/src/community.ts` |
| ECO-21 | API media và kiểm tra quyền tệp | Thành viên 3 | `backend/src/media.ts` |
| ECO-22 | Cấu hình Firebase, Firestore rules và indexes | Thành viên 3 | `firebase.json`; `firestore.indexes.json`; `firestore.rules` và 1 file khác (xem danh sách đầy đủ bên dưới) |
| ECO-23 | Script cloud, Emulator và dữ liệu khởi tạo | Thành viên 3 | `backend/fixtures/README.md`; `backend/fixtures/reuse-corks.jpg`; `backend/fixtures/reuse-glass.jpg` và 9 file khác (xem danh sách đầy đủ bên dưới) |
| ECO-24 | Kiểm thử backend nền tảng, cộng đồng và media | Thành viên 3 | `backend/test/api.test.ts`; `backend/test/authentication-performance.test.ts`; `backend/test/community.test.ts` và 5 file khác (xem danh sách đầy đủ bên dưới) |
| ECO-25 | API tin bán, tồn kho và đơn hàng | Thành viên 4 | `backend/src/marketplace.ts` |
| ECO-26 | Module thanh toán và đối soát backend | Thành viên 4 | `backend/src/payments.ts` |
| ECO-27 | API quản trị và kiểm duyệt nội dung | Thành viên 4 | `backend/src/admin.ts`; `backend/src/social-admin.ts` |
| ECO-28 | DTO Java, schema và từ điển dữ liệu | Thành viên 4 | `app/src/main/java/com/example/recyclingshareapp/model/Address.java`; `app/src/main/java/com/example/recyclingshareapp/model/AuditLog.java`; `app/src/main/java/com/example/recyclingshareapp/model/Category.java` và 19 file khác (xem danh sách đầy đủ bên dưới) |
| ECO-29 | Kiểm thử backend giao dịch và quản trị | Thành viên 4 | `backend/test/admin.test.ts`; `backend/test/payments.test.ts`; `backend/test/social-admin.test.ts` |
| ECO-30 | Công cụ sinh và kiểm tra thiết kế | Thành viên 4 | `tools/configure_native.py`; `tools/export_diagram_png.py`; `tools/generate_android.py` và 5 file khác (xem danh sách đầy đủ bên dưới) |
| ECO-31 | Bộ Class, ERD và Function Diagram hiện hành | Thành viên 4 | `Recycling Share App/diagrams-current/README.md`; `Recycling Share App/diagrams-current/class-diagram.drawio`; `Recycling Share App/diagrams-current/class-diagram.mmd` và 15 file khác (xem danh sách đầy đủ bên dưới) |
| ECO-32 | Sơ đồ v2 và bản thiết kế lưu trữ | Thành viên 4 | `Recycling Share App/ERD App.drawio.png`; `Recycling Share App/ERD.drawio`; `Recycling Share App/diagrams-v2/README.md` và 16 file khác (xem danh sách đầy đủ bên dưới) |
| ECO-33 | Khung HTML và các trang Admin Web | Thành viên 5 | `admin-web/backend.html`; `admin-web/index.html`; `admin-web/payment-return.html` |
| ECO-34 | CSS và font của Admin Web | Thành viên 5 | `admin-web/backend.css`; `admin-web/fonts/BeVietnamPro-Bold.ttf`; `admin-web/fonts/BeVietnamPro-Medium.ttf` và 7 file khác (xem danh sách đầy đủ bên dưới) |
| ECO-35 | Module giao diện và thao tác quản trị web | Thành viên 5 | `admin-web/backend.js` |
| ECO-36 | Kết nối Firebase Web và thiết lập mật khẩu | Thành viên 5 | `admin-web/firebase-client.js`; `admin-web/firebase-config-loader.js`; `admin-web/firebase-config.example.js` và 3 file khác (xem danh sách đầy đủ bên dưới) |
| ECO-37 | Kiểm thử web, browser và cấu hình client | Thành viên 5 | `admin-web/tests/delete-content.html`; `admin-web/tests/firebase-smoke.html`; `admin-web/tests/live-updates.html` và 8 file khác (xem danh sách đầy đủ bên dưới) |
| ECO-38 | Source React/Figma tham chiếu và cấu hình | Thành viên 5 | `Recycling Share App/.figma/make/analyze-routes`; `Recycling Share App/.figma/make/deploy`; `Recycling Share App/.figma/make/deploy-preview` và 62 file khác (xem danh sách đầy đủ bên dưới) |
| ECO-39 | README và hướng dẫn bàn giao cho team | Thành viên 5 | `HUONG_DAN_TEAM.md`; `README.md`; `admin-web/README.md` |
| ECO-40 | Tài liệu kỹ thuật, ảnh minh họa và bảng phân công | Thành viên 5 | `docs/admin-web-ui-review.md`; `docs/android-firebase.md`; `docs/android-login-fix.md` và 43 file khác (xem danh sách đầy đủ bên dưới) |

## Cách đưa source lên repo

1. Chọn nhãn Thành viên 1–5 cho từng người, rồi phát đúng ZIP của người đó. Mọi người dùng cùng snapshot đã chia; không lấy lẫn file từ những bản ZIP cũ.
2. Trưởng nhóm tạo/chuẩn bị repo và nhánh `main`. Nếu repo đã có source, tạo bản clone/nhánh mới và đối chiếu thay đổi trước khi merge; gói bàn giao không tự xóa file cũ.
3. Ưu tiên đưa nhiệm vụ ECO-01 lên trước để repo có `.gitignore`. Mỗi người tạo nhánh gợi ý của mình từ cùng repo, giải nén gói vào thư mục tạm rồi chép NỘI DUNG của `RecyclingShareApp/` vào gốc bản clone, giữ nguyên `.git` của bản clone.
4. Với từng nhiệm vụ, stage đúng các file được liệt kê trong hướng dẫn/task-files.json của gói, dùng mã task trong commit, ví dụ `ECO-03: Quản lý phiên Firebase và lưu token cục bộ`. Một file chỉ thuộc một task và một thành viên.
5. Push nhánh của mình và mở PR, gắn các task liên quan theo cách nhóm đang dùng. Không upload file ZIP thay cho source. Ghép đủ cả 5 phần để có toàn bộ dự án; từng gói là phần nguồn phụ trách và có thể phụ thuộc file của người khác.
6. Sau khi tích hợp đủ source, chạy kiểm tra thiết kế, build Android/backend và các test cần môi trường tương ứng. Không đánh dấu kiểm thử thành công chỉ từ việc upload file.

Lệnh tham khảo khi đang ở gốc bản clone:

```powershell
git switch -c upload/tv1-android-core
# Chép đúng các file của gói Thành viên 1 vào đây.
# Stage các đường dẫn thuộc đúng task qua Git/IDE; đối chiếu trước khi commit.
git diff --cached --name-only
git commit -m "ECO-01: Cấu hình project Android và Gradle"
git push -u origin upload/tv1-android-core
```

## Những file cần một đầu mối

- `MainActivity.java`, `ScreenFragment.java` và `data/remote/*`: Thành viên 1.
- `CommunityFragment.java`: Thành viên 2. File này có nhiều luồng tính năng nên được giao trọn một người để upload nhất quán.
- `backend/src/core.ts`, `app.ts`, `community.ts`, `social.ts`, `media.ts`: Thành viên 3.
- `marketplace.ts`, `payments.ts`, `admin.ts`, `social-admin.ts`, DTO/schema và sơ đồ: Thành viên 4.
- `admin-web/backend.js`, client/config web và tài liệu chung: Thành viên 5.

Firebase client config được giao cho Thành viên 1; token CLI, service account, mật khẩu, .env thật, build/cache và file máy cá nhân không có trong gói. Mỗi người chạy backend cloud bằng tài khoản Google riêng đã được cấp quyền project. Quyền đó khác với vai trò Admin trong ứng dụng EcoShare.

## Danh sách file chính xác theo nhiệm vụ

### Thành viên 1 — Nền tảng Android, xác thực, kết nối và cache

#### ECO-01: Cấu hình project Android và Gradle

Build scripts, dependency catalogue và Gradle wrapper; giữ .gitignore từ gói bàn giao.

File cần up:

```text
.gitignore
app/.gitignore
app/build.gradle.kts
app/src/main/keepRules/rules.keep
build.gradle.kts
gradle.properties
gradle/gradle-daemon-jvm.properties
gradle/libs.versions.toml
gradle/wrapper/gradle-wrapper.jar
gradle/wrapper/gradle-wrapper.properties
gradlew
gradlew.bat
settings.gradle.kts
```

Đối chiếu/nghiệm thu: Sau khi ghép đủ source: Gradle Sync và :app:assembleDebug.

#### ECO-02: Host điều hướng MainActivity và ScreenFragment

Đưa trọn file điều hướng, đăng nhập và host native lên cùng một đầu mối.

File cần up:

```text
app/src/main/java/com/example/recyclingshareapp/MainActivity.java
app/src/main/java/com/example/recyclingshareapp/ui/ScreenFragment.java
app/src/main/res/layout-land/activity_main.xml
app/src/main/res/layout/activity_main.xml
```

Đối chiếu/nghiệm thu: Kiểm tra mở app, chuyển tab, quay lại và chuyển màn xác thực sau tích hợp.

#### ECO-03: Quản lý phiên Firebase và lưu token cục bộ

Khôi phục phiên, hồ sơ, chế độ backend và kho phiên trên Android.

File cần up:

```text
app/src/main/java/com/example/recyclingshareapp/data/remote/BackendSession.java
app/src/main/java/com/example/recyclingshareapp/data/remote/SessionVault.java
```

Đối chiếu/nghiệm thu: Đối chiếu BackendSessionModeTest và các ca phiên/auth đã có.

#### ECO-04: REST client Android và chính sách endpoint

Client API, upload/download, retry và giới hạn endpoint. File REST client được giao trọn cho TV1.

File cần up:

```text
app/src/main/java/com/example/recyclingshareapp/data/remote/BackendEndpointPolicy.java
app/src/main/java/com/example/recyclingshareapp/data/remote/FirebaseBackendClient.java
```

Đối chiếu/nghiệm thu: BackendEndpointPolicyTest; kiểm tra request tới backend đúng môi trường.

#### ECO-05: Cache offline và trạng thái cục bộ Android

SQLite cache công khai, trạng thái cục bộ và quy tắc của luồng native có sẵn.

File cần up:

```text
app/src/main/java/com/example/recyclingshareapp/data/DemoRepository.java
app/src/main/java/com/example/recyclingshareapp/data/TradeRules.java
app/src/main/java/com/example/recyclingshareapp/data/remote/OfflineSnapshotStore.java
```

Đối chiếu/nghiệm thu: TradeRulesTest, OfflineSnapshotTest và OfflineGuestUiTest khi đủ môi trường.

#### ECO-06: Manifest, cấu hình Firebase client và bản debug

Quyền Android, FileProvider, sao lưu, cấu hình mạng debug và public Firebase client config.

File cần up:

```text
app/google-services.json
app/src/debug/AndroidManifest.xml
app/src/debug/res/xml/network_security_config_debug.xml
app/src/main/AndroidManifest.xml
app/src/main/res/xml/backup_rules.xml
app/src/main/res/xml/community_file_paths.xml
app/src/main/res/xml/data_extraction_rules.xml
```

Đối chiếu/nghiệm thu: Đối chiếu package, manifest merge và chính sách mạng bản debug.

#### ECO-07: Layout xác thực, cài đặt và theme chung

XML đăng nhập/đăng ký/khôi phục, cài đặt và resources chuỗi/màu/style/theme dùng chung.

File cần up:

```text
app/src/main/res/layout-land/fragment_login.xml
app/src/main/res/layout/fragment_forgot_password.xml
app/src/main/res/layout/fragment_login.xml
app/src/main/res/layout/fragment_onboarding.xml
app/src/main/res/layout/fragment_privacy_settings.xml
app/src/main/res/layout/fragment_register.xml
app/src/main/res/layout/fragment_settings.xml
app/src/main/res/values-night/themes.xml
app/src/main/res/values/colors.xml
app/src/main/res/values/community.xml
app/src/main/res/values/strings.xml
app/src/main/res/values/styles.xml
app/src/main/res/values/themes.xml
```

Đối chiếu/nghiệm thu: Đối chiếu login/register, màn hình ngang và các resource ID sau khi ghép UI.

#### ECO-08: Kiểm thử Android về phiên, mạng và offline

Unit tests và instrumentation cho xác thực, phiên, endpoint, mạng và cache; giữ rõ điều kiện Emulator/cloud read-only.

File cần up:

```text
app/src/androidTest/java/com/example/recyclingshareapp/BackendSessionProfileTest.java
app/src/androidTest/java/com/example/recyclingshareapp/ExampleInstrumentedTest.java
app/src/androidTest/java/com/example/recyclingshareapp/FirebaseNetworkFailureTest.java
app/src/androidTest/java/com/example/recyclingshareapp/FirebasePrefetchCacheTest.java
app/src/androidTest/java/com/example/recyclingshareapp/FirebaseSessionUiTest.java
app/src/androidTest/java/com/example/recyclingshareapp/FirebaseSparkReadOnlyTest.java
app/src/androidTest/java/com/example/recyclingshareapp/FirebaseTlsCleanupTest.java
app/src/androidTest/java/com/example/recyclingshareapp/data/remote/OfflineGuestUiTest.java
app/src/androidTest/java/com/example/recyclingshareapp/data/remote/OfflineSnapshotTest.java
app/src/test/java/com/example/recyclingshareapp/BackendEndpointPolicyTest.java
app/src/test/java/com/example/recyclingshareapp/ExampleUnitTest.java
app/src/test/java/com/example/recyclingshareapp/TradeRulesTest.java
app/src/test/java/com/example/recyclingshareapp/data/remote/BackendSessionModeTest.java
```

Đối chiếu/nghiệm thu: Unit test sau tích hợp; chỉ chạy instrumentation có đủ thiết bị và cấu hình opt-in tương ứng.

### Thành viên 2 — Giao diện Android và các luồng người dùng

#### ECO-09: Runtime giao diện CommunityFragment

Toàn bộ file điều khiển màn đang dùng: cộng đồng, chat, hồ sơ, chợ, đơn và mobile admin. Chỉ TV2 upload file này.

File cần up:

```text
app/src/main/java/com/example/recyclingshareapp/ui/CommunityFragment.java
```

Đối chiếu/nghiệm thu: Đối chiếu các luồng có API với bộ kiểm thử UI hiện hành sau tích hợp.

#### ECO-10: Xử lý ảnh tải lên và lớp phủ SCAN

Nén ảnh theo giới hạn Spark và vẽ lớp phủ scanner.

File cần up:

```text
app/src/main/java/com/example/recyclingshareapp/ui/PhotoUploadEncoder.java
app/src/main/java/com/example/recyclingshareapp/ui/ScanOverlayView.java
```

Đối chiếu/nghiệm thu: PhotoUploadEncoderTest và kiểm tra SCAN ở kích thước màn khác nhau.

#### ECO-11: Layout cộng đồng, khám phá và tin nhắn

XML feed, bài/mẹo, tìm kiếm, bạn bè, thông báo, chat và báo cáo.

File cần up:

```text
app/src/main/res/layout/fragment_chat.xml
app/src/main/res/layout/fragment_create_menu.xml
app/src/main/res/layout/fragment_create_post.xml
app/src/main/res/layout/fragment_explore.xml
app/src/main/res/layout/fragment_friends.xml
app/src/main/res/layout/fragment_hashtag.xml
app/src/main/res/layout/fragment_home.xml
app/src/main/res/layout/fragment_messages.xml
app/src/main/res/layout/fragment_notifications.xml
app/src/main/res/layout/fragment_post_detail.xml
app/src/main/res/layout/fragment_report.xml
app/src/main/res/layout/fragment_search.xml
```

Đối chiếu/nghiệm thu: Đối chiếu điều hướng, thanh menu dưới, tìm kiếm và khung nhập chat.

#### ECO-12: Layout hồ sơ và địa chỉ người dùng

XML hồ sơ, chỉnh sửa, địa chỉ, xác minh và thông tin hỗ trợ/điều khoản.

File cần up:

```text
app/src/main/res/layout/fragment_addresses.xml
app/src/main/res/layout/fragment_edit_profile.xml
app/src/main/res/layout/fragment_help_center.xml
app/src/main/res/layout/fragment_profile.xml
app/src/main/res/layout/fragment_terms_policy.xml
app/src/main/res/layout/fragment_verification.xml
```

Đối chiếu/nghiệm thu: Đối chiếu nút quay lại, chỉnh ảnh và các resource mà runtime sử dụng.

#### ECO-13: Layout chợ đồ cũ, đơn hàng và thanh toán

XML danh sách/chi tiết tin bán, đơn hàng và phần XML thanh toán có sẵn; thanh toán Android vẫn là demo.

File cần up:

```text
app/src/main/res/layout/fragment_checkout.xml
app/src/main/res/layout/fragment_create_listing.xml
app/src/main/res/layout/fragment_market.xml
app/src/main/res/layout/fragment_market_detail.xml
app/src/main/res/layout/fragment_my_listings.xml
app/src/main/res/layout/fragment_order_detail.xml
app/src/main/res/layout/fragment_orders.xml
app/src/main/res/layout/fragment_payment.xml
app/src/main/res/layout/fragment_payment_result.xml
```

Đối chiếu/nghiệm thu: Kiểm tra luồng mua/đơn hàng, giữ rõ trạng thái thanh toán mô phỏng.

#### ECO-14: Tài nguyên ảnh, icon và hiệu ứng Android

Toàn bộ drawable, ảnh, launcher icon, animation và màu trạng thái.

File cần up:

```text
app/src/main/res/anim/screen_enter.xml
app/src/main/res/anim/screen_exit.xml
app/src/main/res/anim/screen_pop_enter.xml
app/src/main/res/anim/screen_pop_exit.xml
app/src/main/res/color/nav_item_bg_tint.xml
app/src/main/res/color/nav_item_tint.xml
app/src/main/res/drawable-nodpi/logo_momo.png
app/src/main/res/drawable-nodpi/logo_vnpay.png
app/src/main/res/drawable/bg_address_default_badge.xml
app/src/main/res/drawable/bg_admin_hero.xml
app/src/main/res/drawable/bg_admin_icon.xml
app/src/main/res/drawable/bg_avatar_squircle.xml
app/src/main/res/drawable/bg_badge_pending.xml
app/src/main/res/drawable/bg_badge_rejected.xml
app/src/main/res/drawable/bg_badge_unread.xml
app/src/main/res/drawable/bg_badge_verified.xml
app/src/main/res/drawable/bg_bubble_incoming.xml
app/src/main/res/drawable/bg_bubble_outgoing.xml
app/src/main/res/drawable/bg_card.xml
app/src/main/res/drawable/bg_card_mint.xml
app/src/main/res/drawable/bg_challenge_status.xml
app/src/main/res/drawable/bg_chat_action.xml
app/src/main/res/drawable/bg_chat_avatar.xml
app/src/main/res/drawable/bg_chat_chip.xml
app/src/main/res/drawable/bg_chat_input.xml
app/src/main/res/drawable/bg_chat_photo.xml
app/src/main/res/drawable/bg_circle_avatar.xml
app/src/main/res/drawable/bg_comment_send.xml
app/src/main/res/drawable/bg_cover_garden.xml
app/src/main/res/drawable/bg_cover_profile.xml
app/src/main/res/drawable/bg_eco_card.xml
app/src/main/res/drawable/bg_eco_fullscreen_gradient.xml
app/src/main/res/drawable/bg_eco_points_banner.xml
app/src/main/res/drawable/bg_eco_progress_fill.xml
app/src/main/res/drawable/bg_eco_progress_track.xml
app/src/main/res/drawable/bg_explore_search.xml
app/src/main/res/drawable/bg_explore_tab_selected.xml
app/src/main/res/drawable/bg_explore_tabs.xml
app/src/main/res/drawable/bg_friends_accept.xml
app/src/main/res/drawable/bg_friends_decline.xml
app/src/main/res/drawable/bg_friends_search.xml
app/src/main/res/drawable/bg_frosted_circle.xml
app/src/main/res/drawable/bg_frosted_pill.xml
app/src/main/res/drawable/bg_hero.xml
app/src/main/res/drawable/bg_market_category_badge.xml
app/src/main/res/drawable/bg_market_new_badge.xml
app/src/main/res/drawable/bg_market_price_badge.xml
app/src/main/res/drawable/bg_market_product_card.xml
app/src/main/res/drawable/bg_message_search.xml
app/src/main/res/drawable/bg_mint.xml
app/src/main/res/drawable/bg_nav_create.xml
app/src/main/res/drawable/bg_nav_dot.xml
app/src/main/res/drawable/bg_nav_item_selected.xml
app/src/main/res/drawable/bg_notification_count.xml
app/src/main/res/drawable/bg_notification_dot.xml
app/src/main/res/drawable/bg_notification_type.xml
app/src/main/res/drawable/bg_online_dot.xml
app/src/main/res/drawable/bg_order_cancel.xml
app/src/main/res/drawable/bg_order_payment.xml
app/src/main/res/drawable/bg_photo_grid.xml
app/src/main/res/drawable/bg_primary_button.xml
app/src/main/res/drawable/bg_profile_action_outline.xml
app/src/main/res/drawable/bg_profile_eco_level.xml
app/src/main/res/drawable/bg_profile_stat.xml
app/src/main/res/drawable/bg_scan_capture.xml
app/src/main/res/drawable/bg_scan_side.xml
app/src/main/res/drawable/bg_search_input.xml
app/src/main/res/drawable/bg_secondary_button.xml
app/src/main/res/drawable/bg_star_badge.xml
app/src/main/res/drawable/bg_story_ring.xml
app/src/main/res/drawable/bg_tab_active.xml
app/src/main/res/drawable/bg_tab_inactive.xml
app/src/main/res/drawable/community_card.xml
app/src/main/res/drawable/community_chip.xml
app/src/main/res/drawable/community_dark.xml
app/src/main/res/drawable/community_pill.xml
app/src/main/res/drawable/ic_apple.xml
app/src/main/res/drawable/ic_arrow_back.xml
app/src/main/res/drawable/ic_avatar_anh.xml
app/src/main/res/drawable/ic_avatar_hoa.xml
app/src/main/res/drawable/ic_avatar_hung.xml
app/src/main/res/drawable/ic_avatar_lan.xml
app/src/main/res/drawable/ic_avatar_minh.xml
app/src/main/res/drawable/ic_award.xml
app/src/main/res/drawable/ic_bell.xml
app/src/main/res/drawable/ic_bookmark.xml
app/src/main/res/drawable/ic_camera.xml
app/src/main/res/drawable/ic_chevron_right.xml
app/src/main/res/drawable/ic_clip.xml
app/src/main/res/drawable/ic_close_danger.xml
app/src/main/res/drawable/ic_comment.xml
app/src/main/res/drawable/ic_community_bookmark_filled.xml
app/src/main/res/drawable/ic_compose.xml
app/src/main/res/drawable/ic_eco_leaf.xml
app/src/main/res/drawable/ic_eco_points_sprout.xml
app/src/main/res/drawable/ic_edit.xml
app/src/main/res/drawable/ic_friends.xml
app/src/main/res/drawable/ic_google.xml
app/src/main/res/drawable/ic_heart.xml
app/src/main/res/drawable/ic_launcher_background.xml
app/src/main/res/drawable/ic_launcher_foreground.xml
app/src/main/res/drawable/ic_launcher_monochrome.xml
app/src/main/res/drawable/ic_like_outline.xml
app/src/main/res/drawable/ic_map_pin.xml
app/src/main/res/drawable/ic_more_vert.xml
app/src/main/res/drawable/ic_nav_explore.xml
app/src/main/res/drawable/ic_nav_home.xml
app/src/main/res/drawable/ic_nav_market.xml
app/src/main/res/drawable/ic_nav_messages.xml
app/src/main/res/drawable/ic_nav_profile.xml
app/src/main/res/drawable/ic_phone.xml
app/src/main/res/drawable/ic_plus.xml
app/src/main/res/drawable/ic_qr_scan.xml
app/src/main/res/drawable/ic_search.xml
app/src/main/res/drawable/ic_send.xml
app/src/main/res/drawable/ic_settings.xml
app/src/main/res/drawable/ic_share.xml
app/src/main/res/drawable/ic_shield.xml
app/src/main/res/drawable/ic_star.xml
app/src/main/res/drawable/ic_truck.xml
app/src/main/res/drawable/ic_verified.xml
app/src/main/res/drawable/ic_wallet.xml
app/src/main/res/drawable/ic_wallet_white.xml
app/src/main/res/drawable/illustration_hanging_garden.xml
app/src/main/res/drawable/illustration_lamp.xml
app/src/main/res/drawable/illustration_tire_swing.xml
app/src/main/res/drawable/img_avatar_lan.png
app/src/main/res/drawable/img_corks.jpg
app/src/main/res/drawable/img_cover_plants.jpg
app/src/main/res/drawable/img_glass.jpg
app/src/main/res/drawable/photo_cork_wind_chime.xml
app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml
app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml
app/src/main/res/mipmap-hdpi/ic_launcher.png
app/src/main/res/mipmap-hdpi/ic_launcher_round.png
app/src/main/res/mipmap-mdpi/ic_launcher.png
app/src/main/res/mipmap-mdpi/ic_launcher_round.png
app/src/main/res/mipmap-xhdpi/ic_launcher.png
app/src/main/res/mipmap-xhdpi/ic_launcher_round.png
app/src/main/res/mipmap-xxhdpi/ic_launcher.png
app/src/main/res/mipmap-xxhdpi/ic_launcher_round.png
app/src/main/res/mipmap-xxxhdpi/ic_launcher.png
app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.png
```

Đối chiếu/nghiệm thu: Đối chiếu đủ asset, tránh đổi tên resource khi upload.

#### ECO-15: Layout SCAN, admin mobile và XML bổ trợ

Giữ đủ XML scanner/admin và các màn kế thừa trong source để kiểm tra resource; không coi mọi XML là tính năng đang vận hành.

File cần up:

```text
app/src/main/res/layout/fragment_admin_dashboard.xml
app/src/main/res/layout/fragment_admin_moderation.xml
app/src/main/res/layout/fragment_admin_reports.xml
app/src/main/res/layout/fragment_badges.xml
app/src/main/res/layout/fragment_challenge_detail.xml
app/src/main/res/layout/fragment_dispute.xml
app/src/main/res/layout/fragment_events.xml
app/src/main/res/layout/fragment_group_detail.xml
app/src/main/res/layout/fragment_groups.xml
app/src/main/res/layout/fragment_guide_detail.xml
app/src/main/res/layout/fragment_image_viewer.xml
app/src/main/res/layout/fragment_leaderboard.xml
app/src/main/res/layout/fragment_material_guide.xml
app/src/main/res/layout/fragment_my_impact.xml
app/src/main/res/layout/fragment_otp.xml
app/src/main/res/layout/fragment_recycling_map.xml
app/src/main/res/layout/fragment_recycling_point_detail.xml
app/src/main/res/layout/fragment_review.xml
app/src/main/res/layout/fragment_reward_shop.xml
app/src/main/res/layout/fragment_scanner.xml
```

Đối chiếu/nghiệm thu: Inflate/XML validation; không thêm các tính năng mẫu vào sơ đồ chức năng hiện hành.

#### ECO-16: Kiểm thử UI Android và các luồng người dùng

Test feed, phân trang, profile, chat, ảnh, mua hàng, responsive và hỗ trợ test UI.

File cần up:

```text
app/src/androidTest/java/com/example/recyclingshareapp/CommunityNetworkUiTest.java
app/src/androidTest/java/com/example/recyclingshareapp/CommunityPagingUiTest.java
app/src/androidTest/java/com/example/recyclingshareapp/CommunityProfileUiTest.java
app/src/androidTest/java/com/example/recyclingshareapp/CommunityTestSupport.java
app/src/androidTest/java/com/example/recyclingshareapp/ConversationUiTest.java
app/src/androidTest/java/com/example/recyclingshareapp/FirebaseInlineMediaTest.java
app/src/androidTest/java/com/example/recyclingshareapp/FrontendRegressionTest.java
app/src/androidTest/java/com/example/recyclingshareapp/NativeLayoutsTest.java
app/src/androidTest/java/com/example/recyclingshareapp/PhotoUploadEncoderTest.java
app/src/androidTest/java/com/example/recyclingshareapp/PurchaseFlowTest.java
app/src/androidTest/java/com/example/recyclingshareapp/ResponsiveLayoutsTest.java
```

Đối chiếu/nghiệm thu: Chạy trên Android Emulator với backend test theo điều kiện ghi trong từng ca.

### Thành viên 3 — Backend nền tảng, cộng đồng, media và Firebase

#### ECO-17: Khởi tạo backend Node/TypeScript và routing API

Dependency/lockfile, entry point, router và template môi trường; không đưa .env thật lên.

File cần up:

```text
backend/.env.demo-recycling-share
backend/.env.example
backend/README.md
backend/package-lock.json
backend/package.json
backend/src/app.ts
backend/src/index.ts
backend/src/local.ts
backend/tsconfig.json
```

Đối chiếu/nghiệm thu: npm --prefix backend ci; npm --prefix backend run build sau khi ghép các module.

#### ECO-18: Middleware xác thực và tiện ích backend

Token, phân quyền, chuẩn hóa dữ liệu và lớp hỗ trợ dùng chung.

File cần up:

```text
backend/src/core.ts
```

Đối chiếu/nghiệm thu: Đối chiếu các ca auth/permission trong bộ test backend.

#### ECO-19: API nội dung, tương tác và mạng xã hội

Bài/mẹo/story, bình luận, phản ứng, bạn bè và thông báo theo source hiện có.

File cần up:

```text
backend/src/social.ts
```

Đối chiếu/nghiệm thu: social.test.ts, social-app.test.ts và kiểm tra API liên quan.

#### ECO-20: API hồ sơ, xác minh và hội thoại

Các route cộng đồng, hồ sơ/địa chỉ/xác minh và tin nhắn theo module.

File cần up:

```text
backend/src/community.ts
```

Đối chiếu/nghiệm thu: community.test.ts và các ca hội thoại/địa chỉ/quyền.

#### ECO-21: API media và kiểm tra quyền tệp

Upload/download ảnh, dữ liệu inline Firestore và quyền truy cập media.

File cần up:

```text
backend/src/media.ts
```

Đối chiếu/nghiệm thu: media.test.ts và inline-media.test.ts.

#### ECO-22: Cấu hình Firebase, Firestore rules và indexes

Cấu hình dịch vụ, Emulator, Hosting và quy tắc/index dữ liệu.

File cần up:

```text
firebase.json
firestore.indexes.json
firestore.rules
storage.rules
```

Đối chiếu/nghiệm thu: Đối chiếu rules.test.ts trên Emulator; upload source không đồng nghĩa deploy.

#### ECO-23: Script cloud, Emulator và dữ liệu khởi tạo

Script chạy backend, bootstrap, seed và ảnh fixture; chỉ đưa source script, không tự chạy seed cloud khi upload.

File cần up:

```text
backend/fixtures/README.md
backend/fixtures/reuse-corks.jpg
backend/fixtures/reuse-glass.jpg
backend/fixtures/reuse-plants.jpg
backend/scripts/bootstrap-admin.ts
backend/scripts/bootstrap-cloud-admin.mjs
backend/scripts/cloud-context.mjs
backend/scripts/dev-cloud.mjs
backend/scripts/emulators.mjs
backend/scripts/seed-cloud.mjs
backend/scripts/seed-emulator.ts
backend/scripts/seed-social.ts
```

Đối chiếu/nghiệm thu: Đối chiếu đường dẫn fixtures, project guard và tài khoản CLI riêng của từng thành viên.

#### ECO-24: Kiểm thử backend nền tảng, cộng đồng và media

Các test API, auth/performance, community, social, media và rules.

File cần up:

```text
backend/test/api.test.ts
backend/test/authentication-performance.test.ts
backend/test/community.test.ts
backend/test/inline-media.test.ts
backend/test/media.test.ts
backend/test/rules.test.ts
backend/test/social-app.test.ts
backend/test/social.test.ts
```

Đối chiếu/nghiệm thu: Chạy suite trên project Emulator riêng theo README; giữ test opt-in đúng môi trường.

### Thành viên 4 — Backend giao dịch, quản trị, dữ liệu và sơ đồ

#### ECO-25: API tin bán, tồn kho và đơn hàng

Tin bán, sản phẩm, tạo/xử lý đơn và giữ/hoàn tồn kho theo transaction.

File cần up:

```text
backend/src/marketplace.ts
```

Đối chiếu/nghiệm thu: Đối chiếu bộ API integration và các tình huống trạng thái đơn.

#### ECO-26: Module thanh toán và đối soát backend

Adapter thanh toán, callback/đối soát/hoàn tiền hiện có; không gắn merchant secrets hoặc đổi demo Android thành trả tiền thật.

File cần up:

```text
backend/src/payments.ts
```

Đối chiếu/nghiệm thu: payments.test.ts trên Emulator; không tuyên bố đã nghiệm thu merchant sandbox.

#### ECO-27: API quản trị và kiểm duyệt nội dung

Quản trị người dùng, xác minh, nội dung/tin bán, báo cáo và nhật ký.

File cần up:

```text
backend/src/admin.ts
backend/src/social-admin.ts
```

Đối chiếu/nghiệm thu: admin.test.ts và social-admin.test.ts; kiểm tra quyền từng vai trò.

#### ECO-28: DTO Java, schema và từ điển dữ liệu

20 DTO/backend model cùng SQL tham chiếu và domain JSON; sơ đồ app hiện vẽ phạm vi 18 thực thể.

File cần up:

```text
app/src/main/java/com/example/recyclingshareapp/model/Address.java
app/src/main/java/com/example/recyclingshareapp/model/AuditLog.java
app/src/main/java/com/example/recyclingshareapp/model/Category.java
app/src/main/java/com/example/recyclingshareapp/model/CollectionPoint.java
app/src/main/java/com/example/recyclingshareapp/model/ContentEntry.java
app/src/main/java/com/example/recyclingshareapp/model/Conversation.java
app/src/main/java/com/example/recyclingshareapp/model/GreenLedger.java
app/src/main/java/com/example/recyclingshareapp/model/Interaction.java
app/src/main/java/com/example/recyclingshareapp/model/Listing.java
app/src/main/java/com/example/recyclingshareapp/model/ListingItem.java
app/src/main/java/com/example/recyclingshareapp/model/MediaAsset.java
app/src/main/java/com/example/recyclingshareapp/model/Message.java
app/src/main/java/com/example/recyclingshareapp/model/Order.java
app/src/main/java/com/example/recyclingshareapp/model/OrderItem.java
app/src/main/java/com/example/recyclingshareapp/model/Payment.java
app/src/main/java/com/example/recyclingshareapp/model/Report.java
app/src/main/java/com/example/recyclingshareapp/model/Review.java
app/src/main/java/com/example/recyclingshareapp/model/SystemSetting.java
app/src/main/java/com/example/recyclingshareapp/model/User.java
app/src/main/java/com/example/recyclingshareapp/model/Verification.java
database/schema.sql
docs/domain-model.json
```

Đối chiếu/nghiệm thu: python tools/validate_design.py sau khi ghép đủ hai bộ sơ đồ và tài nguyên.

#### ECO-29: Kiểm thử backend giao dịch và quản trị

Test quản trị, thanh toán và kiểm duyệt; test API dùng chung do TV3 phụ trách.

File cần up:

```text
backend/test/admin.test.ts
backend/test/payments.test.ts
backend/test/social-admin.test.ts
```

Đối chiếu/nghiệm thu: Chạy test trên Emulator sau khi ghép backend TV3/TV4.

#### ECO-30: Công cụ sinh và kiểm tra thiết kế

Công cụ model/layout/diagram và validation đã có; giữ nguyên guard bảo vệ source.

File cần up:

```text
tools/configure_native.py
tools/export_diagram_png.py
tools/generate_android.py
tools/generate_current_diagrams.py
tools/generate_design.py
tools/native_refinements.py
tools/update_social_diagrams.py
tools/validate_design.py
```

Đối chiếu/nghiệm thu: Chạy validator; không chạy generator cũ ghi đè layout chỉ để upload.

#### ECO-31: Bộ Class, ERD và Function Diagram hiện hành

MMD, draw.io, SVG, PNG, README và ZIP của bộ sơ đồ mới.

File cần up:

```text
Recycling Share App/diagrams-current/README.md
Recycling Share App/diagrams-current/class-diagram.drawio
Recycling Share App/diagrams-current/class-diagram.mmd
Recycling Share App/diagrams-current/class-diagram.png
Recycling Share App/diagrams-current/class-diagram.svg
Recycling Share App/diagrams-current/ecoshare-diagrams-current.zip
Recycling Share App/diagrams-current/erd.drawio
Recycling Share App/diagrams-current/erd.mmd
Recycling Share App/diagrams-current/erd.png
Recycling Share App/diagrams-current/erd.svg
Recycling Share App/diagrams-current/function-diagram.drawio
Recycling Share App/diagrams-current/function-diagram.mmd
Recycling Share App/diagrams-current/function-diagram.png
Recycling Share App/diagrams-current/function-diagram.svg
Recycling Share App/diagrams-current/runtime-class-diagram.drawio
Recycling Share App/diagrams-current/runtime-class-diagram.mmd
Recycling Share App/diagrams-current/runtime-class-diagram.png
Recycling Share App/diagrams-current/runtime-class-diagram.svg
```

Đối chiếu/nghiệm thu: Kiểm tra mở sơ đồ và toàn vẹn bundle; đối chiếu phạm vi tính năng app.

#### ECO-32: Sơ đồ v2 và bản thiết kế lưu trữ

Giữ sơ đồ tham chiếu và ZIP v2 vì validator/tài liệu còn đối chiếu; tách rõ bộ hiện hành.

File cần up:

```text
Recycling Share App/ERD App.drawio.png
Recycling Share App/ERD.drawio
Recycling Share App/diagrams-v2/README.md
Recycling Share App/diagrams-v2/class-diagram.drawio
Recycling Share App/diagrams-v2/class-diagram.mmd
Recycling Share App/diagrams-v2/class-diagram.png
Recycling Share App/diagrams-v2/class-diagram.svg
Recycling Share App/diagrams-v2/ecoshare-diagrams-v2.zip
Recycling Share App/diagrams-v2/erd.drawio
Recycling Share App/diagrams-v2/erd.mmd
Recycling Share App/diagrams-v2/erd.png
Recycling Share App/diagrams-v2/erd.svg
Recycling Share App/diagrams-v2/function-diagram.drawio
Recycling Share App/diagrams-v2/function-diagram.mmd
Recycling Share App/diagrams-v2/function-diagram.png
Recycling Share App/diagrams-v2/function-diagram.svg
Recycling Share App/function_diagram.drawio
Recycling Share App/function_diagram.drawio.png
Recycling Share App/so_do_class (1).drawio
```

Đối chiếu/nghiệm thu: Không bỏ bundle v2; validator cần cả v2 và current.

### Thành viên 5 — Admin Web, React tham chiếu và tài liệu bàn giao

#### ECO-33: Khung HTML và các trang Admin Web

Entry page và trang trả về thanh toán hiện có trong source web.

File cần up:

```text
admin-web/backend.html
admin-web/index.html
admin-web/payment-return.html
```

Đối chiếu/nghiệm thu: Mở đúng entry/đường dẫn sau khi cấu hình web được sinh trên máy.

#### ECO-34: CSS và font của Admin Web

Giao diện dashboard, responsive, font và giấy phép font.

File cần up:

```text
admin-web/backend.css
admin-web/fonts/BeVietnamPro-Bold.ttf
admin-web/fonts/BeVietnamPro-Medium.ttf
admin-web/fonts/BeVietnamPro-Regular.ttf
admin-web/fonts/BeVietnamPro-SemiBold.ttf
admin-web/fonts/OFL.txt
admin-web/fonts/PlayfairDisplay-OFL.txt
admin-web/fonts/PlayfairDisplay.ttf
admin-web/fonts/README.md
admin-web/styles.css
```

Đối chiếu/nghiệm thu: Đối chiếu desktop/mobile và bảo toàn đường dẫn font.

#### ECO-35: Module giao diện và thao tác quản trị web

Menu, danh sách, form, CRUD, phân quyền hiển thị và cập nhật dữ liệu của Admin Web.

File cần up:

```text
admin-web/backend.js
```

Đối chiếu/nghiệm thu: Đối chiếu module-navigation, live-updates và delete-content trong browser suite.

#### ECO-36: Kết nối Firebase Web và thiết lập mật khẩu

Auth/REST client web, loader/template cấu hình, script cấu hình và màn thiết lập mật khẩu.

File cần up:

```text
admin-web/firebase-client.js
admin-web/firebase-config-loader.js
admin-web/firebase-config.example.js
admin-web/scripts/configure-firebase.mjs
admin-web/setup-password.html
admin-web/setup-password.js
```

Đối chiếu/nghiệm thu: Sinh firebase-config.local.js tại máy; không commit file local/production đã sinh.

#### ECO-37: Kiểm thử web, browser và cấu hình client

Browser smoke và test backend cho web client/config/setup password.

File cần up:

```text
admin-web/tests/delete-content.html
admin-web/tests/firebase-smoke.html
admin-web/tests/live-updates.html
admin-web/tests/module-navigation.html
admin-web/tests/run-emulator-browser-smoke.py
admin-web/tests/runner.html
admin-web/tests/settings-smoke.html
admin-web/tests/social-smoke.html
backend/test/setup-password.test.ts
backend/test/web-client.test.ts
backend/test/web-config.test.ts
```

Đối chiếu/nghiệm thu: Chạy đúng project Emulator demo; chỉ ghi Done sau khi có kết quả kiểm tra phù hợp.

#### ECO-38: Source React/Figma tham chiếu và cấu hình

Giữ source React, components và scaffold thiết kế gốc để đối chiếu; Android/Admin Web hiện chạy bằng source riêng.

File cần up:

```text
Recycling Share App/.figma/make/analyze-routes
Recycling Share App/.figma/make/deploy
Recycling Share App/.figma/make/deploy-preview
Recycling Share App/.figma/make/dev
Recycling Share App/.figma/make/dev.json
Recycling Share App/.figma/make/format
Recycling Share App/.figma/make/import-assets.mjs
Recycling Share App/.figma/make/install
Recycling Share App/.figma/make/langserver
Recycling Share App/.figma/make/site.json
Recycling Share App/.gitattributes
Recycling Share App/.gitignore
Recycling Share App/.mise.toml
Recycling Share App/AGENTS.md
Recycling Share App/CLAUDE.md
Recycling Share App/index.html
Recycling Share App/package.json
Recycling Share App/pnpm-lock.yaml
Recycling Share App/src/App.tsx
Recycling Share App/src/components/BottomNav.tsx
Recycling Share App/src/components/CreatePostModal.tsx
Recycling Share App/src/components/PostCard.tsx
Recycling Share App/src/components/StoriesBar.tsx
Recycling Share App/src/data.ts
Recycling Share App/src/index.css
Recycling Share App/src/main.tsx
Recycling Share App/src/moreData.ts
Recycling Share App/src/navigation.tsx
Recycling Share App/src/screens/BadgesScreen.tsx
Recycling Share App/src/screens/ChallengeDetailScreen.tsx
Recycling Share App/src/screens/CreateListingScreen.tsx
Recycling Share App/src/screens/EditProfileScreen.tsx
Recycling Share App/src/screens/EventsScreen.tsx
Recycling Share App/src/screens/ExploreScreen.tsx
Recycling Share App/src/screens/ForgotPasswordScreen.tsx
Recycling Share App/src/screens/FriendsScreen.tsx
Recycling Share App/src/screens/GroupDetailScreen.tsx
Recycling Share App/src/screens/GroupsScreen.tsx
Recycling Share App/src/screens/HashtagScreen.tsx
Recycling Share App/src/screens/HelpCenterScreen.tsx
Recycling Share App/src/screens/HomeScreen.tsx
Recycling Share App/src/screens/ImageViewerScreen.tsx
Recycling Share App/src/screens/LeaderboardScreen.tsx
Recycling Share App/src/screens/LoginScreen.tsx
Recycling Share App/src/screens/MarketItemDetailScreen.tsx
Recycling Share App/src/screens/MaterialGuideScreen.tsx
Recycling Share App/src/screens/MessagesScreen.tsx
Recycling Share App/src/screens/MyImpactScreen.tsx
Recycling Share App/src/screens/NotificationsScreen.tsx
Recycling Share App/src/screens/OTPScreen.tsx
Recycling Share App/src/screens/OnboardingScreen.tsx
Recycling Share App/src/screens/PostDetailScreen.tsx
Recycling Share App/src/screens/PrivacySettingsScreen.tsx
Recycling Share App/src/screens/ProfileScreen.tsx
Recycling Share App/src/screens/RecyclingGuideDetailScreen.tsx
Recycling Share App/src/screens/RecyclingMapScreen.tsx
Recycling Share App/src/screens/RecyclingPointDetailScreen.tsx
Recycling Share App/src/screens/ReportScreen.tsx
Recycling Share App/src/screens/RewardShopScreen.tsx
Recycling Share App/src/screens/ScannerScreen.tsx
Recycling Share App/src/screens/SearchScreen.tsx
Recycling Share App/src/screens/SettingsScreen.tsx
Recycling Share App/src/vite-env.d.ts
Recycling Share App/tsconfig.json
Recycling Share App/vite.config.ts
```

Đối chiếu/nghiệm thu: Giữ package/lockfile và đủ asset/source tham khảo; không mô tả React là runtime Android.

#### ECO-39: README và hướng dẫn bàn giao cho team

Hướng dẫn cài công cụ, chạy backend/web/app và đăng nhập CLI bằng tài khoản riêng có quyền project.

File cần up:

```text
HUONG_DAN_TEAM.md
README.md
admin-web/README.md
```

Đối chiếu/nghiệm thu: Kiểm tra lệnh dùng Node trong PATH và không phụ thuộc .tools của người gửi.

#### ECO-40: Tài liệu kỹ thuật, ảnh minh họa và bảng phân công

Tài liệu API/Android/kiểm thử/rà soát, ảnh preview, catalogue màn hình và hai file phân công mới.

File cần up:

```text
docs/admin-web-ui-review.md
docs/android-firebase.md
docs/android-login-fix.md
docs/android-screens.json
docs/architecture.md
docs/backend-verification.md
docs/community-release.md
docs/data-loading.md
docs/firebase-api.md
docs/firebase-backend.md
docs/firestore-physical-map.md
docs/frontend-review.md
docs/network-fix.md
docs/payments-firebase.md
docs/performance-review.md
docs/phan-cong-github-5-thanh-vien.csv
docs/phan-cong-github-5-thanh-vien.md
docs/previews/admin-desktop.png
docs/previews/admin-firebase-login.png
docs/previews/admin-restored/dashboard.png
docs/previews/admin-restored/detail.png
docs/previews/admin-restored/mobile-composer.png
docs/previews/admin-restored/mobile-menu.png
docs/previews/admin-restored/mobile-posts.png
docs/previews/admin-restored/mobile-users.png
docs/previews/admin-restored/users.png
docs/previews/android-chat-review.png
docs/previews/android-home-review.png
docs/previews/android-login-review.png
docs/previews/android-onboarding.png
docs/previews/android-profile-review.png
docs/previews/community/01-home.png
docs/previews/community/02-create-menu.png
docs/previews/community/03-composer.png
docs/previews/community/04-post-detail.png
docs/previews/community/04b-post-comments.png
docs/previews/community/05-friends.png
docs/previews/community/06-notifications.png
docs/previews/community/07-scan.png
docs/previews/community/08-mobile-admin.png
docs/previews/community/09-admin-web-checks.png
docs/previews/community/10-admin-web-base-checks.png
docs/screen-mapping.md
docs/social-admin.md
docs/system-audit-2026-10-23.md
docs/verification.md
```

Đối chiếu/nghiệm thu: Đối chiếu link/tên file; phân biệt test đã chạy với giới hạn chưa kiểm thử.

