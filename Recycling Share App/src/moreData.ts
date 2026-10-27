export interface Group {
  id: string;
  name: string;
  description: string;
  avatar: string;
  cover: string;
  members: number;
  posts: number;
  category: string;
  isJoined: boolean;
  location: string;
  admin: string;
  tags: string[];
}

export interface EcoEvent {
  id: string;
  title: string;
  description: string;
  image: string;
  date: string;
  time: string;
  location: string;
  organizer: string;
  attendees: number;
  isJoined: boolean;
  category: string;
  price: 'free' | number;
  ecoPoints: number;
  lat?: number;
  lng?: number;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  bgColor: string;
  earned: boolean;
  earnedDate?: string;
  requirement: string;
  points: number;
  category: string;
}

export interface Reward {
  id: string;
  title: string;
  description: string;
  image: string;
  points: number;
  category: string;
  partner: string;
  available: boolean;
  stock: number;
}

export interface RecyclingPoint {
  id: string;
  name: string;
  address: string;
  types: string[];
  hours: string;
  phone: string;
  rating: number;
  reviews: number;
  distance: string;
  x: number;
  y: number;
}

export interface Material {
  id: string;
  name: string;
  icon: string;
  color: string;
  bgColor: string;
  recyclable: boolean;
  recyclingRate: string;
  tips: string[];
  commonItems: string[];
  processingTime: string;
  ecoFact: string;
  code?: string;
}

export interface ImpactStat {
  month: string;
  kg: number;
  co2: number;
  trees: number;
  water: number;
}

// ─── Groups ────────────────────────────────────────────────────────────────
export const groups: Group[] = [
  {
    id: 'g1', name: 'Hội Tái Chế Hà Nội', category: 'Cộng đồng',
    description: 'Cộng đồng tái chế lớn nhất Hà Nội 🌿 Chia sẻ tips, trao đổi đồ cũ và tổ chức sự kiện xanh hàng tuần.',
    avatar: 'https://images.unsplash.com/photo-1525695230005-efd074980869?w=80&h=80&fit=crop&auto=format',
    cover: 'https://images.unsplash.com/photo-1525695230005-efd074980869?w=800&h=200&fit=crop&auto=format',
    members: 1234, posts: 89, isJoined: true, location: 'Hà Nội', admin: 'Nguyễn Thị Lan',
    tags: ['HàNội', 'TáiChế', 'ZeroWaste'],
  },
  {
    id: 'g2', name: 'Zero Waste Việt Nam', category: 'Phong trào',
    description: 'Cùng nhau tiến tới lối sống Zero Waste. Chia sẻ kinh nghiệm sống xanh và bảo vệ môi trường.',
    avatar: 'https://images.unsplash.com/photo-1779966946521-e9317485653b?w=80&h=80&fit=crop&auto=format',
    cover: 'https://images.unsplash.com/photo-1779966946521-e9317485653b?w=800&h=200&fit=crop&auto=format',
    members: 2891, posts: 234, isJoined: true, location: 'Toàn quốc', admin: 'Lê Thị Hoa',
    tags: ['ZeroWaste', 'SinhThái', 'BảoVệMôiTrường'],
  },
  {
    id: 'g3', name: 'DIY & Upcycle Club', category: 'Sáng tạo',
    description: 'Biến rác thành nghệ thuật! Nhóm chia sẻ các dự án DIY và upcycle sáng tạo từ phế liệu.',
    avatar: 'https://images.unsplash.com/photo-1780398021247-1b846ecc2de9?w=80&h=80&fit=crop&auto=format',
    cover: 'https://images.unsplash.com/photo-1780398021247-1b846ecc2de9?w=800&h=200&fit=crop&auto=format',
    members: 567, posts: 145, isJoined: false, location: 'Toàn quốc', admin: 'Đỗ Thị Mai',
    tags: ['DIY', 'Upcycle', 'HandMade'],
  },
  {
    id: 'g4', name: 'Nhựa Sạch TP.HCM', category: 'Nhựa',
    description: 'Tập trung vào giải pháp giảm rác nhựa tại TP.HCM. Thu gom, phân loại và tái chế nhựa đúng cách.',
    avatar: 'https://images.unsplash.com/photo-1775233212408-44621868508a?w=80&h=80&fit=crop&auto=format',
    cover: 'https://images.unsplash.com/photo-1775233212408-44621868508a?w=800&h=200&fit=crop&auto=format',
    members: 1102, posts: 67, isJoined: false, location: 'TP. Hồ Chí Minh', admin: 'Phạm Quốc Anh',
    tags: ['Nhựa', 'TPHCM', 'ThuGom'],
  },
  {
    id: 'g5', name: 'Vườn Xanh Cộng Đồng', category: 'Cây xanh',
    description: 'Trồng cây từ vật liệu tái chế. Chia sẻ kinh nghiệm làm vườn, trồng rau sạch tại nhà.',
    avatar: 'https://images.unsplash.com/photo-1757626065729-a13f763423e1?w=80&h=80&fit=crop&auto=format',
    cover: 'https://images.unsplash.com/photo-1757626065729-a13f763423e1?w=800&h=200&fit=crop&auto=format',
    members: 789, posts: 102, isJoined: false, location: 'Toàn quốc', admin: 'Bùi Thị Thu',
    tags: ['Vườn', 'CâyXanh', 'TrồngRau'],
  },
];

// ─── Events ────────────────────────────────────────────────────────────────
export const events: EcoEvent[] = [
  {
    id: 'e1', title: 'Ngày Hội Tái Chế Hà Nội 2026', category: 'Sự kiện lớn',
    description: 'Sự kiện tái chế lớn nhất năm tại Hà Nội! Workshop, triển lãm nghệ thuật tái chế, trao đổi đồ cũ và nhiều hoạt động thú vị. Miễn phí cho tất cả mọi người.',
    image: 'https://images.unsplash.com/photo-1780398021247-1b846ecc2de9?w=400&h=250&fit=crop&auto=format',
    date: '15/10/2026', time: '8:00 - 17:00', location: 'Công viên Thống Nhất, Hà Nội',
    organizer: 'Hội Tái Chế Hà Nội', attendees: 342, isJoined: true, price: 'free', ecoPoints: 500,
  },
  {
    id: 'e2', title: 'Workshop DIY Từ Phế Liệu', category: 'Workshop',
    description: 'Học cách biến chai nhựa, hộp carton và vải cũ thành những vật dụng hữu ích và đẹp mắt. Giảng viên là nghệ nhân DIY Lê Thị Hoa.',
    image: 'https://images.unsplash.com/photo-1773612973407-3b65988ce51a?w=400&h=250&fit=crop&auto=format',
    date: '20/10/2026', time: '14:00 - 17:00', location: 'Không gian Sáng tạo Cầu Giấy, Hà Nội',
    organizer: 'DIY & Upcycle Club', attendees: 56, isJoined: false, price: 50000, ecoPoints: 200,
  },
  {
    id: 'e3', title: 'Lớp Học Compost Cho Người Mới', category: 'Giáo dục',
    description: 'Tìm hiểu cách ủ phân compost từ rác hữu cơ tại nhà. Tiết kiệm tiền phân bón và giảm rác ra môi trường.',
    image: 'https://images.unsplash.com/photo-1525695230005-efd074980869?w=400&h=250&fit=crop&auto=format',
    date: '25/10/2026', time: '9:00 - 11:00', location: 'Vườn Ươm Xanh, Đống Đa, Hà Nội',
    organizer: 'Vườn Xanh Cộng Đồng', attendees: 28, isJoined: true, price: 'free', ecoPoints: 150,
  },
  {
    id: 'e4', title: 'Cuộc Thi Sáng Tạo Tái Chế 2026', category: 'Thi đấu',
    description: 'Cuộc thi toàn quốc về sản phẩm sáng tạo từ rác tái chế. Giải thưởng lên đến 50 triệu đồng. Đăng ký trước 31/10!',
    image: 'https://images.unsplash.com/photo-1776880858371-a2893dc61fa6?w=400&h=250&fit=crop&auto=format',
    date: '01/11/2026', time: 'Cả ngày', location: 'Trung tâm Hội nghị Quốc gia, Hà Nội',
    organizer: 'Bộ Tài nguyên & Môi trường', attendees: 891, isJoined: false, price: 'free', ecoPoints: 1000,
  },
];

// ─── Badges ────────────────────────────────────────────────────────────────
export const badges: Badge[] = [
  { id: 'b1', name: 'Người Khởi Đầu', icon: '🌱', bgColor: '#d1fae5', description: 'Đăng bài đầu tiên', requirement: 'Đăng 1 bài', points: 50, earned: true, earnedDate: '15/03/2022', category: 'Cơ bản' },
  { id: 'b2', name: 'Tái Chế 10kg', icon: '♻️', bgColor: '#dbeafe', description: 'Tái chế tổng cộng 10kg', requirement: 'Tái chế 10kg', points: 200, earned: true, earnedDate: '20/05/2022', category: 'Tái chế' },
  { id: 'b3', name: 'Được Yêu Thích', icon: '❤️', bgColor: '#fce7f3', description: 'Bài đăng đạt 100 lượt thích', requirement: '100 lượt thích', points: 150, earned: true, earnedDate: '01/07/2022', category: 'Xã hội' },
  { id: 'b4', name: 'Kết Nối', icon: '🤝', bgColor: '#ede9fe', description: 'Kết bạn với 10 người', requirement: 'Có 10 bạn bè', points: 100, earned: true, earnedDate: '10/04/2022', category: 'Xã hội' },
  { id: 'b5', name: 'Chiến Binh Eco', icon: '🏆', bgColor: '#fef3c7', description: 'Hoàn thành 1 thử thách', requirement: 'Xong 1 thử thách', points: 300, earned: true, earnedDate: '30/08/2022', category: 'Thử thách' },
  { id: 'b6', name: 'Ngọn Lửa', icon: '🔥', bgColor: '#fee2e2', description: 'Đăng bài 7 ngày liên tiếp', requirement: '7 ngày liên tiếp', points: 250, earned: true, earnedDate: '15/09/2022', category: 'Chuỗi' },
  { id: 'b7', name: 'Nhà Nhiếp Ảnh Xanh', icon: '📸', bgColor: '#e0f2fe', description: 'Đăng 50 bài có ảnh', requirement: 'Đăng 50 bài', points: 400, earned: false, category: 'Nội dung' },
  { id: 'b8', name: 'Siêu Tái Chế', icon: '🌳', bgColor: '#d1fae5', description: 'Tái chế 100kg tổng cộng', requirement: 'Tái chế 100kg', points: 1000, earned: false, category: 'Tái chế' },
  { id: 'b9', name: 'Top 10', icon: '👑', bgColor: '#fef3c7', description: 'Vào top 10 bảng xếp hạng', requirement: 'Top 10 tuần', points: 500, earned: false, category: 'Xếp hạng' },
  { id: 'b10', name: 'Người Ảnh Hưởng', icon: '🌍', bgColor: '#f0fdf4', description: 'Bài đăng của bạn được 1000 người xem', requirement: '1000 lượt xem', points: 750, earned: false, category: 'Xã hội' },
];

// ─── Rewards ────────────────────────────────────────────────────────────────
export const rewards: Reward[] = [
  { id: 'r1', title: 'Sticker Pack Eco', description: 'Bộ 20 sticker tái chế dễ thương cho điện thoại và laptop', image: 'https://images.unsplash.com/photo-1786840320329-cf55106ff617?w=200&h=200&fit=crop&auto=format', points: 100, category: 'Quà tặng', partner: 'EcoShare Store', available: true, stock: 50 },
  { id: 'r2', title: 'Quyên Góp 1kg Gạo', description: 'Điểm của bạn đóng góp 1kg gạo cho người nghèo qua quỹ từ thiện', image: 'https://images.unsplash.com/photo-1525695230005-efd074980869?w=200&h=200&fit=crop&auto=format', points: 150, category: 'Từ thiện', partner: 'Hội Chữ Thập Đỏ', available: true, stock: 999 },
  { id: 'r3', title: 'Túi Vải Tái Chế', description: 'Túi vải canvas làm từ vải tái chế, in logo EcoShare. Bền đẹp, thân thiện môi trường', image: 'https://images.unsplash.com/photo-1773612973407-3b65988ce51a?w=200&h=200&fit=crop&auto=format', points: 200, category: 'Phụ kiện', partner: 'EcoFashion VN', available: true, stock: 30 },
  { id: 'r4', title: 'Cây Giống Mini Set', description: 'Bộ 3 cây giống nhỏ trong chậu tái chế: xương rồng, sen đá, trầu bà', image: 'https://images.unsplash.com/photo-1757626065729-a13f763423e1?w=200&h=200&fit=crop&auto=format', points: 300, category: 'Cây cảnh', partner: 'Vườn Xanh Mini', available: true, stock: 15 },
  { id: 'r5', title: 'Voucher Cà Phê Xanh 50k', description: 'Voucher 50.000đ tại chuỗi The Green Cup — cà phê dùng cốc tái chế', image: 'https://images.unsplash.com/photo-1775233212408-44621868508a?w=200&h=200&fit=crop&auto=format', points: 500, category: 'Ăn uống', partner: 'The Green Cup', available: true, stock: 100 },
  { id: 'r6', title: 'Bình Nước Inox 500ml', description: 'Bình nước inox thay thế chai nhựa dùng một lần. Giữ nhiệt 12 giờ', image: 'https://images.unsplash.com/photo-1776880858371-a2893dc61fa6?w=200&h=200&fit=crop&auto=format', points: 800, category: 'Phụ kiện', partner: 'EcoLife Store', available: true, stock: 20 },
  { id: 'r7', title: 'Voucher EcoStore 100k', description: 'Voucher mua hàng 100.000đ tại EcoStore — cửa hàng sản phẩm thân thiện môi trường', image: 'https://images.unsplash.com/photo-1780398021247-1b846ecc2de9?w=200&h=200&fit=crop&auto=format', points: 1000, category: 'Mua sắm', partner: 'EcoStore VN', available: false, stock: 0 },
];

// ─── Recycling Points ──────────────────────────────────────────────────────
export const recyclingPoints: RecyclingPoint[] = [
  { id: 'rp1', name: 'Trung Tâm Tái Chế Hoàn Kiếm', address: '12 Hàng Bài, Hoàn Kiếm, Hà Nội', types: ['Nhựa', 'Giấy', 'Kim loại', 'Thủy tinh'], hours: '7:00 - 18:00 (T2-T7)', phone: '024 3825 1234', rating: 4.8, reviews: 234, distance: '1.2km', x: 55, y: 40 },
  { id: 'rp2', name: 'Điểm Eco Station Cầu Giấy', address: '45 Trần Thái Tông, Cầu Giấy, Hà Nội', types: ['Nhựa', 'Điện tử', 'Pin'], hours: '8:00 - 20:00 (T2-CN)', phone: '024 3781 5678', rating: 4.6, reviews: 156, distance: '2.8km', x: 25, y: 30 },
  { id: 'rp3', name: 'Eco Hub Đống Đa', address: '78 Xã Đàn, Đống Đa, Hà Nội', types: ['Tất cả loại'], hours: '6:30 - 19:00 (Hàng ngày)', phone: '024 3511 9999', rating: 4.9, reviews: 412, distance: '0.9km', x: 50, y: 55 },
  { id: 'rp4', name: 'Trạm Thu Gom Điện Tử Nam Từ Liêm', address: '15 Mễ Trì, Nam Từ Liêm, Hà Nội', types: ['Điện tử', 'Pin', 'Thiết bị'], hours: '8:00 - 17:00 (T2-T6)', phone: '024 3764 3456', rating: 4.4, reviews: 89, distance: '4.5km', x: 20, y: 65 },
  { id: 'rp5', name: 'Điểm Tái Chế Thanh Xuân', address: '32 Nguyễn Trãi, Thanh Xuân, Hà Nội', types: ['Nhựa', 'Giấy', 'Vải'], hours: '7:30 - 18:30 (T2-T7)', phone: '024 3558 7890', rating: 4.7, reviews: 178, distance: '3.1km', x: 60, y: 70 },
];

// ─── Materials ────────────────────────────────────────────────────────────
export const materials: Material[] = [
  { id: 'm1', name: 'Nhựa PET', code: '#1', icon: '🧴', color: '#3b82f6', bgColor: '#dbeafe', recyclable: true, recyclingRate: '94%', tips: ['Rửa sạch trước khi bỏ', 'Không cần bỏ nhãn', 'Có thể dẹp lại để tiết kiệm chỗ'], commonItems: ['Chai nước', 'Chai nước ngọt', 'Hũ đựng dầu ăn'], processingTime: '450 năm tự phân hủy', ecoFact: '1 tấn nhựa PET tái chế = tiết kiệm 5.8 tỷ BTU năng lượng!' },
  { id: 'm2', name: 'Nhựa HDPE', code: '#2', icon: '🛢️', color: '#8b5cf6', bgColor: '#ede9fe', recyclable: true, recyclingRate: '87%', tips: ['Loại nhựa an toàn nhất', 'Bỏ vào thùng nhựa cứng', 'Không cần rửa sạch 100%'], commonItems: ['Bình sữa', 'Hộp sữa chua', 'Túi nhựa cứng'], processingTime: '400 năm tự phân hủy', ecoFact: 'HDPE là nhựa dễ tái chế nhất, tỉ lệ thu hồi cao nhất!' },
  { id: 'm3', name: 'Thủy Tinh', code: 'GL', icon: '🍾', color: '#06b6d4', bgColor: '#cffafe', recyclable: true, recyclingRate: '100%', tips: ['Tháo nắp kim loại', 'Rửa sạch', 'Không trộn với kính cửa sổ'], commonItems: ['Chai rượu', 'Lọ thủy tinh', 'Chai nước'], processingTime: '1 triệu năm tự phân hủy', ecoFact: 'Thủy tinh tái chế được vô số lần mà không mất chất lượng!' },
  { id: 'm4', name: 'Giấy & Carton', code: 'PP', icon: '📦', color: '#f59e0b', bgColor: '#fef3c7', recyclable: true, recyclingRate: '78%', tips: ['Giấy khô mới tái chế được', 'Giấy có lớp phủ nhựa không tái chế', 'Hộp pizza có dầu mỡ không tái chế'], commonItems: ['Hộp carton', 'Báo cũ', 'Vở học'], processingTime: '6 tuần tự phân hủy', ecoFact: '1 tấn giấy tái chế = cứu 17 cây xanh + 26.500 lít nước!' },
  { id: 'm5', name: 'Kim Loại / Nhôm', code: 'AL', icon: '🥫', color: '#6b7280', bgColor: '#f3f4f6', recyclable: true, recyclingRate: '96%', tips: ['Rửa sạch lon', 'Dẹp lại để tiết kiệm chỗ', 'Tất cả kim loại đều tái chế được'], commonItems: ['Lon bia', 'Lon nước ngọt', 'Hộp thiếc'], processingTime: '200+ năm tự phân hủy', ecoFact: 'Tái chế nhôm tiết kiệm 95% năng lượng so với sản xuất mới!' },
  { id: 'm6', name: 'Vải & Quần Áo', code: 'TX', icon: '👕', color: '#ec4899', bgColor: '#fce7f3', recyclable: true, recyclingRate: '65%', tips: ['Quần áo còn dùng được → quyên góp', 'Vải rách → làm giẻ lau', 'Không bỏ vào thùng rác thông thường'], commonItems: ['Quần áo cũ', 'Vải thừa', 'Ga trải giường'], processingTime: '20-200 năm tự phân hủy', ecoFact: 'Ngành thời trang gây ra 10% lượng khí thải CO₂ toàn cầu!' },
  { id: 'm7', name: 'Rác Điện Tử', code: 'E-W', icon: '💻', color: '#10b981', bgColor: '#d1fae5', recyclable: true, recyclingRate: '20%', tips: ['KHÔNG bỏ vào thùng rác thông thường', 'Mang đến điểm thu gom chuyên dụng', 'Xóa dữ liệu trước khi bỏ'], commonItems: ['Điện thoại cũ', 'Laptop hỏng', 'Pin', 'Tai nghe'], processingTime: 'Không tự phân hủy', ecoFact: '1 điện thoại cũ chứa vàng, bạc, đồng có thể thu hồi!' },
  { id: 'm8', name: 'Cao Su & Lốp Xe', code: 'RB', icon: '🔄', color: '#1b4332', bgColor: '#d1fae5', recyclable: true, recyclingRate: '45%', tips: ['Liên hệ garage/tiệm sửa xe để thu gom', 'Có thể làm đồ chơi, sân chơi', 'Không đốt cao su'], commonItems: ['Lốp xe máy', 'Lốp ô tô', 'Đế giày cũ'], processingTime: '50-80 năm tự phân hủy', ecoFact: 'Cao su tái chế làm sân chơi cho trẻ em và mặt đường chống ồn!' },
];

// ─── Impact Stats ──────────────────────────────────────────────────────────
export const impactStats: ImpactStat[] = [
  { month: 'T4', kg: 6, co2: 12, trees: 0.4, water: 158 },
  { month: 'T5', kg: 8, co2: 16, trees: 0.5, water: 211 },
  { month: 'T6', kg: 11, co2: 22, trees: 0.7, water: 290 },
  { month: 'T7', kg: 9, co2: 18, trees: 0.6, water: 237 },
  { month: 'T8', kg: 14, co2: 28, trees: 0.9, water: 369 },
  { month: 'T9', kg: 17, co2: 34, trees: 1.1, water: 448 },
  { month: 'T10', kg: 24, co2: 48, trees: 1.5, water: 632 },
];
