# Đối chiếu màn hình Figma với Android

Có **53 layout `fragment_*.xml`** trong `app/src/main/res/layout/`, ngoài `activity_main.xml`. `MainActivity` là host; `ui/CommunityFragment` xử lý các luồng Firebase mới, `ui/ScreenFragment` xử lý các destination còn lại. Không dùng WebView, không nhúng React vào Android. Catalogue máy đọc được: `android-screens.json`.

| Source Figma | Layout Android |
|---|---|
| OnboardingScreen | fragment_onboarding |
| LoginScreen (login/register) | fragment_login, fragment_register |
| OTPScreen, ForgotPasswordScreen | fragment_otp, fragment_forgot_password |
| HomeScreen, ExploreScreen | fragment_home, fragment_explore |
| MarketItemDetailScreen, CreateListingScreen | fragment_market_detail, fragment_create_listing |
| MessagesScreen (list/chat) | fragment_messages, fragment_chat |
| ProfileScreen, EditProfileScreen | fragment_profile, fragment_edit_profile |
| SettingsScreen, PrivacySettingsScreen | fragment_settings, fragment_privacy_settings |
| TermsPolicyScreen | fragment_terms_policy |
| NotificationsScreen, FriendsScreen | fragment_notifications, fragment_friends |
| PostDetailScreen, CreatePostModal | fragment_post_detail, fragment_create_menu, fragment_create_post; chi tiết TIP dùng chung fragment_post_detail |
| ImageViewerScreen, HashtagScreen, SearchScreen | fragment_image_viewer, fragment_hashtag, fragment_search |
| ReportScreen, HelpCenterScreen | fragment_report, fragment_help_center |
| RecyclingMapScreen, RecyclingPointDetailScreen | fragment_recycling_map, fragment_recycling_point_detail |
| MaterialGuideScreen, RecyclingGuideDetailScreen | fragment_material_guide, fragment_guide_detail |
| MyImpactScreen, BadgesScreen, LeaderboardScreen | fragment_my_impact, fragment_badges, fragment_leaderboard |
| RewardShopScreen, ChallengeDetailScreen | fragment_reward_shop, fragment_challenge_detail |
| GroupsScreen, GroupDetailScreen, EventsScreen | fragment_groups, fragment_group_detail, fragment_events |
| ScannerScreen | fragment_scanner — SCAN: camera hệ thống/chọn ảnh; Spark lưu ảnh inline + metadata Firestore, Emulator có adapter Storage |

Các màn hình bổ sung: `create_menu`, `market`, `verification`, `checkout`, `payment`, `payment_result`, `orders`, `order_detail`, `review`, `dispute`, `my_listings`, `addresses`, `admin_dashboard`, `admin_moderation`, `admin_reports`.

| Phạm vi giao diện | Nguồn dữ liệu hiện tại |
| --- | --- |
| Đăng nhập/đăng ký/khôi phục mật khẩu | Firebase Authentication REST; hồ sơ và quyền từ API |
| Trang chủ | Chỉ POST có trạng thái PUBLISHED từ `/posts` |
| Khám phá | Ba tab: TIP từ `/tips`, thử thách từ `/challenges`, Chợ đồ cũ từ `/listings` |
| Nút + và soạn nội dung | Chọn POST/TIP/tin bán; bài 500 ký tự, ảnh, vật liệu, trọng lượng, tags; ghi API |
| Chi tiết bài, thích/lưu/bình luận | Toàn văn, trả lời và thích bình luận; trạng thái phản ứng lưu server, thích đỏ/lưu vàng; chia sẻ POST/TIP qua tin nhắn |
| Bạn bè và thông báo | Lời mời/chấp nhận/từ chối, bạn bè, gợi ý; thông báo và đánh dấu đã đọc qua API |
| SCAN | Spark lưu ảnh inline tối đa 384 KiB và quyền sở hữu ở Firestore; tải qua API, lịch sử riêng tư; camera hệ thống hoặc chọn ảnh. Emulator có adapter Storage riêng |
| Hồ sơ, địa chỉ, xác minh | API `/me` và các route con; ảnh giấy tờ riêng tư |
| Tin bán và đơn hàng | API mua bán, xác minh hai bên, xem/sửa tin, tạo/xem/hủy/giao/hoàn tất đơn theo quyền |
| Thanh toán từ đơn hàng | Tạo phiên qua API MoMo/VNPay khi server được cấu hình merchant; thanh toán thật chưa được nghiệm thu |
| Admin mobile cơ bản | API tổng quan; tin bán chờ duyệt được duyệt/từ chối; báo cáo OPEN được giải quyết/bác bỏ kèm lý do; kiểm tra quyền hiện hành |
| Tin nhắn giữa hai tài khoản | Danh sách hội thoại, chi tiết và gửi tin qua API Firestore; đọc trang tin mới nhất trước rồi lấy tin cũ theo cursor |
| Một số tùy chọn cài đặt và màn phụ | Còn prototype; không coi là đã đồng bộ toàn bộ với Firebase |

Ngày 19/10/2026, project cloud `recycling-share-app` đã triển khai Auth Email/Password, Firestore Rules/Indexes; tài khoản Admin thật đã đặt mật khẩu và seed 23 document mẫu đã hoàn tất. Giữ Spark/billing tắt: API Node trên máy tính cổng 5002 dùng Auth/Firestore cloud, Admin web cổng 5173; Android debug tự dùng **Spark miễn phí · Backend máy tính + Firestore cloud**. Không triển khai Functions/Storage/Hosting công khai. Bộ kiểm thử tự động vẫn dùng project Emulator riêng `demo-recycling-share`; bằng chứng database/API cloud và giới hạn nghiệm thu ở [verification.md](verification.md), tính năng và dữ liệu ở [community-release.md](community-release.md).

Màn hình từ bản Figma đã được chuyển nội dung/bố cục theo ngữ cảnh Android và mô hình mua bán mới; không phải bản chụp pixel giống React. Bản chỉnh ngày 18/10/2026 giữ nền xanh nhạt, thẻ bo góc, CTA xanh và phong cách mạng xã hội của frontend mới. Thanh dưới có bốn tab và nút tạo bài ở giữa; chỉ hiện trên các màn hình chính, ẩn trên màn con hoặc khi bàn phím mở. Khi xoay ngang, điều hướng chuyển sang cạnh trái và màn đăng nhập thành hai cột có thể cuộn; Fragment đang nhập được giữ khi Activity tạo lại. Host xử lý system bars và bàn phím; các nút tương tác được tăng vùng chạm. Giao diện hiện dùng bảng màu sáng cố định, kể cả khi thiết bị bật dark mode.

Các vùng chỉ có dữ liệu minh họa (bản đồ, phần thưởng, sự kiện, điểm tác động môi trường) không giả vờ có dữ liệu thật. Source React và các sơ đồ cũ giữ làm tư liệu gốc; nguồn chạy Android hiện tại là `app/`, Admin web là `admin-web/`, bộ sơ đồ có hiệu lực là `Recycling Share App/diagrams-current/`.

Layout/string có thể sửa trực tiếp trong Android Studio. Generator Android cũ `tools/generate_android.py` đã có chốt dừng khi phát hiện `CommunityFragment.java`, bảo vệ các màn hình Firebase được duy trì trực tiếp. `activity_main.xml` là nguồn chính của host; `python tools/configure_native.py --check` chỉ kiểm tra và không ghi đè giao diện. `--format` chỉ căn lề XML hiện có.
