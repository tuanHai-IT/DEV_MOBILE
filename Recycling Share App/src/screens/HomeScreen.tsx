import { useState } from 'react';
import { posts, notifications, type User } from '../data';
import { useNav } from '../navigation';
import PostCard from '../components/PostCard';
import StoriesBar from '../components/StoriesBar';

interface Props {
  currentUser: User;
}

export default function HomeScreen({ currentUser }: Props) {
  const { push } = useNav();
  const [activeFilter, setActiveFilter] = useState('all');
  const unreadCount = notifications.filter(n => !n.read).length;

  const filters = [
    { key: 'all', label: 'Tất cả' },
    { key: 'tip', label: '💡 Mẹo hay' },
    { key: 'post', label: '📸 Bài đăng' },
    { key: 'exchange', label: '🔄 Trao đổi' },
  ];

  const filtered = activeFilter === 'all' ? posts : posts.filter(p => p.type === activeFilter);

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: '#f0fdf4' }}>
      {/* Top bar */}
      <div className="flex-none bg-white px-4 pt-12 pb-3 shadow-sm" style={{ borderBottom: '1px solid #e8f5e9' }}>
        <div className="flex items-center justify-between">
          <button onClick={() => push({ screen: 'search' })} className="flex items-center gap-2">
            <span className="text-2xl">♻️</span>
            <h1 className="text-2xl font-bold font-display" style={{ fontFamily: 'Fraunces, Georgia, serif', color: '#1b4332' }}>
              EcoShare
            </h1>
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => push({ screen: 'friends' })}
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: '#f0fdf4' }}
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="#2d6a4f" strokeWidth={1.8} strokeLinecap="round">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
              </svg>
            </button>
            <button
              onClick={() => push({ screen: 'notifications' })}
              className="relative w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: '#f0fdf4' }}
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="#2d6a4f" strokeWidth={1.8} strokeLinecap="round">
                <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4.5 h-4.5 rounded-full text-white text-[10px] font-bold flex items-center justify-center" style={{ background: '#ef4444', width: 18, height: 18 }}>
                  {unreadCount}
                </span>
              )}
            </button>
            <button
              onClick={() => push({ screen: 'scanner' })}
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: '#2d6a4f' }}
            >
              <svg viewBox="0 0 24 24" className="w-4.5 h-4.5" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round">
                <path d="M9 2H7a2 2 0 00-2 2v2M9 22H7a2 2 0 01-2-2v-2M15 2h2a2 2 0 012 2v2M15 22h2a2 2 0 002-2v-2M7 12h10" />
              </svg>
            </button>
          </div>
        </div>

        {/* Eco points banner */}
        <button
          onClick={() => push({ screen: 'my-impact' })}
          className="w-full mt-3 rounded-2xl px-4 py-2.5 flex items-center gap-3 text-left"
          style={{ background: 'linear-gradient(135deg, #1b4332 0%, #2d6a4f 100%)' }}
        >
          <span className="text-2xl">🌿</span>
          <div className="flex-1">
            <p className="text-white text-xs font-medium">Điểm Eco của bạn</p>
            <p className="text-green-200 text-[10px]">Hoàn thành thêm thử thách để tăng điểm</p>
          </div>
          <div className="text-right">
            <p className="text-white font-bold text-lg">1,240</p>
            <p className="text-green-300 text-[10px]">điểm</p>
          </div>
        </button>
      </div>

      {/* Scrollable feed */}
      <div className="flex-1 overflow-y-auto">
        {/* Stories */}
        <div className="bg-white mb-2" style={{ borderBottom: '1px solid #e8f5e9' }}>
          <StoriesBar />
        </div>

        {/* Filter chips */}
        <div className="px-4 py-3 flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className="flex-none px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={{
                background: activeFilter === f.key ? '#2d6a4f' : 'white',
                color: activeFilter === f.key ? 'white' : '#6b7280',
                border: `1px solid ${activeFilter === f.key ? '#2d6a4f' : '#e8f5e9'}`,
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Posts */}
        <div className="pb-4">
          {filtered.map(post => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      </div>
    </div>
  );
}
