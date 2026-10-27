import { useState } from 'react';
import { recyclingPoints } from '../moreData';
import type { Route } from '../navigation';

interface Props { onBack: () => void; onPush: (r: Route) => void; }

export default function RecyclingMapScreen({ onBack, onPush }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState('Tất cả');
  const types = ['Tất cả', 'Nhựa', 'Giấy', 'Điện tử', 'Pin'];

  const selectedPoint = recyclingPoints.find(p => p.id === selected);

  return (
    <div className="h-full flex flex-col" style={{ background: '#f0fdf4' }}>
      <div className="bg-white px-4 pt-12 pb-3 flex items-center gap-3" style={{ borderBottom: '1px solid #e8f5e9' }}>
        <button onClick={onBack} className="w-9 h-9 rounded-xl flex items-center justify-center flex-none" style={{ background: '#f0fdf4' }}>
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="#1b4332" strokeWidth={2} strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <h1 className="flex-1 text-xl font-bold" style={{ color: '#1b4332', fontFamily: 'Fraunces, Georgia, serif' }}>Bản Đồ Tái Chế 📍</h1>
        <button className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#f0fdf4' }}>
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="#2d6a4f" strokeWidth={1.8} strokeLinecap="round"><circle cx="12" cy="12" r="3" /><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" /></svg>
        </button>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Map area */}
        <div className="relative flex-1" style={{ background: '#e8f5e9', minHeight: 0 }}>
          {/* Fake map tiles */}
          <svg viewBox="0 0 100 100" className="w-full h-full" style={{ maxHeight: '55%' }}>
            <rect width="100" height="100" fill="#e8f5e9" />
            {/* Roads */}
            <path d="M0 50 L100 50" stroke="#fff" strokeWidth="3" />
            <path d="M50 0 L50 100" stroke="#fff" strokeWidth="3" />
            <path d="M0 30 L60 30 L80 50 L100 50" stroke="#fff" strokeWidth="2" />
            <path d="M30 0 L30 40 L50 50" stroke="#fff" strokeWidth="2" />
            <path d="M70 50 L70 100" stroke="#fff" strokeWidth="2" />
            <path d="M0 70 L40 70 L50 80 L100 80" stroke="#fff" strokeWidth="2" />
            {/* Blocks */}
            {[[5,5,20,20],[35,5,20,20],[65,5,28,20],[5,35,20,10],[5,55,20,10],[75,60,20,15],[5,80,20,15],[30,80,20,15]].map(([x,y,w,h],i) => (
              <rect key={i} x={x} y={y} width={w} height={h} fill="#d1fae5" rx="2" />
            ))}
            {/* User location */}
            <circle cx="50" cy="50" r="4" fill="#2d6a4f" />
            <circle cx="50" cy="50" r="8" fill="#2d6a4f" fillOpacity="0.2" />
            {/* Points */}
            {recyclingPoints.map(p => (
              <g key={p.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(selected === p.id ? null : p.id)}>
                <circle cx={p.x} cy={p.y} r={selected === p.id ? 5 : 4} fill={selected === p.id ? '#1b4332' : '#52b788'} stroke="white" strokeWidth="1.5" />
                <text x={p.x} y={p.y - 7} textAnchor="middle" fontSize="3.5" fill="#1b4332" fontWeight="bold">♻️</text>
              </g>
            ))}
          </svg>

          {/* Filters */}
          <div className="absolute top-3 left-3 right-3 flex gap-2 overflow-x-auto">
            {types.map(t => (
              <button key={t} onClick={() => setFilter(t)} className="flex-none px-3 py-1.5 rounded-full text-xs font-semibold shadow" style={{ background: filter === t ? '#2d6a4f' : 'white', color: filter === t ? 'white' : '#6b7280' }}>
                {t}
              </button>
            ))}
          </div>

          {/* Selected point tooltip */}
          {selectedPoint && (
            <div className="absolute bottom-3 left-3 right-3 bg-white rounded-2xl p-3 shadow-lg fade-in" style={{ border: '1px solid #e8f5e9' }}>
              <div className="flex items-center justify-between mb-1">
                <p className="font-bold text-sm text-gray-900">{selectedPoint.name}</p>
                <button onClick={() => onPush({ screen: 'recycling-point-detail', pointId: selectedPoint.id })} className="text-xs font-semibold" style={{ color: '#2d6a4f' }}>Chi tiết →</button>
              </div>
              <p className="text-xs text-gray-400">{selectedPoint.address}</p>
              <div className="flex items-center gap-3 mt-1.5">
                <span className="text-xs text-yellow-500">★ {selectedPoint.rating}</span>
                <span className="text-xs text-gray-400">📍 {selectedPoint.distance}</span>
                <span className="text-xs text-gray-400">⏰ {selectedPoint.hours.split(' ')[0]}</span>
              </div>
              <div className="flex gap-1 mt-2">
                {selectedPoint.types.slice(0, 3).map(t => (
                  <span key={t} className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: '#f0fdf4', color: '#2d6a4f' }}>{t}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Points list */}
        <div className="bg-white flex-1 overflow-y-auto" style={{ borderTop: '1px solid #e8f5e9' }}>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider px-4 pt-3 pb-2">{recyclingPoints.length} điểm gần bạn</p>
          {recyclingPoints.map(pt => (
            <button key={pt.id} onClick={() => setSelected(pt.id === selected ? null : pt.id)} className="w-full flex items-center gap-3 px-4 py-3 border-b text-left transition" style={{ borderColor: '#f0fdf4', background: pt.id === selected ? '#f0fdf4' : 'white' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-none" style={{ background: '#d1fae5' }}>
                <span className="text-lg">♻️</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 text-sm truncate">{pt.name}</p>
                <p className="text-xs text-gray-400 truncate">{pt.address}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-yellow-500">★ {pt.rating}</span>
                  <span className="text-xs text-gray-400">({pt.reviews})</span>
                </div>
              </div>
              <div className="text-right flex-none">
                <p className="text-xs font-semibold" style={{ color: '#2d6a4f' }}>{pt.distance}</p>
                <p className="text-[10px] text-gray-400">{pt.types.length} loại</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
