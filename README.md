# ♻ Recycling Share App — EcoShare (Nhóm 9)

Ứng dụng mua bán đồ đã qua sử dụng và chia sẻ kiến thức tái chế. **Giao dịch mua bán thay cho yêu cầu trao đổi; cả người mua và người bán đều phải được xác minh.** Màn hình thanh toán MoMo/VNPay hiện chỉ là demo, không chuyển tiền thật hoặc xác nhận đơn đã trả tiền. Điểm thu gom mới có model/API và màn mẫu, chưa có luồng app. Admin làm việc chính trên web; mobile chỉ có quản trị cơ bản.

## Bản bàn giao hiện tại

- **53 layout màn hình Android native Java/XML**, ngoài layout host `activity_main.xml`. Luồng cộng đồng đã dùng Firebase Auth và REST API: đăng bài/mẹo hay, đọc toàn văn và bình luận, thích/lưu, bạn bè, thông báo và SCAN. Các luồng hồ sơ, địa chỉ, xác minh, đăng bán và đơn hàng cũng đã nối API.
- **Trang chủ hiển thị bài chia sẻ đã xuất bản và story**. Khám phá có **Mẹo hay**, **Thử thách** và **Chợ đồ cũ**. Nút **+** mở lựa chọn đăng bài chia sẻ, mẹo hay hoặc tin bán. Trái tim chuyển đỏ khi thích; biểu tượng lưu chuyển vàng; bài POST/TIP có thể chia sẻ qua tin nhắn.
- **Admin web dùng Firebase thật** tại trang mặc định: quản lý người dùng, xác minh, bài chia sẻ, mẹo hay, ảnh SCAN, chợ đồ cũ, đơn hàng, thanh toán, báo cáo và các khu vực vận hành. Có xem toàn văn/ảnh/bình luận, tạo/sửa/ẩn/lưu trữ, lý do xử lý và nhật ký.
- **20 mô hình trong backend/schema**; Class Diagram và ERD hiển thị 18 thực thể có luồng giao diện đang dùng trong Android/Admin Web. Thanh toán MoMo/VNPay ở Android là demo; Admin Web có trang quản lý/đối soát giao dịch. Bộ sơ đồ có draw.io, SVG, PNG, Mermaid và ZIP.
- **Admin mobile cơ bản đã nối API**: tổng quan, duyệt/từ chối tin bán, xử lý báo cáo kèm lý do. Xác minh, phân quyền, thanh toán và cấu hình đầy đủ thuộc Admin web.

Theo yêu cầu giữ **gói Spark miễn phí**, backend chạy bằng **Node trên máy tính**, dùng **Firebase Authentication và Firestore cloud** của project `recycling-share-app`. API local ở cổng **5002**, Admin web chạy localhost. Ảnh được lưu inline trong Firestore, tối đa **384 KiB/tệp**, và tải qua API có kiểm tra quyền. Chế độ này không triển khai Cloud Functions, không dùng Cloud Storage và chưa cung cấp backend công khai khi máy tính tắt. Source Functions/Storage và Emulator vẫn được giữ để kiểm thử.

**Đã kết nối Firebase cloud ngày 19/10/2026**: triển khai Authentication Email/Password, Firestore Rules/Indexes; database `(default)` ở `nam5` và billing vẫn tắt. Tài khoản Admin thật đã sẵn sàng, chủ tài khoản đã tự đặt mật khẩu. Cloud có **3 bài chia sẻ, 2 mẹo hay, 1 SCAN riêng tư, 3 tin bán chờ duyệt** cùng ảnh thật. Đã đọc lại dữ liệu/ảnh qua API và kiểm tra sửa–đọc–khôi phục bài trong database. Tin bán mẫu giữ `PENDING` đến khi hoàn tất xác minh và duyệt hợp lệ; không tạo KYC, đơn hàng hoặc thanh toán giả trên cloud. Các tài khoản `@ecoshare.test` và bộ mẫu Emulator tách riêng. Tab Tin nhắn đã đọc/ghi hội thoại qua API; một số tùy chọn cài đặt và màn hình phụ còn prototype. Thanh toán merchant thật chưa bật; hoàn tiền VNPay tự động chưa triển khai.

Hướng dẫn: [Rà soát hệ thống và sơ đồ hiện hành](docs/system-audit-2026-10-23.md) · [Bản cập nhật cộng đồng](docs/community-release.md) · [Backend Firebase và triển khai](docs/firebase-backend.md) · [API v1](docs/firebase-api.md) · [Kết nối Android](docs/android-firebase.md) · [Quản trị cộng đồng](docs/social-admin.md) · [Kết quả kiểm thử](docs/verification.md).

**Sửa lỗi app tự thoát khi đăng nhập — 19/10/2026:** đã sửa việc đóng kết nối TLS trên main thread khi đăng nhập thất bại hoặc đăng xuất. Bản debug của project hiện tại tự dùng Spark; bản release tiếp tục dùng HTTPS. Xem [nguyên nhân, bản sửa và cách kiểm tra](docs/android-login-fix.md).

**Sửa lỗi tải dữ liệu chập chờn — 19/10/2026:** đã ghi nhận kết nối bị đóng trước khi nhận HTTP headers trên Android, trong khi API máy tính vẫn trả 200. Client thử lại GET đúng một lần bằng kết nối mới khi gặp EOF/reset; không tự gửi lại thao tác ghi vì lỗi mạng. Màn hình giữ thông báo lỗi cụ thể và cho chạm để thử lại; feed cũng tránh tải dư byte ảnh từ Firestore. Chưa kết luận thành phần nào đóng kết nối ban đầu. Xem [bằng chứng, phạm vi sửa và cách kiểm tra](docs/network-fix.md).

Kết quả tích hợp mới nhất: backend Firebase Emulator **130/130**, Android JVM **17/17**, Android instrumentation **39/39** với Emulator và **1/1** kiểm thử chat UI riêng; thêm **1/1** lượt chỉ đọc Firebase cloud thật. Ngày 20/10, kiểm thử SQLite offline **3/3** và giao diện mở nội dung sau khi mất phiên **1/1** đạt. Kiểm tra mô hình **13/13**; browser Admin/Community trên Emulator **11/11**, không có lỗi JavaScript. Giao diện Admin tại 375px và desktop không tràn ngang; APK debug build thành công. Cấu hình OAuth Google cho Android đã được thêm ngày 20/10/2026; đăng nhập Google thật vẫn cần kiểm thử trên thiết bị. Phạm vi và lệnh kiểm tra tại [verification.md](docs/verification.md). Đã lưu [ảnh giao diện thực tế](docs/community-release.md#ảnh-giao-diện-và-tệp-bàn-giao).

## Cấu trúc

```text
app/src/main/
  java/com/example/recyclingshareapp/
    MainActivity.java          # Host điều hướng native
    ui/CommunityFragment.java  # Cộng đồng và các luồng Firebase đã nối
    ui/ScreenFragment.java     # Các destination native còn lại
    data/remote/               # FirebaseBackendClient và BackendSession
    data/                      # Cache/prototype cũ và TradeRules
    model/                     # Đúng 20 DTO nghiệp vụ
  res/layout/                  # activity_main + 53 fragment XML
  res/values/                  # Tiếng Việt, màu, theme, style
  res/drawable/                # Background và minh họa vector
admin-web/                     # Admin HTML/CSS/JS, không cần npm
backend/                       # Functions TypeScript, nghiệp vụ Firebase và test
firestore.rules, storage.rules # Quyền dữ liệu và tệp
firebase.json                  # Functions, Hosting và Emulator
database/schema.sql            # SQLite tham chiếu, FK/check/unique/trigger
docs/                          # Kiến trúc, đối chiếu màn hình, catalogue, preview
tools/                         # Sinh layout/model/sơ đồ và kiểm tra đồng bộ
Recycling Share App/
  src/                         # Source Figma/React gốc để đối chiếu
  *.drawio, *.png               # Sơ đồ gốc (giữ làm tư liệu)
  diagrams-v2/                 # Bộ sơ đồ trước khi rà soát, giữ để đối chiếu
  diagrams-current/            # Class/ERD/Function theo mã nguồn hiện tại
```

## Thiết lập trên máy thành viên

Xem [hướng dẫn bàn giao cho team](HUONG_DAN_TEAM.md) để cài công cụ, cấp quyền Firebase và chạy bằng Node.js trong PATH.

## Chạy Android

Mở **thư mục gốc này** bằng Android Studio, để IDE dùng Gradle JDK đi kèm Android Studio. Project giữ nguyên cấu hình SDK/AGP/Gradle đang có (compile/target API 37, min API 24). SDK path trong `local.properties` là cấu hình riêng trên máy, không commit.

```powershell
./gradlew.bat :app:assembleDebug :app:testDebugUnitTest
```

APK: `app/build/outputs/apk/debug/app-debug.apk`. Chọn module `app` và Run lên emulator/điện thoại.

Bản đóng gói GitHub này đã kèm `app/google-services.json` và cho phép commit cấu hình client này; Google Services plugin 4.5.0 chỉ áp dụng khi file này tồn tại. Thêm file không tự bật Firestore/Auth/Storage, deploy backend hoặc kích hoạt Google Sign-In. Client dùng REST nên không cần thêm Firebase Android SDK; xem [kết nối Android](docs/android-firebase.md).

Để dùng dữ liệu cloud hiện tại: khởi chạy API Spark bên dưới và mở bản Android debug. Project `recycling-share-app` tự chọn **Spark miễn phí · Backend máy tính + Firestore cloud** và bỏ lựa chọn kết nối cũ đã lưu; không còn nút chọn backend ở màn hình đăng nhập. Dùng tài khoản Firebase thật và mật khẩu đã đặt; Android Emulator gọi API máy Windows qua `10.0.2.2:5002`. Kiểm thử Firebase Emulator dùng cấu hình trong mã kiểm thử, không chuyển môi trường trên màn hình đăng nhập; xem [hướng dẫn Android](docs/android-firebase.md).

Sau đăng nhập, Trang chủ tải 3 bài chia sẻ đầu và lấy thêm theo vị trí cuộn. Các danh sách khác cũng đọc từng trang; Mẹo hay, Chợ đồ cũ và các màn thường dùng được nạp trước để đổi màn mượt hơn. Nội dung/ảnh công khai đã xem có bản SQLite để mở lại khi API tạm mất kết nối, kể cả khi mở lại app bằng nút **Xem nội dung công khai** ở màn đăng nhập; màn riêng tư đã xem chỉ được giữ trong RAM của phiên đăng nhập. Layout xoay ngang chuyển điều hướng sang bên trái và màn đăng nhập sang hai cột. Xem [cách tải dữ liệu và phạm vi cache](docs/data-loading.md).

Admin làm việc chính trên web. Admin mobile hỗ trợ tổng quan, duyệt tin bán và xử lý báo cáo qua API. Tin nhắn giữa hai tài khoản đã dùng backend; một số tùy chọn cài đặt và khu vực phụ vẫn là prototype; xem phạm vi tại [đối chiếu màn hình](docs/screen-mapping.md). Nút đăng nhập Google đã nối Credential Manager với Firebase Auth REST; file cấu hình hiện có OAuth client Android/Web nhưng chưa kiểm thử đăng nhập trên thiết bị, xem [cách kiểm tra](docs/android-firebase.md#bật-đăng-nhập-google). Apple chưa được kết nối và đang ẩn.

## Chạy backend Firebase

Chế độ Spark hiện tại, chạy tại thư mục gốc với Node 22:

```powershell
npm --prefix backend ci
$env:GCLOUD_PROJECT='recycling-share-app'
$env:FIRESTORE_EMULATOR_HOST=$null
$env:FIREBASE_AUTH_EMULATOR_HOST=$null
$env:FIREBASE_STORAGE_EMULATOR_HOST=$null
npm --prefix backend run dev:cloud
```

Firebase CLI trên máy phải đăng nhập tài khoản có quyền project. Giữ terminal này chạy; API ở `http://127.0.0.1:5002/v1`. Cách chạy Firebase Emulator riêng, seed và cấu hình cổng nằm tại [docs/firebase-backend.md](docs/firebase-backend.md); Emulator cần thêm Java 21+ và dùng project `demo-recycling-share`.

## Chạy Admin web

```powershell
$env:GCLOUD_PROJECT='recycling-share-app'
node admin-web/scripts/configure-firebase.mjs --local-cloud
python -m http.server 5173 --directory admin-web --bind 127.0.0.1
```

Mở **http://127.0.0.1:5173/**, đăng nhập bằng email của tài khoản Admin thật và mật khẩu vừa đặt. Mục **Bài chia sẻ**, **Mẹo hay**, **Ảnh SCAN** và **Chợ đồ cũ** đọc cùng Firestore với app; sửa nội dung cần nhập lý do. Tài khoản `admin@ecoshare.test` chỉ dùng khi chuyển cấu hình về Emulator. Chi tiết: [admin-web/README.md](admin-web/README.md).

## Sơ đồ theo mã nguồn hiện tại

- [Tải trọn bộ ZIP](<Recycling Share App/diagrams-current/ecoshare-diagrams-current.zip>)
- [Class — 18 thực thể app](<Recycling Share App/diagrams-current/class-diagram.svg>) · [Class — các lớp Android chính](<Recycling Share App/diagrams-current/runtime-class-diagram.svg>)
- [ERD logic — 18 thực thể app](<Recycling Share App/diagrams-current/erd.svg>) · [Sửa draw.io](<Recycling Share App/diagrams-current/erd.drawio>)
- [Function — các tính năng có trên app](<Recycling Share App/diagrams-current/function-diagram.svg>) · [Sửa draw.io](<Recycling Share App/diagrams-current/function-diagram.drawio>)

SVG mở trực tiếp bằng trình duyệt, phóng to không vỡ hình; mỗi sơ đồ có `.mmd`, `.drawio` và `.png`. `docs/domain-model.json` và [bản đối chiếu Firestore](docs/firestore-physical-map.md) vẫn ghi đủ 20 mô hình/collection backend; `Review` và `CollectionPoint` không nằm trong sơ đồ app vì không có luồng giao diện tương ứng. [Báo cáo rà soát](docs/system-audit-2026-10-23.md) ghi căn cứ kiểm tra. Sơ đồ v2 được giữ để đối chiếu, không dùng làm mô hình hiện hành.

## Tài liệu và kiểm thử

- [Kiến trúc, quy tắc mua bán, ma trận admin và API dự kiến](docs/architecture.md)
- [Đối chiếu màn hình Figma → Android](docs/screen-mapping.md)
- [20 thực thể và toàn bộ trường](docs/domain-model.json)
- [Preview Admin desktop](docs/previews/admin-desktop.png) · [Preview Android](docs/previews/android-home-review.png)
- [Rà soát và sửa lỗi frontend ngày 18/10/2026](docs/frontend-review.md)

```powershell
python tools/validate_design.py
./gradlew.bat :app:connectedDebugAndroidTest --no-configuration-cache
```

Kiểm thử browser: sau khi khởi chạy và seed Emulator, mở `http://127.0.0.1:5174/tests/runner.html`. Các trang QA gọi API thật, từ chối project ngoài `demo-recycling-share`/localhost và có thể thêm dữ liệu QA vào Emulator. Kết quả kiểm tra bàn giao ghi tại [docs/verification.md](docs/verification.md).

`python tools/generate_design.py` sinh Java DTO/SQL/sơ đồ từ một nguồn chung. Các layout Firebase hiện được duy trì trực tiếp trong `app/src/main/res/layout/`; generator Android cũ đã có chốt dừng khi phát hiện `CommunityFragment.java` để bảo vệ giao diện mới. `python tools/configure_native.py --check` chỉ kiểm tra host/theme; thêm `--format` khi cần căn lề XML.

## Thành viên nhóm

| Họ tên | MSSV | Vai trò |
|---|---|---|
| Võ Hoàng Tuấn Hải | 31241027049 | Nhóm trưởng |
| Lê Dương Anh Khoa | 31241020839 | Thành viên |
| Nguyễn Đức Trung | 31241021311 | Thành viên |
| Lý Minh Đạt | 31241022041 | Thành viên |

Dự án phục vụ mục đích học tập. **Chia sẻ hôm nay — Xanh hơn mỗi ngày.**
