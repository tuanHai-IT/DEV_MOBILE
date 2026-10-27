import { useState } from 'react';
import { users } from '../data';

export default function FriendsScreen({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<'requests' | 'friends' | 'suggestions'>('requests');
  const [search, setSearch] = useState('');
  const [pendingActions, setPendingActions] = useState<Record<string, 'accepted' | 'declined' | 'added'>>({});

  const friends = users.filter(u => u.isFriend);
  const suggestions = users.filter(u => !u.isFriend && u.id !== '1');
  const requests = [users[4]]; // Đỗ Thị Mai has sent a request

  const act = (id: string, action: 'accepted' | 'declined' | 'added') => {
    setPendingActions(p => ({ ...p, [id]: action }));
  };

  const filteredFriends = friends.filter(u => !search || u.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="h-full flex flex-col" style={{ background: '#f0fdf4' }}>
      {/* Header */}
      <div className="bg-white px-4 pt-12 pb-3" style={{ borderBottom: '1px solid #e8f5e9' }}>
        <div className="flex items-center gap-3 mb-3">
          <button onClick={onBack} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#f0fdf4' }}>
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="#1b4332" strokeWidth={2} strokeLinecap="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h1 className="text-xl font-bold" style={{ color: '#1b4332', fontFamily: 'Fraunces, Georgia, serif' }}>
            Bạn bè & Mạng lưới 🤝
          </h1>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <svg viewBox="0 0 24 24" className="absolute left-3 top-3 w-4 h-4" fill="none" stroke="#9ca3af" strokeWidth={2} strokeLinecap="round">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Tìm kiếm bạn bè..."
            className="w-full pl-9 pr-4 py-2.5 rounded-2xl text-sm outline-none"
            style={{ background: '#f0fdf4', border: '1px solid #e8f5e9' }}
          />
        </div>

        {/* Tabs */}
        <div className="flex rounded-2xl p-1" style={{ background: '#f0fdf4' }}>
          {([
            ['requests', `Lời mời (${requests.length})`],
            ['friends', `Bạn bè (${friends.length})`],
            ['suggestions', 'Gợi ý'],
          ] as [typeof tab, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: tab === key ? 'white' : 'transparent',
                color: tab === key ? '#1b4332' : '#9ca3af',
                boxShadow: tab === key ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-3 px-4">
        {/* Friend Requests */}
        {tab === 'requests' && (
          <div className="space-y-3">
            {requests.filter(u => !pendingActions[u.id]).map(user => (
              <div key={user.id} className="bg-white rounded-3xl p-4 flex gap-3" style={{ border: '1px solid #e8f5e9' }}>
                <div className="relative flex-none">
                  <img src={user.avatar} alt={user.name} className="w-14 h-14 rounded-2xl object-cover" />
                  {user.isOnline && <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white" style={{ background: '#22c55e' }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 text-sm">{user.name}</p>
                  <p className="text-gray-400 text-xs truncate">@{user.username}</p>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{user.bio.split('\n')[0]}</p>
                  <p className="text-xs text-gray-400 mt-0.5">📍 {user.location} · {user.friends} bạn chung</p>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => act(user.id, 'accepted')}
                      className="flex-1 py-2 rounded-xl text-xs font-semibold text-white"
                      style={{ background: 'linear-gradient(135deg, #2d6a4f, #52b788)' }}
                    >
                      ✓ Chấp nhận
                    </button>
                    <button
                      onClick={() => act(user.id, 'declined')}
                      className="flex-1 py-2 rounded-xl text-xs font-semibold border"
                      style={{ borderColor: '#e5e7eb', color: '#6b7280' }}
                    >
                      Từ chối
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {pendingActions['5'] === 'accepted' && (
              <div className="text-center py-6 fade-in">
                <p className="text-3xl mb-2">🎉</p>
                <p className="text-gray-600 text-sm font-medium">Bạn và Đỗ Thị Mai đã kết bạn!</p>
              </div>
            )}
            {requests.every(u => pendingActions[u.id]) && !pendingActions['5'] && (
              <div className="text-center py-12">
                <p className="text-4xl mb-3">✅</p>
                <p className="text-gray-400 text-sm">Không có lời mời kết bạn nào</p>
              </div>
            )}
          </div>
        )}

        {/* Friends list */}
        {tab === 'friends' && (
          <div className="space-y-2">
            {filteredFriends.map(user => (
              <div key={user.id} className="bg-white rounded-2xl px-4 py-3 flex items-center gap-3" style={{ border: '1px solid #e8f5e9' }}>
                <div className="relative flex-none">
                  <img src={user.avatar} alt={user.name} className="w-12 h-12 rounded-2xl object-cover" />
                  {user.isOnline && <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white" style={{ background: '#22c55e' }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate">{user.name}</p>
                  <p className="text-gray-400 text-xs truncate">♻️ {user.recycled}kg tái chế • {user.points} điểm</p>
                </div>
                <button className="text-xs font-semibold px-3 py-1.5 rounded-xl border" style={{ borderColor: '#bbf7d0', color: '#2d6a4f' }}>
                  Nhắn tin
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Suggestions */}
        {tab === 'suggestions' && (
          <div className="space-y-3">
            <p className="text-xs text-gray-400 font-medium">Những người bạn có thể biết trong cộng đồng EcoShare 🌿</p>
            {suggestions.filter(u => !pendingActions[u.id] && !u.isFriend).map(user => (
              <div key={user.id} className="bg-white rounded-3xl p-4" style={{ border: '1px solid #e8f5e9' }}>
                <div className="flex items-center gap-3">
                  <div className="relative flex-none">
                    <img src={user.avatar} alt={user.name} className="w-14 h-14 rounded-2xl object-cover" />
                    {user.isOnline && <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white" style={{ background: '#22c55e' }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 text-sm">{user.name}</p>
                    <p className="text-gray-400 text-xs">@{user.username}</p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{user.bio.split('\n')[0]}</p>
                    <div className="flex gap-3 mt-0.5">
                      <span className="text-xs text-gray-400">♻️ {user.recycled}kg</span>
                      <span className="text-xs text-gray-400">🏆 {user.points} điểm</span>
                      <span className="text-xs text-gray-400">📸 {user.posts} bài</span>
                    </div>
                  </div>
                </div>
                {user.badge && (
                  <span className="inline-block mt-2 text-xs font-semibold px-2 py-1 rounded-full" style={{ background: '#fef3c7', color: '#92400e' }}>
                    {user.badge}
                  </span>
                )}
                <button
                  onClick={() => act(user.id, 'added')}
                  className="mt-3 w-full py-2.5 rounded-2xl text-sm font-semibold text-white transition-all active:scale-95"
                  style={{ background: 'linear-gradient(135deg, #2d6a4f, #52b788)' }}
                >
                  + Kết bạn
                </button>
              </div>
            ))}
            {suggestions.filter(u => pendingActions[u.id] === 'added').map(user => (
              <div key={user.id} className="bg-white rounded-3xl p-4 fade-in" style={{ border: '1px solid #bbf7d0' }}>
                <div className="flex items-center gap-3">
                  <img src={user.avatar} alt={user.name} className="w-12 h-12 rounded-2xl object-cover" />
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{user.name}</p>
                    <p className="text-xs text-green-600">✓ Đã gửi lời mời kết bạn</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
