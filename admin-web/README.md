# EcoShare Admin Web

Đây là bảng quản trị EcoShare chạy trên trình duyệt. Trang web gọi Firebase Authentication để đăng nhập và gọi backend để đọc, sửa dữ liệu. Backend kiểm tra quyền trước khi thực hiện thao tác; chỉ đổi giao diện hay file cấu hình trên máy không thể tự cấp quyền Admin.

## Mở trang nào?

| Bạn muốn làm gì? | Địa chỉ | Dữ liệu sử dụng |
|---|---|---|
| Quản trị project Firebase thật | `http://127.0.0.1:5173/` | Firebase cloud; thay đổi có hiệu lực với ứng dụng |
| Phát triển và thử chức năng an toàn | `http://127.0.0.1:5174/` | Firebase Emulator; dữ liệu mẫu trên máy |

`index.html` là trang Admin chính. `backend.html` mở cùng giao diện. Cổng `5173` chỉ phục vụ các file web; khi dùng project thật, backend ở cổng `5002` cũng phải đang chạy. Cổng `5174` do Firebase Hosting Emulator phục vụ.

## Chạy Admin với dữ liệu Firebase thật

Chế độ này dành cho project `recycling-share-app` trên gói Spark. Máy tính chạy backend, còn đăng nhập và dữ liệu được lưu trên Firebase thật. Mọi thay đổi trên trang có thể xuất hiện trong ứng dụng, nên hãy kiểm tra kỹ trước khi lưu hoặc duyệt.

Cần Node.js 22, dependency của `backend` đã cài và Firebase CLI đã đăng nhập bằng tài khoản có quyền truy cập project. Trên máy này, Node.js nằm trong `.tools/node-v22.23.3-win-x64` và chưa có trong `PATH` của PowerShell. Mọi lệnh dưới đây chạy từ **thư mục gốc `RecyclingShareApp`**, không phải thư mục `admin-web`. Nếu chưa cài dependency, chạy một lần:

```powershell
$nodeDir = (Resolve-Path '.tools/node-v22.23.3-win-x64').Path
$env:PATH = "$nodeDir;$env:PATH"
& (Join-Path $nodeDir 'npm.cmd') --prefix backend ci
```

Mở **PowerShell thứ nhất** tại thư mục gốc dự án để bật API:

```powershell
$nodeDir = (Resolve-Path '.tools/node-v22.23.3-win-x64').Path
$env:PATH = "$nodeDir;$env:PATH"
$env:GCLOUD_PROJECT='recycling-share-app'
$env:FIRESTORE_EMULATOR_HOST=$null
$env:FIREBASE_AUTH_EMULATOR_HOST=$null
$env:FIREBASE_STORAGE_EMULATOR_HOST=$null
& (Join-Path $nodeDir 'npm.cmd') --prefix backend run dev:cloud
```

Để cửa sổ này mở. Khi thấy `EcoShare Spark API http://127.0.0.1:5002/v1`, mở PowerShell thứ hai và chạy `Invoke-RestMethod http://127.0.0.1:5002/v1/health`; phản hồi phải có `status: ok`. Nếu báo chưa đăng nhập Firebase CLI, chạy `& .\backend\node_modules\.bin\firebase.cmd login` trong cửa sổ đã đặt `PATH`, rồi bật API lại. Nếu dùng Node.js 22 cài sẵn trong `PATH` trên máy khác, có thể thay lệnh `& (Join-Path $nodeDir 'npm.cmd')` bằng `npm`.

Mở **PowerShell thứ hai** tại thư mục gốc để chuẩn bị cấu hình web và bật trang:

```powershell
$env:GCLOUD_PROJECT='recycling-share-app'
$nodeDir = (Resolve-Path '.tools/node-v22.23.3-win-x64').Path
& (Join-Path $nodeDir 'node.exe') admin-web/scripts/configure-firebase.mjs --local-cloud
python -m http.server 5173 --directory admin-web --bind 127.0.0.1
```

Mở `http://127.0.0.1:5173/` và đăng nhập bằng tài khoản Admin thật đã được cấp. Dừng từng dịch vụ bằng `Ctrl+C` trong cửa sổ PowerShell tương ứng. Nếu tắt backend, trang web vẫn mở nhưng không thể tải hoặc lưu dữ liệu.

Lệnh cấu hình tạo `admin-web/firebase-config.local.js` từ public Firebase config trong `app/google-services.json`. Đây là cấu hình client, không chứa service account. File local được loại khỏi Git và bản Hosting deploy. Chế độ này không triển khai Cloud Functions hay cần bật gói Blaze.

## Chạy với Firebase Emulator

Dùng Emulator để thử nghiệm với dữ liệu cục bộ, không ghi vào Firebase cloud. Cần Node.js 22 và Java 21 trở lên. Trên máy đã cài Android Studio, có thể dùng JBR đi kèm làm Java. Nếu máy chưa cài dependency, xem các lệnh cài đặt trong [hướng dẫn Firebase backend](../docs/firebase-backend.md#chạy-firebase-emulator-riêng-trên-windows).

Từ thư mục `backend`, chạy:

```powershell
npm run emulators
```

Giữ cửa sổ này mở rồi truy cập `http://127.0.0.1:5174/`. Trang Admin Emulator dùng project `demo-recycling-share`; muốn có tài khoản và nội dung mẫu thì mở PowerShell khác, chạy lệnh seed theo [hướng dẫn Emulator](../docs/firebase-backend.md#chạy-firebase-emulator-riêng-trên-windows). Tài khoản mẫu chỉ dùng trong Emulator, không đăng nhập được vào Firebase cloud.

Khi đổi sang chế độ cloud, hãy dùng đúng hướng dẫn cloud ở trên. Script `configure-firebase.mjs --local-cloud` thay cấu hình local hiện tại bằng cấu hình cloud; không dùng nhầm dữ liệu mẫu Emulator để kiểm tra project thật.

## Những gì quản trị viên có thể làm

Menu được điều chỉnh theo quyền của tài khoản. Admin có các khu vực chính sau:

- **Tổng quan, thống kê:** xem số liệu và những việc đang chờ xử lý.
- **Người dùng, xác minh:** xem tài khoản, cập nhật quyền/trạng thái và xử lý hồ sơ xác minh.
- **Bài chia sẻ, Mẹo hay, Ảnh SCAN:** xem và quản lý nội dung; ảnh SCAN là dữ liệu riêng tư, chỉ Admin được quản lý.
- **Chợ đồ cũ, Đơn hàng, Thanh toán:** kiểm duyệt tin bán và xử lý các phần việc giao dịch được backend hỗ trợ.
- **Báo cáo, Danh mục, Nội dung, Sổ điểm, Cấu hình, Nhật ký:** quản lý và theo dõi các dữ liệu tương ứng.

- **Xóa tài khoản:** trong mục Người dùng, chọn “Xóa tài khoản”, nhập lại email (hoặc UID nếu hồ sơ không có email) và lý do để xác nhận. Thao tác xóa tài khoản đăng nhập trên Firebase Authentication cùng hồ sơ `users/{uid}`; địa chỉ, hồ sơ xác minh/tệp, nội dung, tin nhắn, đơn hàng/thanh toán và nhật ký liên quan vẫn được giữ lại. Không thể xóa tài khoản Admin đang đăng nhập. Hệ thống ghi lại người thực hiện, lý do và UID trong nhật ký quản trị.

Moderator chỉ thấy và dùng các chức năng được cấp cho Moderator. Admin có thể xét duyệt hồ sơ, tin bán và báo cáo kể cả nội dung của chính mình; các thao tác quản trị vẫn cần nhập lý do và được ghi nhật ký. Quyền cuối cùng luôn do backend xác định.

Ở **Bài chia sẻ**, **Mẹo hay** và **Chợ đồ cũ**, nút **Xóa** yêu cầu nhập lại tiêu đề và lý do. Bài chia sẻ/mẹo hay được chuyển vào **Lưu trữ**; tin bán chuyển sang **Đã ẩn**, nên không còn xuất hiện với người dùng. Đây là thao tác gỡ nội dung khỏi ứng dụng, không xóa vĩnh viễn dữ liệu: ảnh, bình luận, sản phẩm, đơn hàng và nhật ký được giữ để tra cứu. Có thể chọn bộ lọc **Lưu trữ** hoặc **Đã ẩn** trong Admin để xem lại.

Để sửa hoặc duyệt một mục: mở khu vực tương ứng, tìm/lọc mục cần xử lý, xem chi tiết, nhập lý do nếu được yêu cầu, rồi lưu. Dòng vừa sửa được cập nhật ngay sau khi API xác nhận lưu thành công; không cần chuyển trang hay tải lại. Khi tab đang hiển thị, bảng tự đồng bộ thay đổi từ thiết bị hoặc phiên quản trị khác khoảng mỗi 20 giây và ngay khi bạn quay lại tab. Bảng dữ liệu hỗ trợ tìm kiếm trong dữ liệu đang tải, lọc trạng thái và xuất CSV. Trên màn hình nhỏ, nút menu mở sidebar; nhấn Escape hoặc chạm bên ngoài để đóng.

## Nếu trang không tải được dữ liệu

- **Không kết nối được máy chủ:** kiểm tra cửa sổ backend còn chạy và đang dùng đúng cổng `5002` (cloud) hoặc Emulator đang chạy (thường API ở cổng `5001`).
- **Không đăng nhập được:** dùng tài khoản đúng môi trường. Tài khoản mẫu `@ecoshare.test` chỉ dành cho Emulator; project thật cần tài khoản Admin đã được cấp quyền.
- **Báo không đủ quyền:** đăng nhập bằng tài khoản có quyền phù hợp. Không thể tự cấp quyền bằng cách sửa JavaScript hoặc cấu hình trên trình duyệt.
- **Vừa cập nhật giao diện nhưng vẫn thấy bản cũ:** nhấn `Ctrl+F5`, sau đó đăng nhập lại. Token đăng nhập chỉ được giữ trong bộ nhớ của trang.
- **Đang xem cloud hay Emulator không rõ:** cloud là cổng `5173` và có thể sửa dữ liệu thật; Emulator là cổng `5174` và dùng project demo.

## Tệp và tài liệu liên quan

- `backend.js`, `backend.css`: giao diện quản trị và kiểu dáng hiện tại. `styles.css` giữ thiết kế cũ để tham khảo.
- `firebase-client.js`, `firebase-config-loader.js`: đăng nhập, gọi API và chọn cấu hình theo địa chỉ trang.
- `scripts/configure-firebase.mjs`: tạo cấu hình client từ `app/google-services.json`.
- `tests/`: các trang kiểm tra trình duyệt; smoke test dùng Emulator, không dùng để ghi dữ liệu cloud.
- [Hướng dẫn backend/Firebase](../docs/firebase-backend.md): chạy cloud, Emulator, kiểm thử và giới hạn hiện tại.
- [Báo cáo giao diện Admin](../docs/admin-web-ui-review.md): ảnh và kết quả rà soát giao diện.
- [API quản trị nội dung](../docs/social-admin.md): chi tiết API bài viết, mẹo, bình luận và ảnh SCAN.

Không đưa mật khẩu, service account hay khóa thanh toán MoMo/VNPay vào file frontend hoặc kho mã nguồn. Cấu hình web chỉ chứa public Firebase client config; backend mới quyết định quyền và xử lý dữ liệu.
