# Sửa lỗi tải dữ liệu chập chờn — 19/10/2026

App từng báo chung “Không kết nối được máy chủ” khi mở Mẹo hay. Đã ghi nhận EOF trước khi nhận HTTP headers trong chính tiến trình app đang dùng, với API `10.0.2.2:5002`. Quyền mạng local đã được cấp, ping máy tính 1–3 ms và API trên máy tính vẫn trả HTTP 200. Chưa xác định thành phần nào đóng kết nối ban đầu; các bằng chứng này chưa đủ để kết luận lỗi do Internet, Firebase hoặc server ngừng chạy.

## Thay đổi

- GET JSON và tải ảnh gặp EOF/reset được thử lại đúng một lần bằng socket mới. Khi đăng xuất, đổi phiên hoặc hủy request, không retry hay trả callback của phiên cũ.
- Không tự gửi lại POST/PATCH/PUT/DELETE vì lỗi mạng: request có thể đã được server xử lý. Lỗi HTTP, timeout, TLS, DNS, thiếu quyền hoặc kết nối bị từ chối không kích hoạt nhánh phục hồi GET này.
- Vùng nội dung hiển thị lỗi cụ thể và cho chạm để tải lại. Lỗi đến muộn từ tab Mẹo hay cũ không thay trạng thái của Chợ đồ cũ đang mở.
- Feed chỉ đọc `mime_type` của bản ghi ảnh trong Firestore; ID ảnh vẫn có trong snapshot. Trước đây truy vấn tải cả byte ảnh rồi bỏ đi trước khi trả JSON. Một ảnh TIP cloud mẫu tải dư 107.785 byte; phép chiếu mới loại bỏ phần byte ảnh này. Bộ lọc READY và kiểm tra quyền SCAN không đổi.
- Logcat debug dùng tag `EcoShareNetwork`, chỉ ghi loại lỗi, phương thức, nhóm đích và mẫu route. Không ghi URL đầy đủ, query, ID tài liệu, token, mật khẩu, request/response body hay thông báo ngoại lệ có thể chứa dữ liệu riêng.

Giữ timeout và kiểm tra TLS hiện có. Việc làm mới ID token khi API trả 401 là cơ chế Auth riêng, không phải thử lại lỗi kết nối.

## Kiểm chứng

| Phạm vi | Kết quả |
| --- | --- |
| Android đầy đủ với Emulator/fixture local | 25/25 đạt, 0 lỗi, 0 bỏ qua: 15 ca có sẵn + 8 ca socket/lỗi mạng + 2 ca UI |
| Android chỉ đọc cloud, lượt riêng | 1/1 đạt, 0 lỗi, 0 bỏ qua: health và 3 vòng tips/posts, nghỉ 6,5 giây giữa các vòng; không đăng nhập hoặc ghi cloud |
| JVM | 17/17 đạt |
| Backend liên quan | 20/20 đạt: social, social-app, inline-media |
| API cloud đọc so sánh | JSON `/posts` và `/tips` trước/sau giống nhau, gồm metadata ảnh; SCAN riêng tư chưa đăng nhập vẫn trả 401 |
| Backend đầy đủ trước thay đổi này | 127/127 đạt ở lượt trước; chưa chạy lại toàn bộ trong lần sửa mạng |

Fixture socket kiểm tra GET phục hồi bằng kết nối mới, EOF lặp lại chỉ thử tối đa hai lần, POST không gửi lại, timeout không retry, HTTP 503 giữ đúng lỗi, đăng xuất ngăn retry/callback cũ và metadata log không lộ query/ID. Fixture chạy loopback trong thiết bị, không sử dụng tài khoản hoặc ghi dữ liệu cloud. Hai kiểm thử UI xác nhận hiển thị lỗi/tải lại và bỏ qua lỗi tab cũ.

Kiểm thử chỉ đọc cloud bổ sung đã ghi nhận hai lần EOF trước headers ở hai vòng sau thời gian nghỉ. Cả hai lần đều được phục hồi; ba vòng đều tải thành công 2 TIP và 3 POST. Đây là bằng chứng phục hồi thực qua backend Spark, ngoài tình huống socket giả lập. Vẫn chưa kết luận thành phần gây đóng kết nối ban đầu, và ca GET công khai không chứng minh toàn bộ luồng đã đăng nhập.

Log cục bộ nằm trong `.qa/network-full-android-results.xml`, `.qa/network-full-android-tests.txt`, `.qa/network-transport-tests.txt`, `.qa/network-social-metadata-tests.txt` và `.qa/network-social-cloud-projection-readback.txt`. Lượt cloud riêng có `.qa/network-spark-readonly-results.xml` và `.qa/network-spark-readonly-evidence.txt`; tổng hợp tại `.qa/network-final-counts.json`. Thư mục `.qa` được loại khỏi Git. Không đưa mật khẩu hoặc token vào báo cáo.

Backend 5002 đã được khởi động lại để nạp bản tối ưu truy vấn ảnh. APK mới đã cài cập nhật bằng `install -r` trên thiết bị người dùng, giữ dữ liệu và mở ổn định; phiên trong bộ nhớ cần đăng nhập lại.

## Nếu tiếp tục gặp lỗi

Giữ terminal backend Spark chạy:

```powershell
npm.cmd --prefix backend run dev:cloud
```

Kiểm tra trên máy tính:

```powershell
Invoke-RestMethod http://127.0.0.1:5002/v1/health
Invoke-RestMethod http://127.0.0.1:5002/v1/tips
```

Trong app debug của project `recycling-share-app`, kết nối Spark được chọn tự động; cho phép mạng nội bộ nếu Android yêu cầu. `10.0.2.2` là địa chỉ máy phát triển dành cho Android Emulator; chưa có backend public cho điện thoại dùng độc lập. Khi app bị kết thúc để cập nhật APK, phiên trong bộ nhớ mất và cần đăng nhập lại; không cần đặt lại mật khẩu.

Thông báo “kiểm tra server đang chạy” tương ứng không kết nối được backend local; “máy chủ phản hồi chậm” tương ứng timeout; thiếu quyền sẽ có hướng dẫn cấp quyền. Chạm thông báo trong vùng nội dung để thử tải lại. Để chẩn đoán bản debug, chọn tag `EcoShareNetwork` trong Logcat thay vì sao chép thông tin tài khoản.

Phạm vi đầy đủ tại [verification.md](verification.md); lỗi tự thoát do dọn TLS trên main thread ở lượt trước được ghi riêng tại [android-login-fix.md](android-login-fix.md).
