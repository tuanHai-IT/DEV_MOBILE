import { useState } from 'react';

const slides = [
  { icon: '♻️', title: 'Chào mừng đến EcoShare!', desc: 'Cộng đồng tái chế lớn nhất Việt Nam — nơi mọi người cùng chia sẻ, học hỏi và hành động vì môi trường xanh.', bg: 'linear-gradient(135deg, #1b4332, #2d6a4f)', img: 'https://images.unsplash.com/photo-1780398021247-1b846ecc2de9?w=430&h=400&fit=crop&auto=format' },
  { icon: '📸', title: 'Chia Sẻ Sản Phẩm Tái Chế', desc: 'Đăng ảnh những vật dụng tái chế bạn tự làm. Truyền cảm hứng cho cộng đồng và nhận điểm Eco mỗi ngày!', bg: 'linear-gradient(135deg, #0369a1, #0ea5e9)', img: 'https://images.unsplash.com/photo-1525695230005-efd074980869?w=430&h=400&fit=crop&auto=format' },
  { icon: '🏆', title: 'Thử Thách & Phần Thưởng', desc: 'Tham gia thử thách tái chế, leo hạng bảng xếp hạng và đổi điểm Eco lấy voucher, quà tặng thực tế!', bg: 'linear-gradient(135deg, #92400e, #d97706)', img: 'https://images.unsplash.com/photo-1779966946521-e9317485653b?w=430&h=400&fit=crop&auto=format' },
  { icon: '🌍', title: 'Cùng Nhau Tạo Thay Đổi', desc: 'Mỗi hành động nhỏ tạo ra tác động lớn. Cùng 1.247 thành viên tiết kiệm 89kg rác mỗi ngày!', bg: 'linear-gradient(135deg, #1b4332, #52b788)', img: 'https://images.unsplash.com/photo-1757626065729-a13f763423e1?w=430&h=400&fit=crop&auto=format' },
];

export default function OnboardingScreen({ onComplete }: { onComplete: () => void }) {
  const [idx, setIdx] = useState(0);
  const slide = slides[idx];
  const isLast = idx === slides.length - 1;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Image area */}
      <div className="relative" style={{ height: '55%' }}>
        <img src={slide.img} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0" style={{ background: `${slide.bg.replace('linear-gradient', 'linear-gradient').split(')')[0]}80)` }} />
        <button onClick={onComplete} className="absolute top-14 right-5 text-white/70 text-sm font-medium px-3 py-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }}>
          Bỏ qua
        </button>
        <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-6 gap-1.5">
          {slides.map((_, i) => (
            <div key={i} className="rounded-full transition-all" style={{ width: i === idx ? 24 : 8, height: 8, background: i === idx ? 'white' : 'rgba(255,255,255,0.4)' }} />
          ))}
        </div>
      </div>

      {/* Text area */}
      <div className="flex-1 bg-white flex flex-col px-8 pt-8 pb-10">
        <span className="text-5xl mb-4">{slide.icon}</span>
        <h2 className="text-2xl font-bold mb-3 leading-snug" style={{ color: '#1b4332', fontFamily: 'Fraunces, Georgia, serif' }}>
          {slide.title}
        </h2>
        <p className="text-gray-500 text-sm leading-relaxed flex-1">{slide.desc}</p>

        <div className="flex gap-3 mt-6">
          {idx > 0 && (
            <button onClick={() => setIdx(i => i - 1)} className="flex-1 py-3.5 rounded-2xl border text-sm font-semibold" style={{ borderColor: '#bbf7d0', color: '#2d6a4f' }}>
              Quay lại
            </button>
          )}
          <button
            onClick={() => isLast ? onComplete() : setIdx(i => i + 1)}
            className="flex-1 py-3.5 rounded-2xl text-white font-semibold text-sm transition-all active:scale-95"
            style={{ background: 'linear-gradient(135deg, #1b4332, #52b788)', boxShadow: '0 6px 20px rgba(45,106,79,0.4)' }}
          >
            {isLast ? '🌱 Bắt đầu ngay!' : 'Tiếp theo →'}
          </button>
        </div>
      </div>
    </div>
  );
}
