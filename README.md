# ♻️ Recycling Share App

> Ứng dụng kết nối cộng đồng để chia sẻ, trao tặng và tái chế đồ dùng — giảm rác thải, tiết kiệm tài nguyên, sống xanh mỗi ngày.

---

## 📖 Giới thiệu

**Recycling Share App** là ứng dụng di động cho phép người dùng đăng tải, chia sẻ và trao tặng những vật dụng không còn sử dụng (quần áo, sách vở, đồ điện tử, đồ gia dụng, vật liệu tái chế…) cho những người có nhu cầu, đồng thời kết nối với các điểm thu gom rác tái chế gần nhất.

Dự án được thực hiện trong khuôn khổ **đồ án môn học** nhằm ứng dụng kiến thức phân tích, thiết kế hệ thống và phát triển phần mềm vào một bài toán thực tế về môi trường.

## 🎯 Vấn đề & Mục tiêu

**Vấn đề**
- Nhiều đồ dùng còn sử dụng được bị vứt bỏ do không biết trao tặng cho ai.
- Người dân thiếu thông tin về cách phân loại rác và địa điểm thu gom tái chế.
- Chưa có kênh tập trung, tin cậy và dễ dùng để kết nối người cho – người nhận.

**Mục tiêu**
- Xây dựng nền tảng chia sẻ đồ dùng cũ nhanh chóng, minh bạch.
- Khuyến khích thói quen phân loại rác và tái chế trong cộng đồng.
- Đo lường và ghi nhận đóng góp xanh của từng người dùng.

## ✨ Tính năng chính

| Nhóm | Tính năng |
|------|-----------|
| 👤 Tài khoản | Đăng ký / đăng nhập, quản lý hồ sơ cá nhân |
| 📦 Chia sẻ đồ dùng | Đăng tin tặng/trao đổi kèm hình ảnh, mô tả, tình trạng, vị trí |
| 🔍 Tìm kiếm | Tìm theo danh mục, từ khóa, khoảng cách |
| 💬 Liên hệ | Nhắn tin trực tiếp giữa người cho và người nhận |
| 🗺️ Bản đồ | Hiển thị điểm thu gom, trung tâm tái chế gần bạn |
| 🌱 Điểm xanh | Tích điểm khi chia sẻ/tái chế, bảng xếp hạng cộng đồng |
| 📚 Kiến thức | Hướng dẫn phân loại rác, mẹo tái chế và tái sử dụng |
| 🔔 Thông báo | Nhắc lịch hẹn, phản hồi yêu cầu nhận đồ |

## 👥 Đối tượng sử dụng

- **Người cho / người nhận:** sinh viên, hộ gia đình, cộng đồng khu dân cư.
- **Điểm thu gom / tổ chức tái chế:** đăng thông tin, nhận đồ tái chế.
- **Quản trị viên:** duyệt bài đăng, quản lý người dùng và nội dung.

## 🔄 Luồng hoạt động

1. Người dùng đăng tin về món đồ muốn chia sẻ.
2. Hệ thống hiển thị tin cho người dùng xung quanh.
3. Người nhận gửi yêu cầu và trao đổi qua tin nhắn.
4. Hai bên hẹn thời gian, địa điểm để trao đổi.
5. Hoàn tất giao dịch → cả hai nhận điểm xanh.

## 🛠️ Công nghệ sử dụng

> _Cập nhật theo công nghệ thực tế của nhóm._

- **Frontend / Mobile:** `<Flutter / React Native / Android (Java, Kotlin)>`
- **Backend:** `<Node.js / Spring Boot / Firebase>`
- **Cơ sở dữ liệu:** `<MySQL / SQL Server / Firestore>`
- **Bản đồ:** `<Google Maps API / OpenStreetMap>`
- **Công cụ thiết kế:** `<Figma, draw.io, StarUML>`

## 📁 Cấu trúc thư mục

```
recycling-share-app/
├── docs/           # Tài liệu phân tích, thiết kế (SRS, UML, ERD)
├── design/         # Wireframe, mockup UI/UX
├── backend/        # Mã nguồn server / API
├── app/            # Mã nguồn ứng dụng
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
| Võ Hoàng Tuấn Hải | 31241027049 |
| _Họ tên_ | _MSSV_ | _…_ |

## 📄 Giấy phép

Dự án phục vụ mục đích học tập. Phát hành theo giấy phép [MIT](LICENSE).

---

<p align="center">🌍 <b>Chia sẻ hôm nay – Xanh hơn mỗi ngày</b> 🌍</p>
