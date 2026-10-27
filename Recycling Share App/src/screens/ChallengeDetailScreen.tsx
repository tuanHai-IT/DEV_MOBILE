import { useState } from 'react';
import { challenges } from '../data';
import { users } from '../data';

export default function ChallengeDetailScreen({ challengeId, onBack }: { challengeId: string; onBack: () => void }) {
  const ch = challenges.find(c => c.id === challengeId)!;
  const [joined, setJoined] = useState(ch?.joined || false);
  if (!ch) return null;

  const topParticipants = users.slice(0, 5);

  return (
    <div className="h-full flex flex-col" style={{ background: '#f0fdf4' }}>
      <div className="flex-1 overflow-y-auto">
        {/* Hero */}
        <div className="relative p-6 pt-14" style={{ background: 'linear-gradient(135deg, #1b4332, #2d6a4f)' }}>
          <button onClick={onBack} className="absolute top-12 left-4 w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }}>
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <div className="text-5xl mb-4 text-center">{ch.icon}</div>
          <h1 className="text-2xl font-bold text-white text-center mb-2" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>{ch.title}</h1>
          <p className="text-green-200 text-sm text-center leading-relaxed">{ch.description}</p>
          <div className="flex justify-center gap-6 mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.15)' }}>
            {[['👥', ch.participants.toLocaleString(), 'Tham gia'], ['🎯', ch.target, 'Mục tiêu'], ['📅', ch.deadline, 'Hạn chót']].map(([icon, val, label]) => (
              <div key={label} className="text-center">
                <p className="text-base">{icon}</p>
                <p className="text-white font-bold text-sm">{val}</p>
                <p className="text-green-300 text-[10px]">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Reward */}
          <div className="bg-white rounded-3xl p-4 flex items-center gap-4" style={{ border: '1px solid #fbbf24' }}>
            <span className="text-3xl">🏅</span>
            <div>
              <p className="font-bold text-gray-900">Phần thưởng</p>
              <p className="text-sm text-gray-500">Hoàn thành thử thách để nhận</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-xl font-bold" style={{ color: '#f59e0b' }}>+{ch.reward}</p>
              <p className="text-xs text-gray-400">điểm Eco</p>
            </div>
          </div>

          {/* My progress */}
          {joined && ch.progress !== undefined && ch.maxProgress && (
            <div className="bg-white rounded-3xl p-4" style={{ border: '1px solid #e8f5e9' }}>
              <div className="flex justify-between items-center mb-2">
                <p className="font-semibold text-gray-800 text-sm">📊 Tiến độ của tôi</p>
                <span className="text-sm font-bold" style={{ color: '#2d6a4f' }}>{ch.progress}/{ch.maxProgress}</span>
              </div>
              <div className="h-4 rounded-full mb-2" style={{ background: '#f0fdf4' }}>
                <div className="h-4 rounded-full" style={{ width: `${(ch.progress / ch.maxProgress) * 100}%`, background: 'linear-gradient(90deg, #1b4332, #52b788)' }} />
              </div>
              <p className="text-xs text-gray-400 text-center">{Math.round((ch.progress / ch.maxProgress) * 100)}% hoàn thành — Cố lên! 💪</p>
            </div>
          )}

          {/* Rules */}
          <div className="bg-white rounded-3xl p-4" style={{ border: '1px solid #e8f5e9' }}>
            <p className="font-semibold text-gray-800 mb-3 text-sm">📋 Quy tắc tham gia</p>
            {['Đăng ảnh mỗi ngày để xác nhận tiến độ', 'Dùng hashtag chính thức trong bài đăng', 'Không được gian lận — cộng đồng sẽ vote', 'Kết quả được công bố sau hạn chót'].map((rule, i) => (
              <div key={i} className="flex gap-2.5 mb-2">
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white flex-none" style={{ background: '#2d6a4f' }}>{i + 1}</span>
                <p className="text-sm text-gray-600">{rule}</p>
              </div>
            ))}
          </div>

          {/* Leaderboard preview */}
          <div className="bg-white rounded-3xl p-4" style={{ border: '1px solid #e8f5e9' }}>
            <p className="font-semibold text-gray-800 mb-3 text-sm">🏆 Top tham gia</p>
            {topParticipants.map((user, i) => (
              <div key={user.id} className="flex items-center gap-3 py-2">
                <span className="text-base w-6 text-center">{['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][i]}</span>
                <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-xl object-cover" />
                <p className="flex-1 text-sm font-medium text-gray-800">{user.name}</p>
                <span className="text-xs font-bold" style={{ color: '#2d6a4f' }}>{(user.recycled * 0.2).toFixed(1)}kg</span>
              </div>
            ))}
          </div>
          <div className="h-4" />
        </div>
      </div>

      <div className="bg-white px-4 py-3" style={{ borderTop: '1px solid #e8f5e9' }}>
        <button
          onClick={() => setJoined(!joined)}
          className="w-full py-4 rounded-2xl font-semibold text-base transition-all active:scale-95"
          style={{ background: joined ? '#f0fdf4' : 'linear-gradient(135deg, #1b4332, #52b788)', color: joined ? '#2d6a4f' : 'white', border: joined ? '1.5px solid #bbf7d0' : 'none', boxShadow: joined ? 'none' : '0 6px 20px rgba(45,106,79,0.4)' }}
        >
          {joined ? '✓ Đang tham gia — Nhấn để bỏ' : `🚀 Tham gia thử thách (+${ch.reward} điểm)`}
        </button>
      </div>
    </div>
  );
}
