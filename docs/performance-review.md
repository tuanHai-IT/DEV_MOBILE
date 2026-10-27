# Rà soát độ trễ Android — 20/10/2026

## Cập nhật 22/10/2026

- Trang đầu và các lần phân trang Android lấy tối đa 6 mục thay vì 3. Prefetch dùng cùng kích thước trang để màn hình tận dụng được cache; ảnh nền vẫn chỉ nạp trước tối đa 3 mục đầu. Các thẻ được thêm vào View theo nhóm tối đa 3 thẻ mỗi khung hình và chỉ khôi phục vị trí cuộn sau khi dựng xong. Điều này giảm số lượt API khi cuộn qua cùng một lượng nội dung, nhưng có thể tăng thời gian phản hồi của một trang trên mạng chậm.
- Admin web giữ bảng đang xem trong lúc tải lại cùng bộ lọc, chỉ thay nội dung khi dữ liệu mới thực sự khác và gom sự kiện gõ tìm kiếm theo `requestAnimationFrame`. Một lượt tải lỗi không xóa các hàng đã hiển thị.
- Build APK và Android test APK đạt; unit test đạt. `FirebasePrefetchCacheTest` trên giả lập đạt 8/8 ca. Kiểm tra DOM admin đạt 4/4 tình huống, gồm tải lại không làm trống bảng. Bộ `CommunityPagingUiTest` cần Firebase Emulator đã seed nên chưa xác minh thao tác cuộn trong lượt này; nó đã biên dịch thành công.
- Chưa có phép đo frame mới trên điện thoại thật sau thay đổi này. Mốc 60 FPS là mục tiêu cần đo trên thiết bị và luồng thao tác cụ thể, không thể kết luận từ build hoặc giả lập.

Đợt rà soát phân biệt thời gian app dựng giao diện, thời gian chờ API và thời gian máy ảo vẽ frame. Cả ba đều góp phần vào cảm giác phản hồi chậm.

## Nguyên nhân và thay đổi

- Trước đây đổi tab thay thế Fragment, dựng lại thẻ bài và chạy animation alpha/translate trên cả hai màn hình. Trang chủ, Khám phá, Tin nhắn và Hồ sơ nay giữ Fragment/View đã mở; tab ẩn ở trạng thái STARTED, dừng polling và theo dõi hồ sơ. Chuyển tab chính diễn ra ngay. Khi rời tài khoản, các tab cũ được loại bỏ. Với danh sách trên 18 hàng, app dùng lại snapshot thay vì giữ thêm một cây View lớn ở nền.
- Tất cả request JSON trước đây dùng một worker, nên lượt đọc chậm có thể chặn màn hình khác hoặc thao tác ghi. Các lượt đọc foreground nay có pool giới hạn 3 worker; đăng nhập và thao tác ghi vẫn giữ thứ tự. Request trùng đường dẫn vẫn gộp chung, token hết hạn chỉ refresh một lần, callback phiên cũ và phản hồi trước mutation vẫn bị loại bỏ.
- Ảnh đại diện trước đây có thể giải mã cùng kích thước tối đa 1600 px như ảnh bài viết. App nay lấy mẫu theo kích thước hiển thị, giải mã ở nền và giữ bitmap đã giải mã trong LRU tối đa 8 MiB mỗi Fragment. Việc đọc metadata video, ghi tệp video story và giải mã ảnh story cũng chuyển ra khỏi UI thread.
- Lưu hồ sơ mã hóa không còn chạy trên UI thread. Mã hóa thông tin phiên không còn giữ khóa dùng chung với các lượt đọc màn hình.
- Callback upload story kiểm tra View còn tồn tại và màn hình còn hiển thị trước khi cập nhật UI; sửa lỗi `body.removeAllViews()` sau khi đã rời màn hình.
- Backend đọc hồ sơ đã có bằng `get()` thay cho transaction chỉ để đọc. Kiểm tra token bị thu hồi chạy song song với đọc vai trò/trạng thái mới. `/me` và `/me/points` dùng lại snapshot của chính request; không cache quyền giữa các request. Các trạng thái hoàn thành thử thách được đọc theo nhóm và tác giả story trùng nhau chỉ đọc một lần.

Các tab được giữ vẫn cập nhật dữ liệu sau mutation: app đánh dấu snapshot cũ, giữ các hàng đang hiển thị và đọc bản mới ở nền khi quay lại. Đợt kiểm tra định kỳ đang có vẫn hoạt động trên màn hình hiện tại; không đổi sang chế độ chỉ đọc cache vô thời hạn.

## Số đo và giới hạn

Trên máy đang dùng, API local phản hồi phần kết nối rất nhanh, nhưng đọc Firestore cloud có độ trễ đáng kể: feed công khai khoảng 0,56–1,35 giây ở lượt đo ban đầu; ảnh 198 KiB khoảng 1,8 giây. Đo xen kẽ backend cũ/mới ở các route công khai không chứng minh được mức tăng tốc ổn định; thay đổi auth chủ yếu có tác dụng khi đăng nhập. Một phép đo cùng document cho thấy transaction chỉ đọc mất 1,32–2,20 giây so với `get()` 0,29–0,97 giây, nhưng đây không phải cam kết độ trễ cho mọi request.

Máy có RAM 16 GB, còn khoảng 1,23 GB trống tại thời điểm đo; AVD Pixel 6a ban đầu được cấp 8 GB RAM/4 CPU. Emulator dùng GPU RTX 3050 qua OpenGL translator. Trong kịch bản chuyển tab trước khi sửa, thời gian xử lý UI trung vị khoảng 0,33 ms nhưng chờ renderer khoảng 32,33 ms; do đó không thể quy toàn bộ độ khựng cho database. Số liệu frame trên emulator không đại diện cho điện thoại thật.

Kịch bản ba vòng Trang chủ → Khám phá → Hồ sơ → Trang chủ rồi cuộn, trước/sau sửa source trên cùng AVD 8 GB:

| Chỉ số | Trước | Sau |
| --- | ---: | ---: |
| Frame báo slow UI thread | 67 | 43 |
| UI work p90 | 2,36 ms | 1,84 ms |
| UI work lớn nhất trong buffer | 22,01 ms | 8,78 ms |
| Frame vượt hạn | 156/167 (93,4%) | 140/150 (93,3%) |

UI có cải thiện, nhưng tỷ lệ frame vượt hạn trên máy ảo vẫn cao. RAM trống của host còn thấp hơn trong lượt sau (~597 MiB), nên không dùng phép đo này để tuyên bố app đạt 60 fps. Đã dừng Gradle daemon nhàn rỗi do lượt build tạo ra, sao lưu cấu hình AVD tại `.qa/Pixel_6a-config-before-performance.ini`, đặt RAM Pixel 6a từ 8192 xuống 4096 MiB và cold boot. System image API 37 tự nâng mức 3072 MiB lên tối thiểu 4096 MiB, nên file cấu hình cũng được đặt đúng mức 4096. CPU/GPU được giữ nguyên. Dữ liệu app và phiên đăng nhập gốc được khôi phục sau kiểm thử.

Lượt cuối sau khi giảm RAM AVD/cold boot và giải phóng daemon, cùng kịch bản ba vòng chuyển tab + cuộn: 418 frame, 7 frame vượt hạn (**1,67%**), không có frame báo slow UI thread. Trong buffer 120 frame cuối, UI work p90 0,70 ms, chờ renderer trung vị 0,06 ms, thời gian frame trung vị 17,37 ms. Host còn khoảng 1,83 GiB RAM trống; GPU vẫn RTX 3050. Phiên đăng nhập còn nguyên, tiến trình app ổn định và không ghi nhận crash/Skipped frames mới. Đây là kết quả kết hợp source mới và môi trường đã điều chỉnh; không tách riêng tác dụng của cold boot với RAM, không đại diện benchmark điện thoại thật.

## Kiểm tra

- Build APK debug và APK instrumentation đạt; 17/17 kiểm thử JVM đạt.
- `FirebasePrefetchCacheTest` kiểm tra read độc lập không bị chặn bởi request chậm, thao tác ghi vẫn chạy, chỉ refresh token một lần, cache và callback không vượt phiên đăng nhập/mutation.
- `CommunityPagingUiTest.mainTabsKeepTheirViewsAndRefreshAfterAConfirmedChange` kiểm tra giữ cùng Fragment/View, ngừng tab ẩn, không đọc lại feed khi chỉ chuyển tab, cập nhật sau thay đổi và khôi phục đúng tab khi Activity được tạo lại.
- Các test UI tìm View trong primary navigation Fragment để không đọc nhầm View có cùng ID của tab ẩn.
- Tổng cộng 49 ca Android đã được xác minh qua lượt tổng thể và lượt chạy lại có mục tiêu: 47 đạt, 2 ca yêu cầu chế độ cloud/inline riêng được bỏ qua, không còn ca thất bại. Test lỗi mạng được cô lập khỏi snapshot SQLite của lần chạy trước; nhóm chạy lại lỗi mạng + story hoàn tất sau rotation đạt 3/3. Chỉ xóa snapshot thuộc scope Emulator trong test.
- Backend đã đạt 138/138 ca toàn bộ; sau hai kiểm thử bổ sung, nhóm auth/social đạt 20/20. Chỉ dùng Firebase Emulator cho dữ liệu kiểm thử.

Source backend mới đã chạy thử trên cổng 5003 và trả đúng dữ liệu cloud. Tiến trình backend cổng 5002 đang có cần được khởi động lại để dùng code mới: dừng phiên backend cũ rồi chạy `npm --prefix backend run dev:cloud`. Dữ liệu cloud được giữ nguyên trong đợt rà soát này.
