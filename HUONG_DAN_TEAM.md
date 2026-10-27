# EcoShare — bàn giao source GitHub cho team

Gói gồm source Android, backend, Admin Web, kiểm thử, tài liệu, schema và sơ đồ. `app/google-services.json` là cấu hình Firebase client và được kèm theo yêu cầu của chủ dự án. Không có token Firebase CLI, mật khẩu, service account, khóa ký ứng dụng hoặc khóa thanh toán trong gói.

## Đưa source lên GitHub

Giải nén, mở terminal trong thư mục `RecyclingShareApp`. Nếu đưa vào repo đã có, chép nội dung vào bản clone đang dùng và giữ nguyên thư mục `.git` của bản clone đó. Gói ZIP không kèm lịch sử Git và không tự xóa file cũ trong repo đích.

Nếu bắt đầu repo mới, chạy:

```powershell
git init
git add .
git status
git commit -m "Add EcoShare project source"
```

Sau đó kết nối remote của team và push nhánh vừa tạo. `.gitignore` trong gói cho phép `app/google-services.json`, bỏ qua IDE/build/cache/dependency và cấu hình riêng theo máy. Ảnh và sơ đồ trong gói dùng Git thông thường, không yêu cầu Git LFS. Cả `diagrams-current` và `diagrams-v2` được giữ vì bộ kiểm tra thiết kế đang đối chiếu cả hai.

## Cài đặt trên máy thành viên

- Android Studio, Android SDK Platform 37 và JDK đi kèm Android Studio; `local.properties` được tạo theo SDK của từng máy.
- Node.js 22, npm và Python 3 trong PATH. Không dùng các lệnh trỏ vào `.tools` của máy người gửi.
- Internet và tài khoản Google được chủ project cấp quyền vào Firebase project `recycling-share-app` để backend truy cập Firestore và Authentication. Mỗi người đăng nhập tài khoản Google riêng, không dùng mật khẩu/token của người gửi.

Từ thư mục gốc:

```powershell
node --version
npm --prefix backend ci
.\backend\node_modules\.bin\firebase.cmd login
.\backend\node_modules\.bin\firebase.cmd projects:list
```

Tài khoản Google phải nhìn thấy đúng project và có quyền cần thiết. Quyền Firebase của người phát triển khác với tài khoản/quyền Admin bên trong ứng dụng EcoShare.

## Chạy backend cloud

PowerShell thứ nhất, ở thư mục gốc:

```powershell
$env:GCLOUD_PROJECT='recycling-share-app'
$env:FIRESTORE_EMULATOR_HOST=$null
$env:FIREBASE_AUTH_EMULATOR_HOST=$null
$env:FIREBASE_STORAGE_EMULATOR_HOST=$null
npm --prefix backend run dev:cloud
```

Giữ terminal mở. API là `http://127.0.0.1:5002/v1`; dữ liệu nằm trên Firebase cloud của project đang dùng.

## Chạy Admin Web

PowerShell thứ hai, ở thư mục gốc:

```powershell
$env:GCLOUD_PROJECT='recycling-share-app'
node admin-web/scripts/configure-firebase.mjs --local-cloud
python -m http.server 5173 --directory admin-web --bind 127.0.0.1
```

Mở `http://127.0.0.1:5173/` và đăng nhập bằng tài khoản EcoShare có quyền Admin. File `admin-web/firebase-config.local.js` được sinh trên máy và tiếp tục bị Git bỏ qua.

## Chạy Android

Mở thư mục gốc bằng Android Studio, Sync Gradle rồi chạy bản debug trên Android Emulator cùng máy backend. Bản debug project này tự gọi API máy tính qua `http://10.0.2.2:5002/v1`; Firebase Auth và Firestore vẫn dùng cloud. Điện thoại thật cần cấu hình kết nối riêng. Nếu cần đăng nhập Google trên máy mới, đăng ký SHA-1/SHA-256 của chứng chỉ debug máy đó vào Firebase và cập nhật cấu hình OAuth khi cần; email/mật khẩu dùng luồng Firebase Auth hiện có.

## Kiểm tra và phạm vi

`python tools/validate_design.py` kiểm tra mô hình, XML và các bộ sơ đồ. Các lượt kiểm thử tích hợp backend/Android cần môi trường Emulator riêng theo `docs/firebase-backend.md`; chúng không tự chạy chỉ bằng việc giải nén. Khởi chạy Firebase Emulator cũng không tự chuyển app Android thông thường sang chế độ Emulator. Thanh toán MoMo/VNPay trong Android là demo, không chuyển tiền thật.

Chỉ các điều chỉnh bàn giao `.gitignore`, thuộc tính Git và tài liệu được áp dụng trong gói này; nghiệp vụ/source runtime được giữ nguyên tại thời điểm đóng gói.
