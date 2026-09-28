# ♻️ Recycling Share App

> Ứng dụng kết nối cộng đồng để chia sẻ, trao tặng và tái chế đồ dùng — giảm rác thải, tiết kiệm tài nguyên, sống xanh mỗi ngày.

---

## 📖 Giới thiệu

**Recycling Share App** là ứng dụng di động cho phép người dùng đăng tải, chia sẻ và trao tặng những vật dụng không còn sử dụng (quần áo, sách vở, đồ điện tử, đồ gia dụng, vật liệu tái chế…) cho những người có nhu cầu, kết nối người cho và người nhận ngay trong cộng đồng, đồng thời kết nối với các điểm thu gom rác tái chế gần nhất.

Dự án được thực hiện trong khuôn khổ **đồ án môn học** nhằm ứng dụng kiến thức phân tích, thiết kế hệ thống và phát triển phần mềm vào một bài toán thực tế về môi trường.

## 🎯 Vấn đề & Mục tiêu

**Vấn đề**
- Nhiều đồ dùng còn sử dụng được bị vứt bỏ do không biết trao tặng cho ai.
- Người dân thiếu thông tin về cách phân loại rác và địa điểm thu gom tái chế.
- Thiếu cơ chế đánh giá và kiểm duyệt nên khó tin tưởng khi trao đổi với người lạ.
- Chưa có kênh tập trung, tin cậy và dễ dùng để kết nối người cho – người nhận.

**Mục tiêu**
- Xây dựng nền tảng chia sẻ đồ dùng cũ nhanh chóng, minh bạch.
- Khuyến khích thói quen phân loại rác và tái chế trong cộng đồng.
- Đo lường và ghi nhận đóng góp xanh của từng người dùng.
- Tăng độ tin cậy nhờ đánh giá người dùng, báo cáo vi phạm và kiểm duyệt của quản trị viên.

## ✨ Tính năng chính

| Nhóm | Tính năng |
|------|-----------|
| 👤 Tài khoản & phân quyền | Đăng ký / đăng nhập / đăng xuất, hồ sơ cá nhân, địa chỉ (Thành phố – Quận/Huyện), phân quyền theo vai trò |
| 📦 Bài đăng & đồ tái chế | Tạo / sửa / xóa bài đăng gồm nhiều món đồ (danh mục, chất liệu, tình trạng, số lượng, đơn vị), ảnh, video, thẻ tag, vị trí |
| 🔍 Tìm kiếm & tương tác | Tìm theo từ khóa, danh mục, thành phố, khoảng cách và sắp xếp; lịch sử tìm kiếm và xem; thích, bình luận, yêu thích, chia sẻ bài đăng |
| 🤝 Yêu cầu & trao đổi | Gửi / hủy yêu cầu nhận đồ, người cho duyệt / từ chối, đặt lịch và địa điểm giao nhận, xác nhận hoàn tất |
| 💬 Chat & thông báo | Nhắn tin giữa các bên (kèm tệp đính kèm), thông báo theo loại |
| ⭐ Đánh giá & báo cáo | Đánh giá người dùng sau trao đổi theo tiêu chí; báo cáo bài đăng / người dùng kèm lý do và bằng chứng |
| 🗺️ Bản đồ | Hiển thị vị trí bài đăng, điểm thu gom, trung tâm tái chế gần bạn |
| 🌱 Điểm xanh | Tích điểm khi chia sẻ / tái chế, bảng xếp hạng cộng đồng |
| 📚 Kiến thức | Hướng dẫn phân loại rác, mẹo tái chế và tái sử dụng |
| 🛡️ Quản trị | Duyệt / từ chối bài, khóa người dùng, xử lý báo cáo, quản lý danh mục, nhật ký và cấu hình hệ thống |

## 👥 Đối tượng sử dụng

- **Người dùng (người cho / người nhận):** sinh viên, hộ gia đình, cộng đồng khu dân cư.
- **Điểm thu gom / tổ chức tái chế:** đăng thông tin, nhận đồ tái chế.
- **Quản trị viên:** duyệt bài đăng, khóa tài khoản, xử lý báo cáo, quản lý danh mục và hệ thống.

## 🔄 Luồng hoạt động

1. Người dùng đăng bài chia sẻ gồm một hoặc nhiều món đồ.
2. Quản trị viên duyệt bài; bài được duyệt sẽ hiển thị để người khác tìm kiếm theo từ khóa, danh mục, thành phố.
3. Người nhận gửi yêu cầu nhận đồ và trao đổi qua tin nhắn.
4. Người cho duyệt yêu cầu; hai bên chốt lịch hẹn và địa điểm giao nhận.
5. Hoàn tất trao đổi → hai bên đánh giá lẫn nhau và nhận điểm xanh.

## 🛠️ Công nghệ sử dụng

> _Cập nhật theo công nghệ thực tế của nhóm._

- **Ngôn ngữ / Nền tảng:** Java, Android (giao diện XML)
- **IDE:** Android Studio
- **Backend:** `<Firebase / REST API (Spring Boot, Node.js)>`
- **Cơ sở dữ liệu:** `<MySQL / SQL Server / Firestore>`
- **Bản đồ:** `<Google Maps API / OpenStreetMap>`
- **Công cụ thiết kế:** `<Figma, draw.io, StarUML>`

## 📁 Cấu trúc thư mục

```
recycling-share-app/
├── app/
│   └── src/main/
│       ├── AndroidManifest.xml
│       ├── java/<package>/
│       │   ├── ui/         # Activity, Fragment, Adapter
│       │   ├── data/       # Repository, API / Firebase
│       │   ├── model/      # Post, User, Category, CollectionPoint...
│       │   └── utils/      # Hàm tiện ích, hằng số
│       └── res/            # layout, drawable, values, mipmap...
├── docs/           # Tài liệu phân tích, thiết kế (SRS, UML, ERD)
├── design/         # Wireframe, mockup UI/UX
├── database/       # Script tạo CSDL, dữ liệu mẫu
└── README.md
```

## 🚀 Cài đặt & chạy thử

```bash
# Clone dự án
git clone https://github.com/<username>/recycling-share-app.git
cd recycling-share-app

# Cài đặt dependencies
<lệnh cài đặt>

# Chạy ứng dụng
<lệnh chạy>
```

## 🗓️ Lộ trình phát triển

- [x] Khảo sát và phân tích yêu cầu
- [x] Thiết kế hệ thống (Use case, ERD, kiến trúc)
- [ ] Thiết kế giao diện UI/UX
- [ ] Xây dựng chức năng cốt lõi (đăng tin, tìm kiếm, chat)
- [ ] Tích hợp bản đồ & điểm xanh
- [ ] Kiểm thử và hoàn thiện

## 👨‍💻 Thành viên nhóm

| Họ tên | MSSV | Vai trò |
|--------|------|---------|
| Võ Hoàng Tuấn Hải | 31241027049 | Nhóm Trưởng |
| Lê Dương Anh Khoa | 31241020839 | Thành Viên |
| Nguyễn Đức Trung | 31241021311 | Thành Viên |
| Lý Minh Đạt | 31241022041 | Thành Viên |

**Giảng viên hướng dẫn:** _Họ tên GVHD_

## 📄 Giấy phép

Dự án phục vụ mục đích học tập. Phát hành theo giấy phép [MIT](LICENSE).

---

<p align="center">🌍 <b>Chia sẻ hôm nay – Xanh hơn mỗi ngày</b> 🌍</p>
