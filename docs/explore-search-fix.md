# Sửa lỗi tìm kiếm Khám phá — 30/10/2026

## Nguyên nhân

`GET /explore/search?q=T&limit=50` trả HTTP 500 trên Firebase cloud trong khi danh sách mẹo vẫn tải được. Kiểm tra riêng từng truy vấn xác nhận Firestore trả mã 9 và yêu cầu chỉ mục cho cả nội dung lẫn tin bán.

Truy vấn tìm kiếm cũ sắp xếp `created_at DESC` nhưng không nêu thứ tự ID. Firestore mặc định sắp xếp `__name__` cùng chiều với trường sắp xếp cuối; chỉ mục feed hiện có lại kết thúc bằng `__name__ ASC`. Tin bán còn thiếu chỉ mục kết hợp trạng thái và thời gian. Firebase Emulator không thực thi yêu cầu composite index như cloud nên các ca cũ chưa phát hiện vấn đề này. Xem [cách Firestore sắp xếp chỉ mục](https://firebase.google.com/docs/firestore/query-data/index-overview).

Thông báo `Idempotency-Key` xuất hiện do error handler dùng cùng một câu cho mọi lỗi nội bộ; đây không phải yêu cầu bổ sung khóa chống gửi trùng cho thao tác tìm kiếm GET.

## Thay đổi

- `backend/src/social.ts`: cả hai truy vấn đều nêu rõ `created_at DESC`, sau đó `__name__ ASC`, phù hợp với thứ tự kết quả và chỉ mục feed.
- `firestore.indexes.json`: bổ sung chỉ mục `listings(status ASC, created_at DESC, __name__ ASC)` cho source mới. Đồng thời khai báo hai chỉ mục với đuôi `__name__ DESC` cho truy vấn tìm kiếm của backend đang chạy và các bản bàn giao cũ. Giữ cả hai chiều giúp cập nhật không bắt buộc mọi máy trong nhóm khởi động lại backend cùng lúc.
- `backend/src/app.ts`: lỗi GET/HEAD/OPTIONS có thông báo tải dữ liệu thông thường; lỗi thao tác ghi hướng dẫn kiểm tra trạng thái trước khi thử lại. Không đưa chi tiết SDK hoặc khóa kỹ thuật vào thông báo sản phẩm.
- `backend/test/search-regression.test.ts`: thêm kiểm tra Unicode/hoa thường, nội dung công khai so với ẩn/riêng tư, giá/ảnh/tác giả tin bán, giới hạn và thứ tự khi trùng thời gian; kiểm tra thông báo lỗi GET không lộ chi tiết nội bộ.

Giữ nguyên hai cửa sổ ứng viên tối đa 100 bản ghi, lọc `PUBLISHED`/`APPROVED` ở Firestore và giới hạn kết quả chung. Không chuyển sang quét toàn bộ dữ liệu hoặc bỏ điều kiện quyền để né chỉ mục. Đây vẫn là tìm chuỗi trong phạm vi ứng viên, chưa phải full-text search cho toàn bộ kho dữ liệu.

## Áp dụng

Chỉ mục cần được tạo trên đúng project và đạt trạng thái `READY`. Việc chỉ thêm JSON vào Git không tự tạo chỉ mục trên Firebase. Bản cloud hiện tại được bổ sung đúng các chỉ mục tìm kiếm, không thay Rules hoặc bản ghi nghiệp vụ.

Hai chỉ mục tương thích cho phép phiên backend cũ tiếp tục phục vụ tìm kiếm. Source TypeScript và thông báo lỗi mới được dùng sau lần build/khởi động backend tiếp theo; sửa chỉ mục cloud không tự nạp lại code của một tiến trình Node đang chạy.

## Kiểm tra

Bộ backend chạy với Auth/Firestore/Storage Emulator của `demo-recycling-share`: **159/159 ca đạt, 13 suite, 0 lỗi, 0 bỏ qua**. Không cộng các ca con vào tổng lần nữa. Log cục bộ: `.qa/search-fix/backend-tests.log`.

Ngoài Emulator, cần kiểm tra riêng truy vấn trên Firestore cloud, HTTP tìm kiếm và giao diện Android sau khi các chỉ mục sẵn sàng. Các phép kiểm tra cloud dùng GET, không tạo/sửa/xóa bài, tin bán, đơn hoặc tài khoản.

Đã xác nhận cả ba chỉ mục bổ sung ở trạng thái `READY`. Với phiên backend cloud hiện tại, tìm `T` trả HTTP 200 và 6 kết quả thuộc TIP, CHALLENGE, LISTING; giới hạn 3 trả tối đa 3 mục, từ khóa không khớp trả danh sách rỗng. Trên Pixel 6a đang chạy app, nhập lại `T` và gửi tìm kiếm hiển thị các thẻ kết quả, không còn thẻ lỗi. Backend cũ được giữ hoạt động trong suốt quá trình áp dụng chỉ mục.
