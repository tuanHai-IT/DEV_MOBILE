import { useState } from 'react';

const faqs = [
  { q: 'Làm sao để kiếm điểm Eco?', a: 'Tham gia thử thách, đăng bài tái chế, giới thiệu bạn bè và check-in tại điểm thu gom để kiếm điểm Eco. Mỗi hành động đều được thưởng điểm khác nhau.' },
  { q: 'Điểm Eco dùng để làm gì?', a: 'Điểm Eco có thể đổi thành phiếu giảm giá mua hàng, cây xanh, hoặc các phần thưởng đặc biệt từ đối tác của EcoShare.' },
  { q: 'Làm sao để đăng bài tái chế?', a: 'Nhấn nút "+" ở thanh tab bên dưới, chọn loại bài đăng và thêm hình ảnh + mô tả. Bài đăng của bạn sẽ xuất hiện trên newsfeed của bạn bè.' },
  { q: 'Tôi không tìm thấy điểm thu gom gần nhà?', a: 'Thử mở "Bản đồ tái chế" và điều chỉnh bộ lọc loại vật liệu. Nếu vẫn không thấy, bạn có thể đề xuất thêm điểm mới qua mục Báo cáo.' },
  { q: 'Làm sao xóa tài khoản?', a: 'Vào Cài đặt > Tài khoản > Xóa tài khoản. Lưu ý rằng tất cả dữ liệu sẽ bị xóa vĩnh viễn sau 30 ngày.' },
  { q: 'App có hỗ trợ tiếng Anh không?', a: 'Hiện tại EcoShare chỉ hỗ trợ tiếng Việt. Chúng tôi đang phát triển thêm các ngôn ngữ khác trong tương lai.' },
];

const topics = [
  { icon: '🏆', label: 'Điểm & Phần thưởng' },
  { icon: '📸', label: 'Đăng bài' },
  { icon: '♻️', label: 'Tái chế' },
  { icon: '💬', label: 'Chat & Bạn bè' },
  { icon: '🔒', label: 'Bảo mật' },
  { icon: '💳', label: 'Thanh toán' },
];

export default function HelpCenterScreen({ onBack }: { onBack: () => void }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [search, setSearch] = useState('');

  const filtered = faqs.filter(f => f.q.toLowerCase().includes(search.toLowerCase()) || f.a.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="h-full flex flex-col" style={{ background: '#f0fdf4' }}>
      {/* Header */}
      <div className="px-4 pt-12 pb-6" style={{ background: 'linear-gradient(135deg, #1b4332, #2d6a4f)' }}>
        <div className="flex items-center gap-3 mb-4">
          <button onClick={onBack} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }}>
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <h1 className="text-xl font-bold text-white" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>🤝 Trung Tâm Hỗ Trợ</h1>
        </div>
        <div className="relative">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tìm kiếm câu hỏi..."
            className="w-full py-3 pl-10 pr-4 rounded-2xl text-sm text-gray-800 outline-none"
            style={{ background: 'rgba(255,255,255,0.95)' }}
          />
          <svg viewBox="0 0 24 24" className="w-4 h-4 absolute left-3 top-3.5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {!search && (
          <>
            {/* Topics */}
            <div className="p-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Chủ đề phổ biến</p>
              <div className="grid grid-cols-3 gap-2">
                {topics.map(t => (
                  <button key={t.label} className="bg-white rounded-2xl p-3 flex flex-col items-center gap-1.5" style={{ border: '1px solid #e8f5e9' }}>
                    <span className="text-2xl">{t.icon}</span>
                    <span className="text-[10px] font-medium text-gray-600 text-center leading-tight">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Contact */}
            <div className="mx-4 mb-4 rounded-3xl overflow-hidden" style={{ border: '1px solid #e8f5e9' }}>
              <div className="p-4" style={{ background: 'linear-gradient(135deg, #f0fdf4, #d1fae5)' }}>
                <p className="font-semibold text-gray-800 mb-3 text-sm">📞 Liên hệ trực tiếp</p>
                {[['💬', 'Chat hỗ trợ', 'Phản hồi trong 5 phút'], ['📧', 'Email', 'support@ecoshare.vn'], ['📱', 'Zalo OA', '@EcoShare VN']].map(([icon, label, val]) => (
                  <div key={label} className="flex items-center gap-3 py-2 border-b last:border-0" style={{ borderColor: '#bbf7d0' }}>
                    <span className="text-xl">{icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{label}</p>
                      <p className="text-xs text-gray-400">{val}</p>
                    </div>
                    <span className="ml-auto text-gray-300">›</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* FAQs */}
        <div className="px-4 pb-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
            {search ? `Kết quả cho "${search}"` : 'Câu hỏi thường gặp'}
          </p>
          {filtered.length === 0 && (
            <div className="text-center py-8">
              <div className="text-4xl mb-3">🔍</div>
              <p className="text-sm text-gray-500">Không tìm thấy kết quả</p>
            </div>
          )}
          <div className="space-y-2">
            {filtered.map((faq, i) => (
              <div key={i} className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid #e8f5e9' }}>
                <button onClick={() => setExpanded(expanded === i ? null : i)} className="w-full flex items-center gap-3 p-4 text-left">
                  <p className="flex-1 text-sm font-semibold text-gray-800">{faq.q}</p>
                  <span className="text-gray-400 text-sm transition-transform" style={{ transform: expanded === i ? 'rotate(180deg)' : 'none' }}>›</span>
                </button>
                {expanded === i && (
                  <div className="px-4 pb-4">
                    <p className="text-sm text-gray-500 leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
