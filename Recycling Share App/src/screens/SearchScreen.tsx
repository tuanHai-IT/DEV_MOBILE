import { useState } from 'react';
import { users, posts } from '../data';
import type { Route } from '../navigation';

interface Props { onBack: () => void; onPush: (r: Route) => void; }

const recentSearches = ['Chai nhựa', 'Lốp xe tái chế', 'Zero waste', '#DIY', 'Lê Thị Hoa'];
const trendingTags = ['TáiChéNhựa', 'ZeroWaste', 'Upcycle', 'DIY', 'GreenLife', 'EcoArt', 'ChậuHoa', 'Handmade'];

export default function SearchScreen({ onBack, onPush }: Props) {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'people' | 'posts' | 'tags'>('all');

  const filteredUsers = users.filter(u => u.id !== '1' && (u.name.toLowerCase().includes(query.toLowerCase()) || u.username.toLowerCase().includes(query.toLowerCase())));
  const filteredPosts = posts.filter(p => p.content.toLowerCase().includes(query.toLowerCase()) || p.tags.some(t => t.toLowerCase().includes(query.toLowerCase())));
  const filteredTags = trendingTags.filter(t => t.toLowerCase().includes(query.toLowerCase()));

  const hasResults = query.trim().length > 0;

  return (
    <div className="h-full flex flex-col" style={{ background: '#f0fdf4' }}>
      <div className="bg-white px-4 pt-12 pb-3" style={{ borderBottom: '1px solid #e8f5e9' }}>
        <div className="flex items-center gap-3 mb-3">
          <button onClick={onBack} className="w-9 h-9 rounded-xl flex items-center justify-center flex-none" style={{ background: '#f0fdf4' }}>
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="#1b4332" strokeWidth={2} strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <div className="flex-1 flex items-center rounded-2xl px-3 py-2.5 gap-2" style={{ background: '#f0fdf4', border: '1.5px solid #e8f5e9' }}>
            <svg viewBox="0 0 24 24" className="w-4 h-4 flex-none" fill="none" stroke="#9ca3af" strokeWidth={2} strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm người, bài đăng, #tag..." className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none" autoFocus />
            {query && <button onClick={() => setQuery('')} className="text-gray-400 text-sm">✕</button>}
          </div>
        </div>
        {hasResults && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {(['all', 'people', 'posts', 'tags'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className="flex-none px-3 py-1.5 rounded-full text-xs font-semibold transition-all" style={{ background: activeTab === tab ? '#2d6a4f' : 'white', color: activeTab === tab ? 'white' : '#6b7280', border: `1px solid ${activeTab === tab ? '#2d6a4f' : '#e8f5e9'}` }}>
                {tab === 'all' ? 'Tất cả' : tab === 'people' ? '👤 Người' : tab === 'posts' ? '📸 Bài' : '# Tags'}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {!hasResults ? (
          <div className="p-4">
            {/* Recent */}
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">🕐 Tìm kiếm gần đây</p>
            {recentSearches.map(s => (
              <button key={s} onClick={() => setQuery(s)} className="w-full flex items-center gap-3 py-3 border-b" style={{ borderColor: '#f0fdf4' }}>
                <span className="w-8 h-8 rounded-full flex items-center justify-center text-sm" style={{ background: '#f0fdf4' }}>🕐</span>
                <span className="text-sm text-gray-700">{s}</span>
                <svg viewBox="0 0 24 24" className="w-4 h-4 ml-auto" fill="none" stroke="#d1d5db" strokeWidth={1.5}><path d="M7 17L17 7M7 7h10v10" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            ))}

            {/* Trending */}
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-5 mb-3">🔥 Trending Tags</p>
            <div className="flex flex-wrap gap-2">
              {trendingTags.map((tag, i) => (
                <button key={tag} onClick={() => onPush({ screen: 'hashtag', tag })} className="px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background: i % 3 === 0 ? '#d1fae5' : i % 3 === 1 ? '#dbeafe' : '#fef3c7', color: i % 3 === 0 ? '#065f46' : i % 3 === 1 ? '#1e40af' : '#92400e' }}>
                  #{tag}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="py-2">
            {/* Users */}
            {(activeTab === 'all' || activeTab === 'people') && filteredUsers.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider px-4 mb-2">👤 Người dùng</p>
                {filteredUsers.map(user => (
                  <button key={user.id} onClick={() => onPush({ screen: 'profile', userId: user.id })} className="w-full flex items-center gap-3 px-4 py-3 active:bg-white/80">
                    <div className="relative">
                      <img src={user.avatar} alt={user.name} className="w-11 h-11 rounded-2xl object-cover" />
                      {user.isOnline && <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#f0fdf4]" style={{ background: '#22c55e' }} />}
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-semibold text-gray-900 text-sm">{user.name}</p>
                      <p className="text-gray-400 text-xs">@{user.username} · ♻️ {user.recycled}kg</p>
                    </div>
                    <span className="text-xs font-medium px-2 py-1 rounded-lg" style={{ background: user.isFriend ? '#d1fae5' : '#f0fdf4', color: user.isFriend ? '#065f46' : '#2d6a4f' }}>
                      {user.isFriend ? 'Bạn bè' : '+ Kết bạn'}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Posts */}
            {(activeTab === 'all' || activeTab === 'posts') && filteredPosts.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider px-4 mb-2">📸 Bài đăng</p>
                <div className="grid grid-cols-3 gap-1 px-4">
                  {filteredPosts.slice(0, 6).map(p => (
                    <button key={p.id} onClick={() => onPush({ screen: 'post-detail', postId: p.id })} className="relative rounded-xl overflow-hidden" style={{ paddingTop: '100%' }}>
                      <img src={p.images[0]} alt="" className="absolute inset-0 w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Tags */}
            {(activeTab === 'all' || activeTab === 'tags') && filteredTags.length > 0 && (
              <div className="px-4 mb-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2"># Tags</p>
                {filteredTags.map(tag => (
                  <button key={tag} onClick={() => onPush({ screen: 'hashtag', tag })} className="w-full flex items-center gap-3 py-2.5 border-b" style={{ borderColor: '#f0fdf4' }}>
                    <span className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm" style={{ background: '#d1fae5', color: '#065f46' }}>#</span>
                    <div className="text-left">
                      <p className="font-semibold text-gray-800 text-sm">#{tag}</p>
                      <p className="text-xs text-gray-400">{Math.floor(Math.random() * 500 + 50)} bài đăng</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {filteredUsers.length === 0 && filteredPosts.length === 0 && (
              <div className="text-center py-16">
                <p className="text-4xl mb-3">🔍</p>
                <p className="text-gray-400 text-sm">Không tìm thấy kết quả cho "{query}"</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
