import { useState } from 'react';
import { rewards } from '../moreData';

const categories = ['Tất cả', 'Mã giảm giá', 'Cây xanh', 'Đặc biệt'];

export default function RewardShopScreen({ onBack }: { onBack: () => void }) {
  const [cat, setCat] = useState('Tất cả');
  const [redeemed, setRedeemed] = useState<string[]>([]);
  const myPoints = 1850;

  const filtered = cat === 'Tất cả' ? rewards : rewards.filter(r => r.category === cat);

  return (
    <div className="h-full flex flex-col" style={{ background: '#f0fdf4' }}>
      {/* Header */}
      <div className="relative px-4 pt-12 pb-5" style={{ background: 'linear-gradient(135deg, #1b4332, #2d6a4f)' }}>
        <button onClick={onBack} className="absolute top-12 left-4 w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }}>
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <h1 className="text-2xl font-bold text-white text-center mb-1" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>🛒 Đổi Thưởng</h1>
        <div className="flex items-center justify-center gap-2 mt-3">
          <div className="bg-white/20 rounded-2xl px-4 py-2 flex items-center gap-2">
            <span className="text-xl">⭐</span>
            <div>
              <p className="text-white font-bold text-lg leading-none">{myPoints.toLocaleString()}</p>
              <p className="text-green-200 text-[10px]">điểm Eco của bạn</p>
            </div>
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="bg-white px-4 py-3 flex gap-2 overflow-x-auto" style={{ borderBottom: '1px solid #e8f5e9' }}>
        {categories.map(c => (
          <button key={c} onClick={() => setCat(c)} className="flex-none px-4 py-1.5 rounded-full text-xs font-semibold transition-all" style={{ background: cat === c ? '#2d6a4f' : '#f0fdf4', color: cat === c ? 'white' : '#6b7280' }}>
            {c}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <div className="grid grid-cols-2 gap-3">
          {filtered.map(reward => {
            const canAfford = myPoints >= reward.points;
            const done = redeemed.includes(reward.id);
            return (
              <div key={reward.id} className="bg-white rounded-3xl overflow-hidden" style={{ border: `1px solid ${done ? '#bbf7d0' : '#e8f5e9'}`, opacity: !canAfford ? 0.65 : 1 }}>
                <div className="h-28 flex items-center justify-center overflow-hidden" style={{ background: done ? '#d1fae5' : '#f0fdf4' }}>
                  {done ? <span className="text-5xl">✓</span> : <img src={reward.image} alt={reward.title} className="w-full h-full object-cover" />}
                </div>
                <div className="p-3">
                  <p className="font-bold text-gray-800 text-sm leading-tight mb-1">{reward.title}</p>
                  <p className="text-xs text-gray-400 leading-tight mb-2">{reward.description}</p>
                  {reward.partner && (
                    <p className="text-[10px] text-green-600 font-medium mb-2">Đối tác: {reward.partner}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold" style={{ color: canAfford ? '#f59e0b' : '#9ca3af' }}>
                      ⭐ {reward.points.toLocaleString()}
                    </span>
                    <button
                      disabled={!canAfford || done}
                      onClick={() => setRedeemed(r => [...r, reward.id])}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:cursor-not-allowed"
                      style={{
                        background: done ? '#d1fae5' : canAfford ? 'linear-gradient(135deg, #2d6a4f, #52b788)' : '#e5e7eb',
                        color: done ? '#2d6a4f' : canAfford ? 'white' : '#9ca3af'
                      }}
                    >
                      {done ? '✓ Đã đổi' : canAfford ? 'Đổi ngay' : 'Thiếu điểm'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="h-4" />
      </div>
    </div>
  );
}
