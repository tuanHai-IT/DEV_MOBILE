export interface User {
  id: string;
  name: string;
  username: string;
  avatar: string;
  cover: string;
  bio: string;
  location: string;
  posts: number;
  friends: number;
  recycled: number;
  points: number;
  isFriend?: boolean;
  hasStory?: boolean;
  storySeen?: boolean;
  isOnline?: boolean;
  joinDate: string;
  badge?: string;
}

export interface Comment {
  id: string;
  userId: string;
  content: string;
  time: string;
  likes: number;
}

export interface Post {
  id: string;
  userId: string;
  time: string;
  content: string;
  images: string[];
  likes: number;
  comments: Comment[];
  shares: number;
  tags: string[];
  liked: boolean;
  type: 'post' | 'tip' | 'exchange';
  category: string;
  recycledWeight?: string;
}

export interface Message {
  id: string;
  senderId: string;
  content: string;
  time: string;
  read: boolean;
}

export interface Chat {
  id: string;
  userId: string;
  messages: Message[];
  unread: number;
  lastActive: string;
}

export interface RecyclingTip {
  id: string;
  title: string;
  description: string;
  material: string;
  difficulty: 'easy' | 'medium' | 'hard';
  time: string;
  image: string;
  likes: number;
  author: string;
}

export interface MarketItem {
  id: string;
  userId: string;
  title: string;
  description: string;
  image: string;
  category: string;
  condition: 'new' | 'good' | 'fair';
  price: number | string;
  location: string;
  time: string;
  interested: number;
}

export interface Challenge {
  id: string;
  title: string;
  description: string;
  icon: string;
  participants: number;
  target: string;
  deadline: string;
  reward: number;
  joined: boolean;
  progress?: number;
  maxProgress?: number;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'like' | 'comment' | 'friend_request' | 'challenge' | 'mention';
  content: string;
  time: string;
  read: boolean;
  postId?: string;
}

export const CURRENT_USER_ID = '1';

export const users: User[] = [
  {
    id: '1', name: 'Nguyễn Thị Lan', username: 'lan_recycles',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop&auto=format',
    cover: 'https://images.unsplash.com/photo-1525695230005-efd074980869?w=800&h=300&fit=crop&auto=format',
    bio: 'Yêu môi trường xanh 🌿 | DIY Queen | Hà Nội\nĐã tái chế được 89kg đồ dùng ♻️',
    location: 'Hà Nội, Việt Nam', posts: 47, friends: 234, recycled: 89, points: 1240,
    hasStory: true, storySeen: false, isOnline: true, joinDate: 'Tháng 3, 2022',
    badge: '🌟 Eco Star',
  },
  {
    id: '2', name: 'Trần Văn Minh', username: 'minh.green',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&h=80&fit=crop&auto=format',
    cover: 'https://images.unsplash.com/photo-1779966946521-e9317485653b?w=800&h=300&fit=crop&auto=format',
    bio: 'Kỹ sư môi trường | Tái chế mọi thứ từ 2018 🔧\nTP. Hồ Chí Minh',
    location: 'TP. Hồ Chí Minh', posts: 31, friends: 178, recycled: 156, points: 2100,
    isFriend: true, hasStory: true, storySeen: false, isOnline: false, joinDate: 'Tháng 1, 2021',
    badge: '⚡ Tái Chế Chuyên Nghiệp',
  },
  {
    id: '3', name: 'Lê Thị Hoa', username: 'hoa_craft',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=80&h=80&fit=crop&auto=format',
    cover: 'https://images.unsplash.com/photo-1757626065729-a13f763423e1?w=800&h=300&fit=crop&auto=format',
    bio: 'Thủ công mỹ nghệ ✂️ | Zero waste lifestyle | Đà Nẵng',
    location: 'Đà Nẵng', posts: 62, friends: 312, recycled: 203, points: 3450,
    isFriend: true, hasStory: true, storySeen: true, isOnline: true, joinDate: 'Tháng 6, 2020',
    badge: '👑 Nữ Hoàng DIY',
  },
  {
    id: '4', name: 'Phạm Quốc Anh', username: 'quoc_anh_eco',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop&auto=format',
    cover: 'https://images.unsplash.com/photo-1776880858371-a2893dc61fa6?w=800&h=300&fit=crop&auto=format',
    bio: 'Startup tái chế xanh 🚀 | CEO EcoViet | Cần Thơ',
    location: 'Cần Thơ', posts: 18, friends: 95, recycled: 45, points: 780,
    isFriend: true, hasStory: false, isOnline: true, joinDate: 'Tháng 9, 2022',
  },
  {
    id: '5', name: 'Đỗ Thị Mai', username: 'mai.upcycle',
    avatar: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=80&h=80&fit=crop&auto=format',
    cover: 'https://images.unsplash.com/photo-1773612973407-3b65988ce51a?w=800&h=300&fit=crop&auto=format',
    bio: 'Giáo viên 👩‍🏫 | Dạy trẻ yêu môi trường ♻️ | Huế',
    location: 'Huế', posts: 28, friends: 145, recycled: 78, points: 1050,
    isFriend: false, hasStory: true, storySeen: false, isOnline: false, joinDate: 'Tháng 5, 2021',
  },
  {
    id: '6', name: 'Nguyễn Văn Hùng', username: 'hung_green',
    avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=80&h=80&fit=crop&auto=format',
    cover: 'https://images.unsplash.com/photo-1780398021247-1b846ecc2de9?w=800&h=300&fit=crop&auto=format',
    bio: 'Nhiếp ảnh gia 📸 | Ghi lại vẻ đẹp của tái chế | Hà Nội',
    location: 'Hà Nội', posts: 54, friends: 289, recycled: 120, points: 1890,
    isFriend: false, hasStory: true, storySeen: true, isOnline: true, joinDate: 'Tháng 2, 2021',
    badge: '📷 Nhiếp Ảnh Xanh',
  },
  {
    id: '7', name: 'Bùi Thị Thu', username: 'thu_earth',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&h=80&fit=crop&auto=format',
    cover: 'https://images.unsplash.com/photo-1786840320329-cf55106ff617?w=800&h=300&fit=crop&auto=format',
    bio: 'Yêu thiên nhiên 🌍 | Hội tái chế xanh TP.HCM | 💚',
    location: 'TP. Hồ Chí Minh', posts: 39, friends: 201, recycled: 95, points: 1320,
    isFriend: false, hasStory: false, isOnline: false, joinDate: 'Tháng 8, 2022',
  },
];

export const posts: Post[] = [
  {
    id: '1', userId: '3', time: '2 giờ trước',
    content: 'Biến 5 chai nhựa cũ thành vườn treo mini siêu xinh 🌿✨ Mất khoảng 30 phút và HOÀN TOÀN không tốn tiền!\n\n📋 Cách làm:\n1️⃣ Cắt đôi chai nhựa theo đường chéo\n2️⃣ Đục 2 lỗ nhỏ hai bên để treo\n3️⃣ Cho đất màu + phân hữu cơ\n4️⃣ Trồng cây con và treo lên tường\n\nMọi người thử làm đi nhé! Bình luận ảnh kết quả cho mình xem với 🌱',
    images: ['https://images.unsplash.com/photo-1525695230005-efd074980869?w=400&h=500&fit=crop&auto=format'],
    likes: 234, shares: 89, liked: false, type: 'tip', category: 'Nhựa', recycledWeight: '0.8kg',
    tags: ['ChậuHoa', 'TáiChếNhựa', 'DIY', 'ZeroWaste'],
    comments: [
      { id: 'c1', userId: '1', content: 'Đẹp quá Hoa ơi! Mình sẽ thử làm cuối tuần này 💚', time: '1 giờ trước', likes: 12 },
      { id: 'c2', userId: '2', content: 'Có thể dùng chai PET 1.5L không bạn?', time: '45 phút trước', likes: 8 },
      { id: 'c3', userId: '6', content: 'Ảnh chụp rất đẹp! 📸 Ánh sáng tự nhiên chuẩn không cần chỉnh', time: '30 phút trước', likes: 15 },
    ],
  },
  {
    id: '2', userId: '2', time: '4 giờ trước',
    content: 'Tái chế lốp xe cũ thành chiếc xích đu xinh xắn cho bé 🎡\n\n💰 Chi phí: ~50.000đ (chỉ mua dây thừng)\n⏱️ Thời gian: 2 tiếng\n🛠️ Vật liệu: 1 lốp xe máy cũ + 3m dây thừng\n\nMình xin lốp tại tiệm sửa xe gần nhà, họ cho không! Bố mẹ nào muốn làm cho con không? Drop comment để mình gửi hướng dẫn nhé! 💪',
    images: ['https://images.unsplash.com/photo-1779966946521-e9317485653b?w=400&h=500&fit=crop&auto=format'],
    likes: 156, shares: 45, liked: true, type: 'tip', category: 'Cao su',
    tags: ['TáiChếLốpXe', 'XíchĐu', 'DạyTrẻ'],
    comments: [
      { id: 'c4', userId: '5', content: 'Con mình sẽ thích lắm! Gửi hướng dẫn cho mình với ạ 🙏', time: '3 giờ trước', likes: 5 },
      { id: 'c5', userId: '1', content: 'Ý tưởng hay quá! Mình cũng muốn làm cho cháu', time: '2 giờ trước', likes: 9 },
    ],
  },
  {
    id: '3', userId: '5', time: '6 giờ trước',
    content: 'Lọ thủy tinh cũ + sỏi + nến tealight = đèn decor lung linh huyền bí 🕯️✨\n\nAi bảo đồ bỏ đi không có giá trị? Mình chỉ dùng những lọ thủy tinh nhặt được từ góc nhà để tạo ra góc trang trí này!\n\nGiá thành: 0đ 💚\nÝ nghĩa: Vô giá! 🌿',
    images: ['https://images.unsplash.com/photo-1757626065729-a13f763423e1?w=400&h=500&fit=crop&auto=format'],
    likes: 389, shares: 134, liked: false, type: 'post', category: 'Thủy tinh', recycledWeight: '1.2kg',
    tags: ['Decor', 'ThủyTinh', 'DIY', 'ZeroWaste'],
    comments: [
      { id: 'c6', userId: '6', content: 'Ánh nến qua thủy tinh lung linh quá cô giáo ơi! 😍', time: '5 giờ trước', likes: 23 },
      { id: 'c7', userId: '3', content: 'Romantic vibe cực chill! Mình sẽ thử làm ngay 💫', time: '4 giờ trước', likes: 15 },
    ],
  },
  {
    id: '4', userId: '6', time: '1 ngày trước',
    content: 'Làm chong chóng từ đĩa CD cũ cho bé 🌀☀️\n\nBé nhà mình thích lắm! CD phản chiếu ánh sáng tạo thành cầu vồng 7 màu khi có nắng, đẹp không tưởng!\n\nĐây là lần đầu mình tự làm đồ chơi cho con từ phế liệu. Cảm giác tự hào lắm! 🥲💪',
    images: ['https://images.unsplash.com/photo-1776880858371-a2893dc61fa6?w=400&h=500&fit=crop&auto=format'],
    likes: 201, shares: 67, liked: false, type: 'post', category: 'Điện tử',
    tags: ['CD', 'ĐồChơiTrẻEm', 'TáiChế', 'Handmade'],
    comments: [
      { id: 'c8', userId: '1', content: 'Ảnh đẹp quá anh Hùng! Nghề nhiếp ảnh ra tay là khác 😄', time: '22 giờ trước', likes: 18 },
    ],
  },
  {
    id: '5', userId: '1', time: '2 ngày trước',
    content: 'Nút chai rượu vang làm chắn gió handmade độc đáo 🍷🌿\n\nNhà mình tích lũy được hơn 200 nút chai trong 2 năm nay. Cuối tuần vừa rồi ngồi làm một buổi chiều, ra được tấm này!\n\nDùng khung gỗ cũ + keo nóng, xếp nút chai theo hình lục giác. Dễ làm lắm nhé! Ai muốn học drop comment 👇',
    images: ['https://images.unsplash.com/photo-1773612973407-3b65988ce51a?w=400&h=500&fit=crop&auto=format'],
    likes: 445, shares: 156, liked: true, type: 'post', category: 'Hỗn hợp', recycledWeight: '2.1kg',
    tags: ['NútChai', 'Handmade', 'UpCycle', 'Decor'],
    comments: [
      { id: 'c9', userId: '2', content: 'Mình cũng có một đống nút chai 😂 Phải thử ngay!', time: '2 ngày trước', likes: 34 },
      { id: 'c10', userId: '3', content: 'Siêu đẹp Lan ơi! Bán cho mình một cái được không? 🥺', time: '2 ngày trước', likes: 12 },
    ],
  },
  {
    id: '6', userId: '4', time: '3 ngày trước',
    content: 'Đèn chùm nghệ thuật từ 500 chai nhựa tái chế 💡♻️\n\nDự án startup của mình: biến chai nhựa thành điểm nhấn decor cho quán cà phê ở Cần Thơ. Mỗi chai là một câu chuyện!\n\n✅ 500 chai nhựa cứu khỏi bãi rác\n✅ Đèn LED tiết kiệm điện bên trong\n✅ Khách check-in liên tục 🔥\n\n#StartupXanh #TáiChếNhựa',
    images: ['https://images.unsplash.com/photo-1775233212408-44621868508a?w=400&h=500&fit=crop&auto=format'],
    likes: 567, shares: 234, liked: false, type: 'post', category: 'Nhựa', recycledWeight: '15kg',
    tags: ['Startup', 'TáiChếNhựa', 'Đèn', 'SángTạo', 'EcoCafe'],
    comments: [
      { id: 'c11', userId: '6', content: 'Ý tưởng startup hay lắm! Quán ở đâu cho mình đến xem với?', time: '3 ngày trước', likes: 28 },
      { id: 'c12', userId: '3', content: 'Đẹp không tưởng! Rất inspiring 💚', time: '3 ngày trước', likes: 19 },
    ],
  },
];

export const chats: Chat[] = [
  {
    id: '1', userId: '3', lastActive: '5 phút trước', unread: 2,
    messages: [
      { id: 'm1', senderId: '3', content: 'Lan ơi, cái chắn gió nút chai của bạn đẹp quá! Chỉ mình làm với 🙏', time: '10:30', read: true },
      { id: 'm2', senderId: '1', content: 'Hihi cảm ơn Hoa nhé! Thực ra rất dễ làm đó. Để mình chụp từng bước gửi cho', time: '10:32', read: true },
      { id: 'm3', senderId: '3', content: 'Ưa quá! Mình cũng muốn học làm đèn lọ thủy tinh. Cuối tuần bạn rảnh không?', time: '10:45', read: true },
      { id: 'm4', senderId: '1', content: 'Cuối tuần này bận rồi 😅 Tuần sau nhé!', time: '10:47', read: true },
      { id: 'm5', senderId: '3', content: 'Oke bạn ơi! Nhớ nhé đừng có quên 💚', time: '11:00', read: true },
      { id: 'm6', senderId: '3', content: 'Mình mới đăng video hướng dẫn làm đèn thủy tinh rồi, bạn xem thử nha!', time: '14:20', read: false },
    ],
  },
  {
    id: '2', userId: '2', lastActive: '2 giờ trước', unread: 0,
    messages: [
      { id: 'm7', senderId: '1', content: 'Minh ơi, lốp xe bạn xin ở đâu vậy? Mình cũng muốn làm xích đu!', time: 'Hôm qua', read: true },
      { id: 'm8', senderId: '2', content: 'Mình nhặt ở garage gần nhà, họ cho không luôn! Đến hỏi thử xem', time: 'Hôm qua', read: true },
      { id: 'm9', senderId: '1', content: 'Ồ hay quá! Mình sẽ thử hỏi chỗ sửa xe gần nhà liền 💪', time: 'Hôm qua', read: true },
      { id: 'm10', senderId: '2', content: 'Nhiều chỗ sửa xe sẵn sàng cho lốp cũ lắm! Chúc bạn thành công nha 🎡', time: 'Hôm qua', read: true },
    ],
  },
  {
    id: '3', userId: '4', lastActive: '1 ngày trước', unread: 1,
    messages: [
      { id: 'm11', senderId: '4', content: 'Chào Lan! Mình là Quốc Anh, đang làm dự án thu gom nhựa tái chế ở Cần Thơ.', time: '2 ngày trước', read: true },
      { id: 'm12', senderId: '1', content: 'Chào Anh! Dự án rất ý nghĩa! Mình có thể giúp gì không?', time: '2 ngày trước', read: true },
      { id: 'm13', senderId: '4', content: 'Bạn có thể share bài về dự án không? Cần nhiều người biết đến hơn 🙏', time: '1 ngày trước', read: false },
    ],
  },
  {
    id: '4', userId: '6', lastActive: '3 ngày trước', unread: 0,
    messages: [
      { id: 'm14', senderId: '6', content: 'Lan ơi! Mình muốn chụp ảnh sản phẩm tái chế của bạn, có được không?', time: '3 ngày trước', read: true },
      { id: 'm15', senderId: '1', content: 'Tuyệt vời! Mình đang có bộ đèn thủy tinh mới làm xong. Bao giờ anh rảnh?', time: '3 ngày trước', read: true },
      { id: 'm16', senderId: '6', content: 'Cuối tuần này mình rảnh! Sáng thứ 7 nhé 📸', time: '3 ngày trước', read: true },
    ],
  },
];

export const recyclingTips: RecyclingTip[] = [
  { id: 't1', title: 'Chai nhựa thành chậu vườn treo', description: 'Cắt đôi chai nhựa, đục lỗ thoát nước, cho đất và trồng cây. Hoàn toàn miễn phí!', material: 'Nhựa PET', difficulty: 'easy', time: '20 phút', image: 'https://images.unsplash.com/photo-1525695230005-efd074980869?w=300&h=300&fit=crop&auto=format', likes: 1234, author: 'Lê Thị Hoa' },
  { id: 't2', title: 'Lốp xe thành xích đu sân vườn', description: 'Vệ sinh sạch, đục lỗ thoát nước dưới đáy, sơn màu yêu thích và treo lên cành cây.', material: 'Cao su', difficulty: 'medium', time: '2 giờ', image: 'https://images.unsplash.com/photo-1779966946521-e9317485653b?w=300&h=300&fit=crop&auto=format', likes: 856, author: 'Trần Văn Minh' },
  { id: 't3', title: 'Lọ thủy tinh thành đèn trang trí', description: 'Đặt nến tealight vào lọ sạch. Thêm sỏi màu hoặc vỏ sò cho đẹp mắt.', material: 'Thủy tinh', difficulty: 'easy', time: '10 phút', image: 'https://images.unsplash.com/photo-1757626065729-a13f763423e1?w=300&h=300&fit=crop&auto=format', likes: 2100, author: 'Đỗ Thị Mai' },
  { id: 't4', title: 'CD cũ thành chong chóng cầu vồng', description: 'Khoan lỗ giữa CD, xỏ que tre qua, trang trí thêm. Ánh sáng 7 màu cầu vồng tuyệt đẹp!', material: 'Đĩa CD', difficulty: 'easy', time: '30 phút', image: 'https://images.unsplash.com/photo-1776880858371-a2893dc61fa6?w=300&h=300&fit=crop&auto=format', likes: 678, author: 'Nguyễn Văn Hùng' },
  { id: 't5', title: 'Nút chai làm tranh trang trí độc đáo', description: 'Sắp nút chai thành hoa văn trên khung gỗ bằng keo nóng. Tạo điểm nhấn không gian!', material: 'Nút chai/Gỗ', difficulty: 'medium', time: '3 giờ', image: 'https://images.unsplash.com/photo-1773612973407-3b65988ce51a?w=300&h=300&fit=crop&auto=format', likes: 945, author: 'Nguyễn Thị Lan' },
  { id: 't6', title: 'Carton thành kệ sách sáng tạo', description: 'Dùng hộp carton to, bọc vải hoặc giấy yêu thích, xếp tạo thành kệ đa năng.', material: 'Carton', difficulty: 'medium', time: '1.5 giờ', image: 'https://images.unsplash.com/photo-1786840320329-cf55106ff617?w=300&h=300&fit=crop&auto=format', likes: 534, author: 'Bùi Thị Thu' },
];

export const marketItems: MarketItem[] = [
  { id: 'mk1', userId: '3', title: 'Bộ chậu hoa chai nhựa handmade (5 chiếc)', description: 'Đã có đất và cây con rau mầm. Giao hàng Đà Nẵng hoặc gửi bưu điện.', image: 'https://images.unsplash.com/photo-1525695230005-efd074980869?w=300&h=300&fit=crop&auto=format', category: 'Cây cảnh', condition: 'new', price: 'free', location: 'Đà Nẵng', time: '1 giờ trước', interested: 8 },
  { id: 'mk2', userId: '2', title: 'Đèn lọ thủy tinh vintage (set 3 chiếc)', description: 'Lọ thủy tinh tái chế, có nến tealight kèm theo. Rất đẹp decor bàn ăn/phòng khách.', image: 'https://images.unsplash.com/photo-1757626065729-a13f763423e1?w=300&h=300&fit=crop&auto=format', category: 'Decor', condition: 'new', price: 120000, location: 'TP.HCM', time: '3 giờ trước', interested: 14 },
  { id: 'mk3', userId: '5', title: 'Xích đu lốp xe màu sắc cho bé', description: 'Lốp xe máy cũ, sơn màu vui tươi. An toàn cho bé 3-10 tuổi. Đổi lấy đồ tái chế!', image: 'https://images.unsplash.com/photo-1779966946521-e9317485653b?w=300&h=300&fit=crop&auto=format', category: 'Đồ chơi', condition: 'new', price: 'trade', location: 'Huế', time: '1 ngày trước', interested: 5 },
  { id: 'mk4', userId: '1', title: 'Tranh nghệ thuật từ 50 đĩa CD', description: 'Kích thước 50x70cm. Lung linh ánh sáng cầu vồng khi có đèn chiếu vào. Độc bản!', image: 'https://images.unsplash.com/photo-1776880858371-a2893dc61fa6?w=300&h=300&fit=crop&auto=format', category: 'Nghệ thuật', condition: 'new', price: 350000, location: 'Hà Nội', time: '2 ngày trước', interested: 22 },
];

export const challenges: Challenge[] = [
  { id: 'ch1', title: '30 Ngày Không Túi Nilon', description: 'Từ chối túi nilon, dùng túi vải hoặc hộp riêng trong 30 ngày. Chụp ảnh mỗi ngày!', icon: '🛍️', participants: 1247, target: '30 ngày', deadline: '31/10/2026', reward: 500, joined: true, progress: 18, maxProgress: 30 },
  { id: 'ch2', title: 'DIY Từ Rác Thải Điện Tử', description: 'Sáng tạo vật dụng mới từ linh kiện điện tử cũ. Bình chọn tác phẩm hay nhất!', icon: '💻', participants: 456, target: '1 sản phẩm', deadline: '15/10/2026', reward: 1000, joined: false },
  { id: 'ch3', title: 'Tái Chế 10kg Rác / Tháng', description: 'Cân và ghi lại trọng lượng rác tái chế mỗi ngày. Mục tiêu 10kg trong 1 tháng!', icon: '⚖️', participants: 789, target: '10kg', deadline: '30/09/2026', reward: 750, joined: true, progress: 6, maxProgress: 10 },
  { id: 'ch4', title: 'Upcycle Fashion Challenge', description: 'Biến quần áo cũ thành trang phục mới thời thượng. Chia sẻ before & after!', icon: '👗', participants: 2341, target: '3 món đồ', deadline: '20/10/2026', reward: 800, joined: false },
];

export const notifications: Notification[] = [
  { id: 'n1', userId: '3', type: 'like', content: 'đã thích bài đăng về chắn gió nút chai của bạn', time: '5 phút trước', read: false, postId: '5' },
  { id: 'n2', userId: '2', type: 'comment', content: 'đã bình luận: "Mình cũng có một đống nút chai 😂 Phải thử ngay!"', time: '30 phút trước', read: false, postId: '5' },
  { id: 'n3', userId: '5', type: 'friend_request', content: 'đã gửi lời mời kết bạn', time: '2 giờ trước', read: false },
  { id: 'n4', userId: '6', type: 'like', content: 'đã thích bài đăng về lọ thủy tinh của bạn', time: '4 giờ trước', read: true, postId: '3' },
  { id: 'n5', userId: '7', type: 'challenge', content: 'vừa hoàn thành thử thách "30 Ngày Không Túi Nilon" 🎉', time: '1 ngày trước', read: true },
  { id: 'n6', userId: '4', type: 'mention', content: 'đã nhắc đến bạn trong bài về startup tái chế', time: '2 ngày trước', read: true, postId: '6' },
  { id: 'n7', userId: '1', type: 'like', content: 'Bài của bạn đạt 400+ lượt thích! 🔥', time: '3 ngày trước', read: true, postId: '5' },
];
