import { useState } from 'react';
import { recyclingTips, challenges, marketItems, users } from '../data';
import { useNav } from '../navigation';

type Section = 'tips' | 'challenges' | 'market';

export default function ExploreScreen() {
  const { push } = useNav();
  const [section, setSection] = useState<Section>('tips');
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('Tất cả');

  const categories = ['Tất cả', 'Nhựa', 'Thủy tinh', 'Cao su', 'Giấy', 'Điện tử', 'Vải'];
  const difficulties = { easy: { label: 'Dễ', color: '#22c55e' }, medium: { label: 'Trung bình', color: '#f59e0b' }, hard: { label: 'Khó', color: '#ef4444' } };

  const filteredTips = recyclingTips.filter(t =>
    (activeCategory === 'Tất cả' || t.material.includes(activeCategory)) &&
    (!search || t.title.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="h-full flex flex-col" style={{ background: '#f0fdf4' }}>
      {/* Header */}
      <div className="flex-none bg-white px-4 pt-12 pb-3" style={{ borderBottom: '1px solid #e8f5e9' }}>
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold" style={{ color: '#1b4332', fontFamily: 'Fraunces, Georgia, serif' }}>Khám phá ♻️</h1>
          <div className="flex gap-2">
            <button onClick={() => push({ screen: 'recycling-map' })} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#f0fdf4', border: '1px solid #e8f5e9' }}>
              <span className="text-lg">🗺️</span>
            </button>
            <button onClick={() => push({ screen: 'material-guide' })} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#f0fdf4', border: '1px solid #e8f5e9' }}>
              <span className="text-lg">📚</span>
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <svg viewBox="0 0 24 24" className="absolute left-3 top-3 w-4 h-4" fill="none" stroke="#9ca3af" strokeWidth={2} strokeLinecap="round">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Tìm kiếm mẹo tái chế..."
            className="w-full pl-9 pr-4 py-2.5 rounded-2xl text-sm text-gray-700 placeholder-gray-300 outline-none"
            style={{ background: '#f0fdf4', border: '1px solid #e8f5e9' }}
          />
        </div>

        {/* Tabs */}
        <div className="flex rounded-2xl p-1" style={{ background: '#f0fdf4' }}>
          {([['tips', '💡 Mẹo hay'], ['challenges', '🏆 Thử thách'], ['market', '🛍️ Trao đổi']] as [Section, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSection(key)}
              className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: section === key ? 'white' : 'transparent',
                color: section === key ? '#1b4332' : '#9ca3af',
                boxShadow: section === key ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Tips Section */}
        {section === 'tips' && (
          <>
            <div className="px-4 pt-3 pb-2 flex gap-2 overflow-x-auto">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className="flex-none px-3.5 py-1.5 rounded-full text-xs font-medium transition-all"
                  style={{
                    background: activeCategory === cat ? '#2d6a4f' : 'white',
                    color: activeCategory === cat ? 'white' : '#6b7280',
                    border: `1.5px solid ${activeCategory === cat ? '#2d6a4f' : '#e8f5e9'}`,
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>

            {filteredTips[0] && (
              <button onClick={() => push({ screen: 'guide-detail', tipId: filteredTips[0].id })} className="mx-4 mb-4 rounded-3xl overflow-hidden relative block w-[calc(100%-2rem)]" style={{ height: 180 }}>
                <img src={filteredTips[0].image} alt={filteredTips[0].title} className="w-full h-full object-cover" />
                <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, rgba(27,67,50,0.85) 0%, transparent 70%)' }} />
                <div className="absolute inset-0 p-5 flex flex-col justify-end text-left">
                  <span className="text-xs text-green-300 font-semibold uppercase tracking-wider mb-1">✨ Nổi bật</span>
                  <h3 className="text-white font-bold text-base leading-snug">{filteredTips[0].title}</h3>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-green-200">⏱ {filteredTips[0].time}</span>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: difficulties[filteredTips[0].difficulty].color + '30', color: difficulties[filteredTips[0].difficulty].color }}>
                      {difficulties[filteredTips[0].difficulty].label}
                    </span>
                    <span className="text-xs text-green-200">❤️ {filteredTips[0].likes.toLocaleString()}</span>
                  </div>
                </div>
              </button>
            )}

            <div className="grid grid-cols-2 gap-3 px-4 pb-6">
              {filteredTips.slice(1).map(tip => (
                <button key={tip.id} onClick={() => push({ screen: 'guide-detail', tipId: tip.id })} className="bg-white rounded-2xl overflow-hidden text-left" style={{ border: '1px solid #e8f5e9' }}>
                  <div className="relative" style={{ height: 120 }}>
                    <img src={tip.image} alt={tip.title} className="w-full h-full object-cover" />
                    <span className="absolute top-2 right-2 text-xs font-medium px-1.5 py-0.5 rounded-full" style={{ background: difficulties[tip.difficulty].color + 'cc', color: 'white' }}>
                      {difficulties[tip.difficulty].label}
                    </span>
                  </div>
                  <div className="p-2.5">
                    <p className="text-xs font-semibold text-gray-800 leading-snug mb-1 line-clamp-2">{tip.title}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-gray-400">⏱ {tip.time}</span>
                      <span className="text-[10px] text-red-400">❤️ {tip.likes >= 1000 ? (tip.likes / 1000).toFixed(1) + 'k' : tip.likes}</span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">bởi {tip.author.split(' ').slice(-1)[0]}</p>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Challenges Section */}
        {section === 'challenges' && (
          <div className="px-4 py-4 space-y-3">
            {/* Leaderboard teaser */}
            <button onClick={() => push({ screen: 'leaderboard' })} className="w-full rounded-3xl p-4 text-left" style={{ background: 'linear-gradient(135deg, #1b4332, #2d6a4f)' }}>
              <p className="text-green-300 text-xs font-semibold mb-2">🏆 BẢNG XẾP HẠNG TUẦN — Nhấn để xem →</p>
              {[{ rank: '🥇', name: 'Lê Thị Hoa', pts: 3450 }, { rank: '🥈', name: 'Trần Văn Minh', pts: 2100 }, { rank: '🥉', name: 'Bùi Thị Thu', pts: 1320 }].map(({ rank, name, pts }) => (
                <div key={name} className="flex items-center justify-between py-1.5">
                  <span className="text-base">{rank}</span>
                  <span className="text-white text-sm font-medium flex-1 ml-2">{name}</span>
                  <span className="text-green-300 text-sm font-bold">{pts.toLocaleString()}</span>
                </div>
              ))}
            </button>

            {/* Reward shop teaser */}
            <button onClick={() => push({ screen: 'reward-shop' })} className="w-full rounded-3xl p-4 flex items-center gap-3 text-left" style={{ background: '#fef3c7', border: '1px solid #fbbf24' }}>
              <span className="text-3xl">🛒</span>
              <div>
                <p className="font-bold text-amber-900">Cửa hàng đổi thưởng</p>
                <p className="text-xs text-amber-700">Dùng điểm Eco để đổi phần thưởng hấp dẫn!</p>
              </div>
              <span className="ml-auto text-amber-600">→</span>
            </button>

            {challenges.map(ch => (
              <button key={ch.id} onClick={() => push({ screen: 'challenge-detail', challengeId: ch.id })} className="w-full bg-white rounded-3xl p-4 text-left" style={{ border: '1px solid #e8f5e9' }}>
                <div className="flex items-start gap-3">
                  <span className="text-3xl">{ch.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm text-gray-900 leading-snug">{ch.title}</h3>
                      {ch.joined && <span className="flex-none text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: '#d1fae5', color: '#065f46' }}>Đang tham gia</span>}
                    </div>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">{ch.description}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-[10px] text-gray-400">👥 {ch.participants.toLocaleString()}</span>
                      <span className="text-[10px] text-gray-400">🎯 {ch.target}</span>
                      <span className="text-[10px] text-gray-400">📅 {ch.deadline}</span>
                    </div>
                    {ch.joined && ch.progress !== undefined && ch.maxProgress && (
                      <div className="mt-3">
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="text-gray-500">Tiến độ</span>
                          <span className="font-semibold" style={{ color: '#2d6a4f' }}>{ch.progress}/{ch.maxProgress}</span>
                        </div>
                        <div className="h-2 rounded-full" style={{ background: '#e8f5e9' }}>
                          <div className="h-2 rounded-full" style={{ width: `${(ch.progress / ch.maxProgress) * 100}%`, background: 'linear-gradient(90deg, #2d6a4f, #52b788)' }} />
                        </div>
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-xs font-bold" style={{ color: '#f59e0b' }}>🏅 +{ch.reward} điểm</span>
                      <span className="text-xs font-semibold px-3 py-1.5 rounded-xl" style={{ background: '#f0fdf4', color: '#2d6a4f' }}>Xem chi tiết →</span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Marketplace Section */}
        {section === 'market' && (
          <div className="px-4 py-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-800">Đồ tái chế gần bạn</p>
              <button onClick={() => push({ screen: 'create-listing' })} className="text-xs font-semibold px-3 py-1.5 rounded-xl text-white" style={{ background: '#2d6a4f' }}>
                + Đăng tin
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {marketItems.map(item => {
                const seller = users.find(u => u.id === item.userId)!;
                const priceDisplay = item.price === 'free' ? 'Miễn phí 💚' : item.price === 'trade' ? 'Đổi đồ 🔄' : `${Number(item.price).toLocaleString()}đ`;
                const priceColor = item.price === 'free' ? '#22c55e' : item.price === 'trade' ? '#f59e0b' : '#1b4332';
                return (
                  <button key={item.id} onClick={() => push({ screen: 'market-detail', itemId: item.id })} className="bg-white rounded-2xl overflow-hidden text-left" style={{ border: '1px solid #e8f5e9' }}>
                    <div className="relative" style={{ height: 130 }}>
                      <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                      <span className="absolute top-2 left-2 text-xs font-bold px-2 py-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.92)', color: priceColor }}>
                        {priceDisplay}
                      </span>
                      {item.condition === 'new' && (
                        <span className="absolute top-2 right-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: '#22c55e', color: 'white' }}>Mới</span>
                      )}
                    </div>
                    <div className="p-2.5">
                      <p className="text-xs font-semibold text-gray-800 leading-snug mb-1">{item.title}</p>
                      <div className="flex items-center gap-1.5">
                        <img src={seller.avatar} alt={seller.name} className="w-4 h-4 rounded-full object-cover" />
                        <span className="text-[10px] text-gray-400">{seller.name.split(' ').slice(-1)[0]}</span>
                        <span className="text-gray-200">·</span>
                        <span className="text-[10px] text-gray-400">📍{item.location}</span>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] text-gray-400">👀 {item.interested} quan tâm</span>
                        <span className="text-[10px] font-semibold px-2 py-1 rounded-lg" style={{ background: '#f0fdf4', color: '#2d6a4f' }}>Liên hệ</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Extra CTAs */}
            <div className="flex gap-3 mt-4">
              <button onClick={() => push({ screen: 'groups' })} className="flex-1 py-3 rounded-2xl text-sm font-semibold" style={{ background: '#f0fdf4', color: '#2d6a4f', border: '1px solid #bbf7d0' }}>
                👥 Cộng đồng
              </button>
              <button onClick={() => push({ screen: 'events' })} className="flex-1 py-3 rounded-2xl text-sm font-semibold" style={{ background: '#f0fdf4', color: '#2d6a4f', border: '1px solid #bbf7d0' }}>
                📅 Sự kiện
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
