import { badges } from '../moreData';

export default function BadgesScreen({ onBack }: { onBack: () => void }) {
  const earned = badges.filter(b => b.earned);
  const locked = badges.filter(b => !b.earned);

  return (
    <div className="h-full flex flex-col" style={{ background: '#f0fdf4' }}>
      <div className="bg-white px-4 pt-12 pb-3 flex items-center gap-3" style={{ borderBottom: '1px solid #e8f5e9' }}>
        <button onClick={onBack} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#f0fdf4' }}>
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="#1b4332" strokeWidth={2} strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold" style={{ color: '#1b4332', fontFamily: 'Fraunces, Georgia, serif' }}>Huy Hiệu Của Tôi 🏅</h1>
          <p className="text-xs text-gray-400">{earned.length}/{badges.length} huy hiệu đạt được</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {/* Progress */}
        <div className="bg-white rounded-3xl p-4 mb-4" style={{ border: '1px solid #e8f5e9' }}>
          <div className="flex justify-between text-xs mb-2">
            <span className="font-semibold text-gray-700">Tiến độ tổng thể</span>
            <span className="font-bold" style={{ color: '#2d6a4f' }}>{Math.round((earned.length / badges.length) * 100)}%</span>
          </div>
          <div className="h-3 rounded-full" style={{ background: '#f0fdf4' }}>
            <div className="h-3 rounded-full" style={{ width: `${(earned.length / badges.length) * 100}%`, background: 'linear-gradient(90deg, #1b4332, #52b788)' }} />
          </div>
          <p className="text-xs text-gray-400 mt-2 text-center">Còn {locked.length} huy hiệu nữa để hoàn thành bộ sưu tập!</p>
        </div>

        {/* Earned */}
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">✅ Đã đạt được ({earned.length})</p>
        <div className="grid grid-cols-2 gap-3 mb-6">
          {earned.map(badge => (
            <div key={badge.id} className="bg-white rounded-3xl p-4 flex flex-col items-center text-center" style={{ border: '1px solid #e8f5e9' }}>
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-3" style={{ background: badge.bgColor }}>
                {badge.icon}
              </div>
              <p className="font-bold text-sm text-gray-900 mb-0.5">{badge.name}</p>
              <p className="text-[10px] text-gray-400 mb-2">{badge.description}</p>
              <span className="text-[10px] font-semibold px-2 py-1 rounded-full" style={{ background: '#d1fae5', color: '#065f46' }}>
                +{badge.points} điểm
              </span>
              {badge.earnedDate && <p className="text-[10px] text-gray-300 mt-1">Đạt {badge.earnedDate}</p>}
            </div>
          ))}
        </div>

        {/* Locked */}
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">🔒 Chưa đạt ({locked.length})</p>
        <div className="grid grid-cols-2 gap-3 pb-6">
          {locked.map(badge => (
            <div key={badge.id} className="bg-white rounded-3xl p-4 flex flex-col items-center text-center opacity-60" style={{ border: '1px solid #e8f5e9' }}>
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-3 relative" style={{ background: '#f3f4f6', filter: 'grayscale(100%)' }}>
                {badge.icon}
                <span className="absolute inset-0 flex items-center justify-center text-2xl rounded-2xl" style={{ background: 'rgba(0,0,0,0.3)' }}>🔒</span>
              </div>
              <p className="font-bold text-sm text-gray-500 mb-0.5">{badge.name}</p>
              <p className="text-[10px] text-gray-400 mb-2">{badge.requirement}</p>
              <span className="text-[10px] font-semibold px-2 py-1 rounded-full" style={{ background: '#f3f4f6', color: '#9ca3af' }}>
                +{badge.points} điểm
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
