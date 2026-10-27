# Khai báo tài khoản nhận tiền — 27/10/2026

Trong **Hồ sơ → Tài khoản nhận tiền** hoặc **Cài đặt → Tài khoản nhận tiền**, người dùng khai báo một tài khoản ngân hàng hoặc ví MoMo. Màn đăng bán kiểm tra lại dữ liệu từ máy chủ trước khi mở form. Nếu chưa khai báo, nút **Khai báo tài khoản nhận tiền** dẫn đến form; lưu thành công sẽ quay về màn đăng bán.

Người dùng có thể cập nhật tài khoản đã khai báo. Dữ liệu này chưa được ngân hàng/MoMo xác minh quyền sở hữu; không phải liên kết ví, tài khoản merchant hoặc dịch vụ chi trả. Thanh toán MoMo/VNPay trên Android vẫn là demo.

Ảnh giao diện từ Android Emulator với dữ liệu kiểm thử: [Ngân hàng](previews/payout-account/bank.png) · [MoMo](previews/payout-account/momo.png).

## API và dữ liệu

- `GET /me/payout-account`: cần đăng nhập, chỉ lấy thông tin của chính tài khoản đang đăng nhập. Response `{payout_account: record|null, payout_account_ready: boolean}`.
- `PUT /me/payout-account`: thay thế thông tin khai báo sau khi validation thành công. Ngân hàng: `{method:"BANK", bank_name, account_number, account_holder}`. MoMo: `{method:"MOMO", phone, account_holder}`. Không nhận UID, cờ xác minh hoặc ngày cập nhật do client gửi.
- Ngân hàng: tên ngân hàng và tên chủ tài khoản 2–100 ký tự, số tài khoản 6–30 chữ số; giữ nguyên số 0 đầu. MoMo: số điện thoại 10 chữ số bắt đầu bằng `0`, hoặc định dạng tương đương `84`/`+84`; server chuẩn hóa về đầu `0`. Validation chỉ kiểm tra cấu trúc khai báo.
- Server tự ghi `updated_at` và lưu bản ghi riêng tư tại `users/{uid}._payout_account`. Không thêm collection/DTO SQL mới. `/me` chỉ thêm cờ `payout_account_ready`; hồ sơ công khai và response quản trị người dùng không trả thông tin tài khoản nhận tiền. Quyền đọc trực tiếp Firestore `users` vẫn theo rules hiện có: chính chủ hoặc Admin dự án được cấp quyền.
- Android đọc dữ liệu này bằng request mới; không đưa vào cache trang, SQLite nội dung công khai hoặc hồ sơ phiên. Form không lưu số tài khoản vào instance state/autofill.

## Điều kiện đăng bán

Backend đọc user trong cùng transaction và trả `403 PAYOUT_ACCOUNT_REQUIRED` nếu khai báo thiếu/không hợp lệ khi:

1. Tạo tin bán mới qua `POST /listings`.
2. Sửa tin bán để gửi lại hàng chờ duyệt qua `PATCH /listings/:id`.
3. Sửa thông tin sản phẩm khác tồn kho qua `PATCH /listing-items/:id`.
4. Quản trị viên duyệt tin sang `APPROVED`.

Điều kiện xác minh danh tính người bán hiện có vẫn được giữ. Cập nhật chỉ riêng tồn kho được phép để quản lý tin cũ. Request lặp lại khóa idempotency của một tin đã tạo trả lại kết quả cũ, không tạo thêm tin; khai báo là bắt buộc trước lần tạo mới. Tin cũ không bị tự động xóa hoặc ẩn, nhưng cần khai báo trước khi gửi lại/được duyệt.

## Kiểm tra

Backend có test validation, phân quyền, quyền riêng tư, cập nhật ngân hàng/MoMo, chặn tạo/gửi lại/duyệt và bảo toàn dữ liệu khi lưu sai. Android có test điều hướng từ cài đặt, chặn form đăng bán, lưu rồi tiếp tục đăng, đổi phương thức, tải lại dữ liệu và thử lại sau lỗi mạng. Các test tích hợp chạy trên project Emulator `demo-recycling-share`; không dùng tài khoản ngân hàng thật hoặc ghi lên cloud.

Kết quả ngày 27/10/2026: backend **156/156 đạt** (gồm 9 test khai báo mới), Android JVM **14/14 đạt**, UI khai báo **3/3 đạt**, kiểm tra thiết kế **14/14 đạt**; `assembleDebug` và `lintDebug` thành công, lint còn 1.026 cảnh báo và 0 lỗi. Lượt instrumentation chung đầu tiên chạy 52 ca, có 2 ca lỗi do selector mới chưa đồng bộ và thiếu API inline-media cổng 5003. Sau khi sửa selector/khởi chạy API test, chạy lại lớp UI khai báo 3/3 và lớp inline-media 1/1 đều đạt; không tính lượt đầu thành 52/52 đạt.

Các gói phân công ngày 23/10/2026 là snapshot cũ. Gói cập nhật ngày 27/10 chỉ bổ sung/thay các file liên quan; nhóm cần đưa các file cập nhật vào repo hoặc chép đè đúng đường dẫn trong bản clone, rồi build lại app và khởi động lại backend. Cơ sở dữ liệu hiện có không cần migration; tài khoản chưa khai báo sẽ được hướng dẫn khai báo khi đăng bán.
