import { recyclingPoints } from '../moreData';

interface Props { pointId?: string; onBack: () => void; }

export default function RecyclingPointDetailScreen({ pointId, onBack }: Props) {
  const point = recyclingPoints.find(p => p.id === pointId) || recyclingPoints[0];

  return (
    <div className="h-full flex flex-col" style={{ background: '#f0fdf4' }}>
      <div className="bg-white px-4 pt-12 pb-3 flex items-center gap-3" style={{ borderBottom: '1px solid #e8f5e9' }}>
        <button onClick={onBack} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#f0fdf4' }}>
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="#1b4332" strokeWidth={2} strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <h1 className="flex-1 text-base font-bold" style={{ color: '#1b4332' }}>Chi tiết điểm thu gom</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="bg-white rounded-3xl overflow-hidden" style={{ border: '1px solid #e8f5e9' }}>
          <div className="p-5">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl mb-4" style={{ background: '#d1fae5' }}>♻️</div>
            <h2 className="text-lg font-bold text-gray-900 mb-1" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>{point.name}</h2>
            <p className="text-gray-500 text-sm mb-3">📍 {point.address}</p>
            <div className="flex items-center gap-1 mb-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} className="text-sm">{i < Math.floor(point.rating) ? '⭐' : '☆'}</span>
              ))}
              <span className="text-sm font-semibold text-gray-700 ml-1">{point.rating}</span>
              <span className="text-gray-400 text-xs">({point.reviews} đánh giá)</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-4 space-y-3" style={{ border: '1px solid #e8f5e9' }}>
          {[['⏰', 'Giờ mở cửa', point.hours], ['📞', 'Điện thoại', point.phone], ['📍', 'Khoảng cách', point.distance]].map(([icon, label, val]) => (
            <div key={label} className="flex items-center gap-3">
              <span className="text-lg w-7 text-center">{icon}</span>
              <div>
                <p className="text-xs text-gray-400">{label}</p>
                <p className="text-sm font-semibold text-gray-800">{val}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-3xl p-4" style={{ border: '1px solid #e8f5e9' }}>
          <p className="font-semibold text-gray-800 mb-3 text-sm">♻️ Loại rác nhận</p>
          <div className="flex flex-wrap gap-2">
            {point.types.map(t => (
              <span key={t} className="px-3 py-1.5 rounded-full text-sm font-medium" style={{ background: '#f0fdf4', color: '#2d6a4f', border: '1px solid #bbf7d0' }}>{t}</span>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button className="flex-1 py-3 rounded-2xl text-sm font-semibold text-white" style={{ background: 'linear-gradient(135deg, #2d6a4f, #52b788)' }}>
            🗺️ Chỉ đường
          </button>
          <button className="flex-1 py-3 rounded-2xl text-sm font-semibold border" style={{ borderColor: '#bbf7d0', color: '#2d6a4f' }}>
            📞 Gọi điện
          </button>
        </div>
      </div>
    </div>
  );
}
