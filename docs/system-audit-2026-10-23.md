# Rà soát EcoShare theo mã nguồn — 23/10/2026

Tài liệu này ghi nhận chức năng đang chạy và các giới hạn khi đối chiếu mã nguồn. Bộ sơ đồ hiện hành chỉ vẽ các thực thể và luồng có giao diện đang dùng trong app/Admin Web: [Class Diagram](../Recycling%20Share%20App/diagrams-current/class-diagram.svg), [Class Diagram lớp Android](../Recycling%20Share%20App/diagrams-current/runtime-class-diagram.svg), [ERD logic](../Recycling%20Share%20App/diagrams-current/erd.svg) và [Function Diagram](../Recycling%20Share%20App/diagrams-current/function-diagram.svg). Các phần backend-only và màn mẫu được giữ trong báo cáo kiểm toán để làm rõ phạm vi, không đưa vào sơ đồ tính năng. File nguồn `.mmd`, `.drawio`, `.svg`, `.png` và ZIP nằm cùng thư mục `Recycling Share App/diagrams-current/`.

Phạm vi rà soát: điều hướng `MainActivity`/`CommunityFragment`/`ScreenFragment`, REST client và phiên Android, các route trong `backend/src`, menu và thao tác trong `admin-web/backend.js`, 20 DTO backend, từ điển miền và SQLite tham chiếu. Class Diagram/ERD hiện hành là phạm vi con 18 thực thể gắn với luồng UI; `Review` và `CollectionPoint` chỉ còn trong mô hình backend. `Payment` được giữ vì Admin Web có trang quản lý/đối soát giao dịch; giao diện thanh toán Android chỉ là demo cục bộ. 20 DTO `model/*.java` là projection dữ liệu; luồng Android hiện truyền `JSONObject`, không khởi tạo các DTO đó làm controller. Kiểm thử tích hợp dùng project Firebase Emulator riêng `demo-recycling-share`, không ghi lên Firebase cloud thật. Việc mở được một trong 53 layout Android chỉ chứng minh layout tồn tại; nó không chứng minh API hoặc nghiệp vụ của màn đó hoạt động.

## Ma trận chức năng

| Nhóm | Tình trạng triển khai thực tế | Xác nhận trong lượt này |
| --- | --- | --- |
| Tài khoản, đăng nhập, khôi phục | Email/password và đặt lại mật khẩu qua Firebase Auth; hồ sơ qua `/me`. Mã đăng nhập Google đã nối Credential Manager nhưng chưa có phiên kiểm thử tài khoản Google thực. | Android UI: email login/hồ sơ. Backend: auth/role. Đăng ký, reset và Google chưa có Android E2E trong bộ test hiện hành. |
| Trang chủ, bài chia sẻ, mẹo | `CommunityFragment` dùng `/posts`, `/tips` và route bình luận/phản ứng; tạo/sửa/lưu trữ, ảnh, trả lời và thích bình luận. | Android UI: feed, composer, like/save/comment. Backend: sửa/lưu trữ, reply/comment-like và quyền. |
| Story và thử thách | Story ảnh/video ở Trang chủ qua `/stories`; tab thử thách ở Khám phá qua `/challenges`, hoàn tất qua API. Màn `challenge_detail` XML cũ không điều khiển luồng này. | Android UI: story upload-vs-rotation, điều hướng Hồ sơ → Thử thách. Backend: tạo story/hoàn tất thử thách. Chưa có Android E2E cho hoàn tất. |
| Khám phá và Chợ đồ cũ | Mẹo hay, danh sách tin bán, tìm kiếm, chi tiết, đăng/sửa tin; tin cần Admin duyệt trước khi xuất hiện công khai. | Android UI: chuyển tab/danh sách/chi tiết mua. Backend: tìm kiếm, đăng/sửa/duyệt tin. Chưa có Android E2E cho toàn bộ form tin bán. |
| Đơn hàng | Xác minh hai bên, giá/tồn kho chốt bằng backend transaction; xem/hủy/giao/hoàn tất theo quyền. | Android UI: mua và kiểm tra tồn. Backend: trạng thái/hủy/giao/hoàn tất. |
| Thanh toán MoMo/VNPay | **Demo trên Android**: chọn thương hiệu và lưu kết quả cục bộ; không tạo Payment, không chuyển tiền, không đổi đơn sang PAID. Adapter backend tồn tại nhưng chưa có merchant credentials/callback triển khai. | Test luồng demo và backend adapter trên Emulator; chưa kiểm thử cổng merchant sandbox/thật. |
| Tin nhắn và tin nhắn chờ | Hội thoại hai người, chữ, ảnh, chia sẻ POST/TIP; lấy trang tin cũ bằng cursor, ảnh có kiểm tra quyền. | Android UI: danh sách và gửi chữ. Backend: ảnh/bài chia sẻ/tin nhắn chờ. Chưa có Android E2E cho ảnh và request flow. |
| Bạn bè và thông báo | Tìm kiếm, mời/chấp nhận/từ chối, gợi ý; thông báo thích/bình luận/kết bạn và đánh dấu đã đọc. | Backend integration; chưa có Android UI E2E riêng cho lời mời và thông báo trong bộ test. |
| SCAN | Chụp/chọn ảnh, lưu lịch sử riêng tư; bytes ảnh inline Firestore qua API Spark. Chưa nhận diện vật liệu bằng AI. | Backend media/permission tests và Android photo tests. |
| Hồ sơ, địa chỉ, xác minh | Sửa hồ sơ, ảnh đại diện/ảnh bìa, địa chỉ, gửi và xem trạng thái xác minh qua API. | Android UI: dữ liệu hồ sơ/phiên. Backend: địa chỉ, xác minh, ảnh. Chưa có Android E2E cho CRUD địa chỉ và KYC. |
| Điểm Eco | Số dư và thanh tiến trình ở Home/Profile đọc hồ sơ API; hoàn tất thử thách dùng backend. `my_impact`, huy hiệu, bảng xếp hạng và đổi thưởng XML cũ vẫn là dữ liệu mẫu. | Android UI: hồ sơ/điều hướng thử thách. Backend: ledger/hoàn tất. |
| Admin Web | 16 mục menu hiện hành; phân quyền Admin/Moderator, duyệt nội dung/tin bán/xác minh, người dùng, đơn, báo cáo, sổ điểm, cấu hình, thống kê, nhật ký. Xóa POST/TIP là lưu trữ; xóa tin bán là ẩn. | Backend integration và 11 tình huống browser thật trên Firebase Emulator. |
| Admin mobile | Tổng quan, duyệt/từ chối tin bán và xử lý báo cáo qua API; phạm vi hẹp hơn Admin Web. | Android UI: tổng quan và chặn MEMBER. Backend: duyệt tin/xử lý báo cáo; chưa có Android E2E riêng cho mọi nút. |
| Điểm thu gom | Có `CollectionPoint`, `/collection-points`, `/admin/collection-points` và layout XML mẫu, nhưng chưa có lối vào/tải dữ liệu ở app; mục Admin Web đã gỡ. | Chỉ backend API/model, không coi là chức năng người dùng đã giao. |
| Màn XML kế thừa khác | OTP mẫu, bản đồ, nhóm/sự kiện, đổi thưởng, đánh giá/tranh chấp và một số cài đặt dùng `DemoRepository`/SharedPreferences hoặc chưa có luồng API tương ứng. | Kiểm tra mã nguồn và inflate layout; chưa có kiểm thử E2E nghiệp vụ vì đây chưa phải chức năng live. |

## Kết quả kiểm thử của lượt rà soát

- Backend TypeScript build và toàn bộ suite chạy với Firebase Emulator: **147 đạt, 0 lỗi, 0 bỏ qua**. Cấu hình này tách biệt cloud production.
- Mô hình SQL/DTO, các ràng buộc quan trọng, XML Android và bốn sơ đồ mới: **14/14 đạt** bằng `python tools/validate_design.py`.
- Android build thành công; JVM unit tests **14/14 đạt**. `lintDebug` đạt **0 lỗi**, còn **1.020 cảnh báo** về tài nguyên/layout và khả năng tiếp cận; báo cáo chi tiết ở `app/build/reports/lint-results-debug.html`.
- Admin Web: smoke mock kiểm 16 mục Admin và 6 mục Moderator, cùng 7 tình huống cập nhật trực tiếp/xóa nội dung; kiểm tra cú pháp JavaScript đạt. Browser Emulator đạt **6/6 trang, 23/23 khẳng định**: đăng nhập/phân quyền, bài và bình luận, cấu hình tạo/đọc/sửa, menu, cập nhật trực tiếp, xóa bài/mẹo/tin bán. Xác nhận riêng cả **16/16 API trang menu Admin trả 200**. Smoke script dùng cấu hình Emulator chèn trong bộ nhớ và kiểm tra `health.emulator` cùng vai trò Admin trước khi chạy; cloud Admin không bị thay đổi.
- Android: build và JVM unit tests; instrumentation opt-in trên Pixel 6a Emulator chạy **49/49 đạt, 0 lỗi, 0 bỏ qua**. Lượt này bật các ca Emulator/Auth và inline media; loại `FirebaseSparkReadOnlyTest` vì đây là kiểm thử cloud chỉ đọc riêng. Lượt mặc định trước đó có 30 ca chạy và 19 ca bỏ qua do thiếu opt-in, không cộng các ca bỏ qua thành đạt. Test phân trang xác nhận sửa nội dung bài thứ năm khi vẫn ở Trang chủ; test điều hướng phát hiện và xác nhận sửa đường Hồ sơ → Thử thách.

Có thể chạy lại phần tự động từ gốc repository bằng các lệnh dưới đây. Bộ Android tích hợp cần thiết bị Emulator và Auth/Firestore/Functions/Storage Emulator của project `demo-recycling-share` đã seed; `FirebaseSparkReadOnlyTest` là ca đọc cloud riêng nên được loại khỏi lượt demo này. Các trang smoke Admin chạy trong trình duyệt tại `admin-web/tests/runner.html` với bản cấu hình Firebase Emulator riêng.

```powershell
npm --prefix backend run test:emulators
.\gradlew.bat :app:assembleDebug :app:testDebugUnitTest --no-configuration-cache
.\gradlew.bat :app:connectedDebugAndroidTest '-Pandroid.testInstrumentationRunnerArguments.ecoshareEmulator=true' '-Pandroid.testInstrumentationRunnerArguments.ecoshareInlineEmulator=true' '-Pandroid.testInstrumentationRunnerArguments.notClass=com.example.recyclingshareapp.FirebaseSparkReadOnlyTest' --no-configuration-cache
python tools/validate_design.py
python admin-web/tests/run-emulator-browser-smoke.py
```

Admin browser smoke cần Auth/Firestore/Functions/Storage Emulator đang chạy, tài khoản `admin@ecoshare.test` đã seed vai trò `ADMIN` và Microsoft Edge/Google Chrome. Có thể chạy riêng một trang với `--page delete-content.html`.

## Điều chỉnh mô hình và giới hạn còn lại

Trước khi rà soát, từ điển miền/DTO/sơ đồ dữ liệu đầy đủ thiếu năm trường backend đang dùng: `Interaction.parent_comment_id`, `Interaction.like_count`, `Message.content_id`, `Message.content_kind`, `Report.content_id`. Đã đồng bộ các trường đó với thứ tự/kiểu SQL, thêm ba quan hệ tham chiếu mới và cập nhật enum SQL tham chiếu cho `STORY` và `CHALLENGE_COMPLETION`. Mô hình backend vẫn có **20** thực thể; Class Diagram và ERD app hiện hành vẽ **18**, lược `Review` và `CollectionPoint` vì không có luồng UI tương ứng.

Rà soát giao diện cũng phát hiện đường Hồ sơ → “Xem thử thách” không chọn tab Thử thách đúng khi mở lần đầu hoặc quay lại tab Khám phá đang giữ trạng thái. Đã sửa truyền tab qua `MainActivity` sang fragment Khám phá; ca instrumentation kiểm tra cả fragment mới và fragment được giữ lại. Android lint cũng phát hiện `android:tint` không phù hợp trong icon tiêu đề Tin nhắn; đã chuyển sang `app:tint`, sau đó lint đạt 0 lỗi.

ERD là **mô hình logic**, không phải ảnh chụp schema Firestore vật lý. Backend đang dùng đúng 20 collection cấp cao nhất; [bản đối chiếu Firestore](firestore-physical-map.md) liệt kê từng nhóm và các trường vận hành ngoài DTO, ví dụ `users.points_balance`, `content_entries.created_at/materials/weight_kg/tags/like_count`, `conversations.status/request_sender_id/request_recipient_id/last_message`, cùng counter/cache/idempotency. Riêng ảnh AVATAR liên kết bằng `_parent_type='AVATAR'` và `_parent_id=uid` trong Firestore; SQLite tham chiếu yêu cầu một trong năm FK nội dung của `media_assets`, nên không biểu diễn chính xác trường hợp này. Sơ đồ ghi quan hệ nghiệp vụ có tên; không giả định SQL đang vận hành trên production.

Không thể kết luận “mọi tính năng đã hoàn thiện” từ build hoặc số màn hình. Android chưa có kiểm thử E2E riêng cho đăng ký/reset, Google OAuth, lời mời/thông báo, ảnh/tin nhắn chờ, form đăng/sửa/duyệt tin bán, CRUD địa chỉ, KYC, hoàn tất thử thách, và các màn prototype. Thanh toán merchant sandbox và browser Admin đăng nhập cloud thật cũng chưa được nghiệm thu. Bộ test hiện tại là kiểm thử tự động theo các ca đã viết, không phải mọi tổ hợp vai trò/trạng thái/thiết bị.

## Nguồn chính

- Android: `app/src/main/java/com/example/recyclingshareapp/MainActivity.java`, `ui/CommunityFragment.java`, `ui/ScreenFragment.java`, `data/remote/FirebaseBackendClient.java`.
- Backend: `backend/src/app.ts`, `social.ts`, `community.ts`, `marketplace.ts`, `payments.ts`, `admin.ts`, `media.ts`.
- Admin: `admin-web/backend.js`, `admin-web/tests/`.
- Dữ liệu/mô hình: `docs/domain-model.json`, `database/schema.sql`, `app/src/main/java/com/example/recyclingshareapp/model/`.
