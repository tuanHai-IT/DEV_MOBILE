import { useState } from 'react';
import { marketItems } from '../data';
import { users } from '../data';

export default function MarketItemDetailScreen({ itemId, onBack }: { itemId: string; onBack: () => void }) {
  const item = marketItems.find(m => m.id === itemId);
  const [saved, setSaved] = useState(false);
  const [msgSent, setMsgSent] = useState(false);
  if (!item) return null;

  const seller = users[0];

  return (
    <div className="h-full flex flex-col" style={{ background: '#f0fdf4' }}>
      <div className="flex-1 overflow-y-auto">
        {/* Image */}
        <div className="relative">
          <img src={item.image.replace('w=300&h=300', 'w=430&h=340')} alt={item.title} className="w-full object-cover" style={{ height: 280 }} />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, transparent 40%, transparent 60%, rgba(0,0,0,0.4) 100%)' }} />
          <button onClick={onBack} className="absolute top-12 left-4 w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)' }}>
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <button onClick={() => setSaved(!saved)} className="absolute top-12 right-4 w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)' }}>
            <span className="text-lg">{saved ? '🔖' : '🏷️'}</span>
          </button>
          <div className="absolute bottom-4 left-4">
            <span className="px-3 py-1.5 rounded-full text-xs font-bold text-white" style={{ background: item.category === 'Trao đổi' ? '#2d6a4f' : '#f59e0b' }}>
              {item.category}
            </span>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Title + price */}
          <div className="bg-white rounded-3xl p-4" style={{ border: '1px solid #e8f5e9' }}>
            <h1 className="text-xl font-bold text-gray-900 mb-2" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>{item.title}</h1>
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold" style={{ color: '#2d6a4f' }}>
                {item.price === 0 ? '🎁 Miễn phí' : `${item.price.toLocaleString()}₫`}
              </p>
              <span className="px-3 py-1 rounded-full text-xs font-semibold" style={{ background: '#f0fdf4', color: '#2d6a4f' }}>
                {item.condition}
              </span>
            </div>
          </div>

          {/* Seller */}
          <div className="bg-white rounded-3xl p-4 flex items-center gap-3" style={{ border: '1px solid #e8f5e9' }}>
            <img src={seller.avatar} alt={seller.name} className="w-12 h-12 rounded-xl object-cover" />
            <div className="flex-1">
              <p className="font-bold text-gray-900 text-sm">{seller.name}</p>
              <div className="flex items-center gap-1">
                <span className="text-yellow-400 text-xs">★★★★★</span>
                <span className="text-xs text-gray-400">(47 đánh giá)</span>
              </div>
              <p className="text-xs text-gray-400">{seller.location} • Phản hồi nhanh</p>
            </div>
            <span className="w-9 h-9 rounded-xl flex items-center justify-center text-sm" style={{ background: '#f0fdf4' }}>→</span>
          </div>

          {/* Description */}
          <div className="bg-white rounded-3xl p-4" style={{ border: '1px solid #e8f5e9' }}>
            <p className="font-semibold text-gray-800 mb-2 text-sm">📋 Mô tả</p>
            <p className="text-sm text-gray-600 leading-relaxed">
              Sản phẩm còn rất tốt, đã qua sử dụng nhẹ. Không có vết xước hay hỏng hóc. Đã vệ sinh sạch sẽ trước khi đăng. Nhận trực tiếp hoặc ship toàn quốc.
            </p>
          </div>

          {/* Eco impact */}
          <div className="rounded-3xl p-4" style={{ background: 'linear-gradient(135deg, #1b4332, #2d6a4f)' }}>
            <p className="text-green-300 text-xs font-bold mb-2">🌍 TÁC ĐỘNG MÔI TRƯỜNG</p>
            <p className="text-white text-sm leading-relaxed">
              Mua đồ cũ giúp tiết kiệm <span className="font-bold">2.3kg CO₂</span> và giảm rác thải điện tử. Bạn đang làm điều tốt cho hành tinh! 🌱
            </p>
          </div>

          {/* Location */}
          <div className="bg-white rounded-3xl p-4 flex items-center gap-3" style={{ border: '1px solid #e8f5e9' }}>
            <span className="text-2xl">📍</span>
            <div>
              <p className="text-xs text-gray-400">Vị trí</p>
              <p className="text-sm font-semibold text-gray-800">{seller.location}</p>
            </div>
          </div>
          <div className="h-4" />
        </div>
      </div>

      <div className="bg-white px-4 py-3 flex gap-3" style={{ borderTop: '1px solid #e8f5e9' }}>
        <button onClick={() => setSaved(!saved)} className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
          <span className="text-xl">{saved ? '🔖' : '💾'}</span>
        </button>
        <button
          onClick={() => setMsgSent(true)}
          className="flex-1 py-3 rounded-2xl font-semibold text-sm transition-all active:scale-95"
          style={{ background: msgSent ? '#f0fdf4' : 'linear-gradient(135deg, #1b4332, #52b788)', color: msgSent ? '#2d6a4f' : 'white', border: msgSent ? '1.5px solid #bbf7d0' : 'none', boxShadow: msgSent ? 'none' : '0 6px 20px rgba(45,106,79,0.4)' }}
        >
          {msgSent ? '✓ Đã gửi tin nhắn' : '💬 Nhắn tin người bán'}
        </button>
      </div>
    </div>
  );
}
