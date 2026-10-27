import { useState } from 'react';
import { events as ecoEvents, type EcoEvent } from '../moreData';

const tabs = ['Sắp tới', 'Đang tham gia', 'Đã qua'];

export default function EventsScreen({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState(0);
  const [registered, setRegistered] = useState<string[]>(['e1']);

  return (
    <div className="h-full flex flex-col" style={{ background: '#f0fdf4' }}>
      <div className="bg-white px-4 pt-12 pb-3" style={{ borderBottom: '1px solid #e8f5e9' }}>
        <div className="flex items-center gap-3 mb-3">
          <button onClick={onBack} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#f0fdf4' }}>
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="#1b4332" strokeWidth={2} strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <h1 className="flex-1 text-xl font-bold" style={{ color: '#1b4332', fontFamily: 'Fraunces, Georgia, serif' }}>📅 Sự Kiện Eco</h1>
        </div>
        <div className="flex gap-2">
          {tabs.map((t, i) => (
            <button key={t} onClick={() => setTab(i)} className="flex-1 py-1.5 rounded-xl text-[11px] font-semibold transition-all" style={{ background: tab === i ? '#2d6a4f' : '#f0fdf4', color: tab === i ? 'white' : '#6b7280' }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Featured */}
        {tab === 0 && (
          <div className="rounded-3xl overflow-hidden relative h-44" style={{ boxShadow: '0 8px 24px rgba(27,67,50,0.2)' }}>
            <img src={ecoEvents[0].image} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(27,67,50,0.9) 0%, transparent 50%)' }} />
            <div className="absolute bottom-4 left-4 right-4">
              <span className="text-xs font-bold px-2 py-1 rounded-full text-white mb-2 inline-block" style={{ background: '#f59e0b' }}>⭐ Nổi bật</span>
              <h3 className="text-white font-bold leading-tight" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>{ecoEvents[0].title}</h3>
              <p className="text-green-200 text-xs mt-1">📅 {ecoEvents[0].date} • 📍 {ecoEvents[0].location}</p>
            </div>
          </div>
        )}

        {ecoEvents.map((event: EcoEvent) => (
          <div key={event.id} className="bg-white rounded-3xl overflow-hidden" style={{ border: '1px solid #e8f5e9', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <div className="relative h-32">
              <img src={event.image} alt={event.title} className="w-full h-full object-cover" />
              <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.5))' }} />
              <div className="absolute top-3 right-3 bg-white/90 rounded-xl px-2 py-1 text-center" style={{ backdropFilter: 'blur(4px)' }}>
                <p className="text-[10px] font-bold" style={{ color: '#2d6a4f' }}>{event.date.split('/')[0]}</p>
                <p className="text-xs font-bold text-gray-800">T{event.date.split('/')[1]}</p>
              </div>
            </div>
            <div className="p-4">
              <h3 className="font-bold text-gray-900 mb-1" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>{event.title}</h3>
              <div className="flex flex-wrap gap-3 mb-3">
                <span className="text-xs text-gray-500">📍 {event.location}</span>
                <span className="text-xs text-gray-500">👥 {event.attendees} người tham dự</span>
                <span className="text-xs text-gray-500">⏰ {event.time}</span>
              </div>
              <p className="text-sm text-gray-500 mb-3 leading-relaxed line-clamp-2">{event.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold" style={{ color: '#f59e0b' }}>+{event.ecoPoints} điểm Eco</span>
                <button
                  onClick={() => setRegistered(r => r.includes(event.id) ? r.filter(id => id !== event.id) : [...r, event.id])}
                  className="px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95"
                  style={{ background: registered.includes(event.id) ? '#f0fdf4' : 'linear-gradient(135deg, #2d6a4f, #52b788)', color: registered.includes(event.id) ? '#2d6a4f' : 'white', border: registered.includes(event.id) ? '1px solid #bbf7d0' : 'none' }}
                >
                  {registered.includes(event.id) ? '✓ Đã đăng ký' : 'Đăng ký ngay'}
                </button>
              </div>
            </div>
          </div>
        ))}
        <div className="h-4" />
      </div>
    </div>
  );
}
