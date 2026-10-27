import { useState } from 'react';
import { groups } from '../moreData';
import type { Route } from '../navigation';

interface Props { onBack: () => void; onPush: (r: Route) => void; }

const tabs = ['Khám phá', 'Của tôi'];

export default function GroupsScreen({ onBack, onPush }: Props) {
  const [tab, setTab] = useState(0);
  const [joined, setJoined] = useState<string[]>(['g1', 'g2']);

  const myGroups = groups.filter(g => joined.includes(g.id));
  const explore = groups.filter(g => !joined.includes(g.id));
  const displayed = tab === 0 ? groups : myGroups;

  return (
    <div className="h-full flex flex-col" style={{ background: '#f0fdf4' }}>
      <div className="bg-white px-4 pt-12 pb-3" style={{ borderBottom: '1px solid #e8f5e9' }}>
        <div className="flex items-center gap-3 mb-3">
          <button onClick={onBack} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#f0fdf4' }}>
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="#1b4332" strokeWidth={2} strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <h1 className="flex-1 text-xl font-bold" style={{ color: '#1b4332', fontFamily: 'Fraunces, Georgia, serif' }}>👥 Cộng Đồng</h1>
          <button className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
            <span className="text-sm">+</span>
          </button>
        </div>
        <div className="flex gap-2">
          {tabs.map((t, i) => (
            <button key={t} onClick={() => setTab(i)} className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all" style={{ background: tab === i ? '#2d6a4f' : '#f0fdf4', color: tab === i ? 'white' : '#6b7280' }}>
              {t} {i === 1 && `(${myGroups.length})`}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {tab === 0 && explore.length > 0 && (
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Gợi ý cho bạn</p>
          </div>
        )}

        {displayed.map(group => (
          <div key={group.id} className="bg-white rounded-3xl overflow-hidden" style={{ border: '1px solid #e8f5e9', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            {/* Cover */}
            <div className="h-28 relative" style={{ background: 'linear-gradient(135deg, #1b4332dd, #2d6a4f88)' }}>
              <img src={group.cover} alt={group.name} className="w-full h-full object-cover mix-blend-multiply opacity-60" />
              <div className="absolute inset-0 flex items-center justify-center text-5xl">♻️</div>
            </div>
            <div className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900 leading-tight" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>{group.name}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{group.members.toLocaleString()} thành viên • {group.posts} bài/tuần</p>
                </div>
                <button
                  onClick={() => setJoined(j => j.includes(group.id) ? j.filter(id => id !== group.id) : [...j, group.id])}
                  className="px-4 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 flex-none"
                  style={{
                    background: joined.includes(group.id) ? '#f0fdf4' : '#2d6a4f',
                    color: joined.includes(group.id) ? '#2d6a4f' : 'white',
                    border: joined.includes(group.id) ? '1px solid #bbf7d0' : 'none'
                  }}
                >
                  {joined.includes(group.id) ? '✓ Đã tham gia' : '+ Tham gia'}
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-2 leading-relaxed line-clamp-2">{group.description}</p>
              <button onClick={() => onPush({ screen: 'group-detail', groupId: group.id })} className="mt-3 w-full py-2 rounded-xl text-xs font-semibold" style={{ background: '#f0fdf4', color: '#2d6a4f' }}>
                Xem nhóm →
              </button>
            </div>
          </div>
        ))}

        {tab === 1 && myGroups.length === 0 && (
          <div className="text-center py-12">
            <div className="text-5xl mb-4">👥</div>
            <p className="font-semibold text-gray-700">Chưa tham gia nhóm nào</p>
            <p className="text-sm text-gray-400 mt-1">Khám phá cộng đồng EcoShare!</p>
            <button onClick={() => setTab(0)} className="mt-4 px-6 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: '#2d6a4f' }}>Khám phá ngay</button>
          </div>
        )}
        <div className="h-4" />
      </div>
    </div>
  );
}
