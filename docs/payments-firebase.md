# Thanh toán demo và adapter MoMo/VNPay chưa bật

**Chế độ ứng dụng hiện tại: chỉ demo.** Nút **Thanh toán thử · Demo** trong chi tiết đơn cho chọn MoMo hoặc VNPay và hiển thị kết quả mô phỏng ngay trong app. App không gọi API tạo phiên thanh toán, không mở cổng thanh toán, không chuyển tiền và không đổi trạng thái đơn hàng trên máy chủ. Backend vẫn giữ adapter MoMo/VNPay ở trạng thái tắt để tham khảo nếu sau này quyết định tích hợp thanh toán thật; phần cấu hình bên dưới chưa cần thực hiện cho bản demo.

Từ 27/10/2026, người bán phải [khai báo tài khoản nhận tiền](payout-account.md) ngân hàng hoặc MoMo trước khi tạo/gửi lại tin bán và trước khi tin được duyệt. Đây là thông tin tự khai báo được lưu riêng tư; không xác minh quyền sở hữu tài khoản hoặc thực hiện chi trả. Người dùng khai báo trong Hồ sơ/Cài đặt; backend kiểm tra điều kiện trong transaction.

Backend lưu dữ liệu giao dịch trong Cloud Firestore, chỉ server dùng Firebase Admin SDK được ghi `payments`, `orders`, `order_items` và sổ điểm. Ứng dụng gửi Firebase ID token qua `Authorization: Bearer <token>`. Người mua và người bán phải có tài khoản ACTIVE, hồ sơ VERIFIED còn hạn trước khi tạo phiên thanh toán.

Chưa có merchant credentials trong project. Mặc định các cổng thật đều tắt; backend trả HTTP 503 khi cổng chưa bật hoặc thiếu cấu hình. `EMULATOR` là phương thức thử riêng, chỉ tồn tại khi backend kết nối đồng thời Auth, Firestore và Storage Emulator. Nó không thu tiền.

Với backend Firebase Functions hiện tại, triển khai callback/IPN công khai cần dự án Firebase ở gói Blaze; trên Spark, Functions chỉ chạy thử bằng Emulator trên máy phát triển. Nếu muốn giữ Firebase Spark, cần chuyển các API thanh toán sang một backend riêng có HTTPS công khai và nơi lưu khóa merchant an toàn. Đừng bật thanh toán thật khi callback chưa có URL HTTPS công khai và merchant sandbox chưa được kiểm thử đầu cuối.

## Cấu hình triển khai

Biến môi trường cho Functions, ví dụ trong file `.env.<projectId>` nằm trong `backend/` và được gitignore:

```dotenv
ENABLED_PAYMENT_PROVIDERS=MOMO,VNPAY
PAYMENT_MODE=sandbox
PAYMENT_RETURN_URL=https://<projectId>.web.app/payment-return.html
PAYMENT_IPN_BASE_URL=https://<projectId>.web.app/api/v1
MOMO_PARTNER_CODE=<merchant-code>
VNPAY_TMN_CODE=<merchant-code>
```

`PAYMENT_RETURN_URL` phải trỏ tới trang/app link HTTPS của bạn. Project có `admin-web/payment-return.html` hiển thị trạng thái đang chờ đối soát. Client mở lại đơn và truy vấn API để lấy trạng thái; trang trở về không kết luận đã trả tiền từ query string.

Trên Android, kết quả thanh toán thử chỉ được lưu cục bộ và luôn gắn nhãn **Demo**. Đơn hàng thật vẫn ở trạng thái `PENDING_PAYMENT`; người bán không thể xác nhận gửi hàng từ kết quả mô phỏng này.

`PAYMENT_IPN_BASE_URL` là **gốc REST đầy đủ**, không có query string. Có thể dùng Firebase Hosting `/api/v1` như trên hoặc URL trực tiếp `https://asia-southeast1-<projectId>.cloudfunctions.net/api/v1`.

Đặt khóa qua Google Secret Manager/Firebase CLI, không đưa khóa thật vào source, ứng dụng Android hay Admin web:

```powershell
node backend/node_modules/firebase-tools/lib/bin/firebase.js functions:secrets:set MOMO_SECRET_KEY --project <projectId>
node backend/node_modules/firebase-tools/lib/bin/firebase.js functions:secrets:set MOMO_ACCESS_KEY --project <projectId>
node backend/node_modules/firebase-tools/lib/bin/firebase.js functions:secrets:set VNPAY_HASH_SECRET --project <projectId>
```

Chỉ đặt và bind secret cho các cổng thực sự bật. Sau khi có credentials sandbox từ merchant portal, deploy Functions và thử với tài khoản kiểm thử của cổng. Đổi `PAYMENT_MODE=production` chỉ sau khi cấu hình merchant production và đối soát thử thành công. Adapter gọi các host chính thức cố định theo mode; client không được chọn host/redirect/callback URL.

Giữ credentials cũ và cổng hoạt động cho đến khi đối soát xong các giao dịch đang chờ. Backend kiểm tra merchant của mỗi payment với merchant hiện tại; thay merchant giữa chừng sẽ yêu cầu xử lý/đối soát bằng cấu hình gốc.

## API

Các đường dẫn dưới đây nối vào `/api/v1` trên Hosting hoặc `/v1` trên URL Functions. Response payment dùng `{ "data": { ... } }`; danh sách dùng `{ "data": [ ... ] }`.

| API | Quyền và hành vi |
| --- | --- |
| `POST /orders/:id/payment-sessions` | Người mua của đơn. Bắt buộc `Idempotency-Key`. Body chỉ nhận `provider`. Server lấy tổng tiền từ đơn và kiểm tra giữ tồn, thời hạn, xác minh của cả hai bên. |
| `GET /orders/:id/payments` | Người mua, người bán của đơn hoặc ADMIN. Trả tối đa 50 bản ghi. |
| `POST /payments/momo/ipn` | Callback công khai cho server MoMo; xác minh chữ ký, merchant, reference, số tiền. Không yêu cầu token người dùng. |
| `GET /payments/vnpay/ipn` | Callback công khai cho VNPay; xác minh chữ ký, merchant, reference, số tiền và mã trạng thái. |
| `POST /admin/payments/:id/refund` | ADMIN. `:id` là payment CHARGE thành công. Body `{ "reason": "Lý do tối thiểu 10 ký tự" }`; chỉ hoàn toàn bộ, không nhận số tiền client gửi. |
| `POST /admin/payments/:id/reconcile` | ADMIN. Truy vấn server cổng và cập nhật kết quả đã kiểm tra. Với hoàn tiền MoMo, `:id` là payment REFUND mới. |
| `POST /emulator/payments/:id/result` | Chỉ được đăng ký khi dùng Emulator, chỉ ADMIN và chỉ payment có provider `EMULATOR`. Body `{ "status": "SUCCEEDED" }`, `FAILED` hoặc `PENDING`. |

Tạo phiên thanh toán:

```http
POST /api/v1/orders/<orderId>/payment-sessions
Authorization: Bearer <firebaseIdToken>
Idempotency-Key: checkout_20261018_001
Content-Type: application/json

{"provider":"MOMO"}
```

Body tương tự với `VNPAY`. Khi thử local, dùng `EMULATOR`, đọc `data.id`, rồi dùng token ADMIN gọi route kết quả Emulator. `data.pay_url` của cổng thật được mở bằng trình duyệt hoặc app link phù hợp. URL `emulator://payments/...` chỉ là chỉ dấu phiên thử, không phải trang checkout thực.

Đăng ký IPN VNPay tại merchant portal là `https://<projectId>.web.app/api/v1/payments/vnpay/ipn`. MoMo nhận IPN URL khi backend tạo request, từ `PAYMENT_IPN_BASE_URL` cộng `/payments/momo/ipn`. Return URL và IPN URL có nhiệm vụ riêng; return URL không ghi nhận doanh thu.

## Nhất quán tài chính và tồn kho

Payment có `kind=CHARGE` hoặc `REFUND`, trạng thái `PENDING`, `SUCCEEDED`, `FAILED`, `CANCELLED`. Hoàn tiền là bản ghi mới có `parent_payment_id`; bản ghi thu tiền gốc vẫn SUCCEEDED. Mọi số tiền là số nguyên VND; chỉ adapter VNPay nhân/chia 100 khi giao tiếp cổng.

Khóa idempotency tạo payment ID ổn định. Một đơn chỉ có một phiên đang chờ; không được mở lần trả tiền mới khi kết quả cũ còn không rõ. Timeout không biến thành thất bại và không giải phóng tồn kho. Gửi lại cùng yêu cầu với cùng khóa hoặc đối soát bằng ADMIN; refund MoMo dùng reference ổn định để gửi lại cùng thao tác khi cần, không tạo bản hoàn mới.

Callback hợp lệ cập nhật payment và đơn trong một transaction. Gọi lặp không cộng/ghi nhận lần hai; kết quả thất bại đến muộn không hạ trạng thái thành công. Receipt kỹ thuật nằm trong `system_settings/receipt_*`, chống tái sử dụng cùng mã giao dịch cổng cho nhiều payment. Đây không phải cấu hình được sửa trong Admin Panel.

Nếu cổng đã thu tiền nhưng xác minh bị thu hồi, đơn đã hết hạn, giữ tồn được giải phóng hoặc có payment khác, backend vẫn ghi CHARGE SUCCEEDED và đưa đơn sang DISPUTED để kiểm tra/hoàn tiền. VNPay báo giao dịch đáng ngờ đã trừ tiền cũng được ghi nhận và giữ đơn ở DISPUTED. Các mã đang xử lý/không nhận biết tiếp tục PENDING, tránh cho thanh toán lại khi chưa rõ kết quả.

Hoàn toàn bộ trước khi giao hàng khôi phục tồn và giảm `_reserved` đúng một lần nếu không còn charge thành công chưa hoàn khác. Sau khi đã giao/hoàn tất, backend không tự đưa hàng vào tồn: cần quy trình nhận lại hàng. Khi sổ điểm đã cấp điểm cho đơn, hoàn tiền tạo bút toán âm có khóa chống trùng và điều chỉnh số dư. Tồn kho/sổ điểm hỏng được đánh dấu để quản trị kiểm tra; không bỏ mất sự kiện hoàn tiền thực từ cổng.

## Giới hạn hiện tại

- MoMo: đã có tạo checkout, IPN, query, yêu cầu hoàn toàn bộ và query hoàn. Yêu cầu hoàn chỉ tạo trạng thái chờ; cần gọi reconcile để xác nhận kết quả từ cổng. Chưa có lịch đối soát tự động.
- VNPay: đã có URL checkout HMAC-SHA512, IPN và QueryDr có kiểm tra chữ ký phản hồi. Yêu cầu hoàn qua API hiện trả HTTP 503 `REFUND_PROVIDER_UNAVAILABLE` trước khi ghi dữ liệu; cần hoàn qua merchant portal và bổ sung adapter sau khi thống nhất hợp đồng/quy trình merchant.
- Chưa kiểm thử với merchant sandbox/production thật vì chưa có credentials. Các kiểm thử tự động xác minh tính toàn vẹn chữ ký, quyền truy cập, luồng Emulator và tính nhất quán trong Firestore; chúng không thay thế kiểm thử merchant.
- Cổng thanh toán không mặc định cung cấp escrow hoặc tự chia tiền cho từng người bán. Settlement/payout cần cấu hình và hợp đồng riêng, chưa nằm trong adapter hiện tại.

## Tài liệu giao thức

Đã kiểm tra tài liệu chính thức ngày 18/10/2026: [MoMo checkout và IPN](https://developers.momo.vn/v3/docs/payment/api/wallet/onetime/), [MoMo query](https://developers.momo.vn/v3/docs/payment/api/payment-api/query/), [MoMo refund](https://developers.momo.vn/v3/docs/payment/api/payment-api/refund/), [MoMo result codes](https://developers.momo.vn/v3/docs/payment/api/result-handling/resultcode/), [VNPay checkout/IPN](https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html), [VNPay QueryDr/refund](https://sandbox.vnpayment.vn/apis/docs/truy-van-hoan-tien/querydr%26refund.html).
