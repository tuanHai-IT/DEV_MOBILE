import { useState } from 'react';
import { users } from '../data';

const tabs = ['Tuần này', 'Tháng này', 'Toàn thời gian'];

interface LeaderUser { id: string; name: string; avatar: string; recycled: number; level: number; }

const extendedUsers: LeaderUser[] = [
  ...users.map(u => ({ id: u.id, name: u.name, avatar: u.avatar, recycled: u.recycled, level: Math.floor(u.points / 200) })),
  { id: 'u8', name: 'Phạm Thanh Huyền', avatar: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=80&h=80&fit=crop&auto=format', recycled: 210, level: 12 },
  { id: 'u9', name: 'Lê Minh Tuấn', avatar: 'https://images.unsplash.com/photo-1547425260-76bcadfb4f2c?w=80&h=80&fit=crop&auto=format', recycled: 198, level: 11 },
  { id: 'u10', name: 'Nguyễn Thị Lan', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=80&h=80&fit=crop&auto=format', recycled: 175, level: 10 },
];

export default function LeaderboardScreen({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState(0);

  const sorted = [...extendedUsers].sort((a, b) => b.recycled - a.recycled);
  const top3 = sorted.slice(0, 3);
  const rest = sorted.slice(3);
  const myRank = 4;

  return (
    <div className="h-full flex flex-col" style={{ background: '#f0fdf4' }}>
      {/* Header */}
      <div className="relative px-4 pt-12 pb-6" style={{ background: 'linear-gradient(160deg, #1b4332 0%, #2d6a4f 100%)' }}>
        <button onClick={onBack} className="absolute top-12 left-4 w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }}>
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <h1 className="text-2xl font-bold text-white text-center mb-1" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>🏆 Bảng Xếp Hạng</h1>
        <p className="text-green-300 text-xs text-center">Cùng nhau tái chế nhiều hơn!</p>

        {/* Podium */}
        <div className="flex justify-center items-end gap-3 mt-6 mb-2">
          {/* 2nd */}
          <div className="flex flex-col items-center">
            <img src={top3[1]?.avatar} alt="" className="w-14 h-14 rounded-2xl object-cover border-2 border-gray-300" />
            <span className="text-lg mt-1">🥈</span>
            <p className="text-white text-xs font-bold mt-0.5 text-center leading-tight" style={{ maxWidth: 64 }}>{top3[1]?.name.split(' ').slice(-1)[0]}</p>
            <p className="text-green-300 text-[10px]">{top3[1]?.recycled}kg</p>
            <div className="w-16 h-14 rounded-t-xl mt-1 flex items-center justify-center font-bold text-lg text-white" style={{ background: 'rgba(255,255,255,0.15)' }}>2</div>
          </div>
          {/* 1st */}
          <div className="flex flex-col items-center -mt-6">
            <div className="relative">
              <img src={top3[0]?.avatar} alt="" className="w-18 h-18 rounded-2xl object-cover border-4 border-yellow-400" style={{ width: 72, height: 72 }} />
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xl">👑</span>
            </div>
            <span className="text-xl mt-1">🥇</span>
            <p className="text-white text-xs font-bold mt-0.5 text-center leading-tight" style={{ maxWidth: 72 }}>{top3[0]?.name.split(' ').slice(-1)[0]}</p>
            <p className="text-yellow-300 text-[10px] font-bold">{top3[0]?.recycled}kg</p>
            <div className="w-18 h-20 rounded-t-xl mt-1 flex items-center justify-center font-bold text-2xl text-white" style={{ width: 72, background: 'rgba(255,255,255,0.25)' }}>1</div>
          </div>
          {/* 3rd */}
          <div className="flex flex-col items-center">
            <img src={top3[2]?.avatar} alt="" className="w-14 h-14 rounded-2xl object-cover border-2 border-orange-400" />
            <span className="text-lg mt-1">🥉</span>
            <p className="text-white text-xs font-bold mt-0.5 text-center leading-tight" style={{ maxWidth: 64 }}>{top3[2]?.name.split(' ').slice(-1)[0]}</p>
            <p className="text-orange-300 text-[10px]">{top3[2]?.recycled}kg</p>
            <div className="w-16 h-10 rounded-t-xl mt-1 flex items-center justify-center font-bold text-lg text-white" style={{ background: 'rgba(255,255,255,0.1)' }}>3</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white flex px-4 py-2 gap-2" style={{ borderBottom: '1px solid #e8f5e9' }}>
        {tabs.map((t, i) => (
          <button key={t} onClick={() => setTab(i)} className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all" style={{ background: tab === i ? '#2d6a4f' : '#f0fdf4', color: tab === i ? 'white' : '#6b7280' }}>
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* My rank */}
        <div className="m-3 p-3 rounded-2xl flex items-center gap-3" style={{ background: 'linear-gradient(135deg, #f0fdf4, #d1fae5)', border: '1.5px solid #bbf7d0' }}>
          <span className="text-xl w-8 text-center font-bold" style={{ color: '#2d6a4f' }}>#{myRank}</span>
          <img src={users[0].avatar} alt="" className="w-10 h-10 rounded-xl object-cover" />
          <div className="flex-1">
            <p className="font-bold text-sm text-gray-900">Bạn (Nguyễn Minh Tuấn)</p>
            <p className="text-xs text-gray-500">Cần thêm 12kg để lên #3</p>
          </div>
          <div className="text-right">
            <p className="font-bold text-sm" style={{ color: '#2d6a4f' }}>235kg</p>
            <p className="text-[10px] text-gray-400">đã tái chế</p>
          </div>
        </div>

        {/* List */}
        <div className="px-3 pb-4 space-y-2">
          {rest.map((user, i) => (
            <div key={user.id} className="bg-white rounded-2xl flex items-center gap-3 p-3" style={{ border: '1px solid #e8f5e9' }}>
              <span className="text-base w-8 text-center font-bold text-gray-400">{i + 4}</span>
              <img src={user.avatar} alt={user.name} className="w-10 h-10 rounded-xl object-cover" />
              <div className="flex-1">
                <p className="font-semibold text-sm text-gray-800">{user.name}</p>
                <p className="text-xs text-gray-400">Level {user.level || 8} Eco Hero</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-sm" style={{ color: '#2d6a4f' }}>{user.recycled}kg</p>
                <p className="text-[10px] text-gray-400">↑ {Math.floor(Math.random() * 10) + 1}%</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
