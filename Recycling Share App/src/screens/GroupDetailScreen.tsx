import { useState } from 'react';
import { groups } from '../moreData';
import { users, posts, type Post } from '../data';

interface Props { groupId: string; onBack: () => void; }

const tabs = ['Bài đăng', 'Thành viên', 'Giới thiệu'];

export default function GroupDetailScreen({ groupId, onBack }: Props) {
  const group = groups.find(g => g.id === groupId) || groups[0];
  const [tab, setTab] = useState(0);
  const [joined, setJoined] = useState(true);

  return (
    <div className="h-full flex flex-col" style={{ background: '#f0fdf4' }}>
      <div className="flex-1 overflow-y-auto">
        {/* Cover */}
        <div className="relative h-48">
          <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #1b4332ee, #2d6a4f99)' }}>
            <img src={group.cover} alt="" className="w-full h-full object-cover mix-blend-multiply opacity-50" />
          </div>
          <button onClick={onBack} className="absolute top-12 left-4 w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)' }}>
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-5xl mb-2">♻️</span>
            <h1 className="text-xl font-bold text-white text-center px-4" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>{group.name}</h1>
            <p className="text-white/70 text-xs mt-1">{group.members.toLocaleString()} thành viên</p>
          </div>
        </div>

        {/* Join button */}
        <div className="bg-white px-4 py-3 flex gap-2" style={{ borderBottom: '1px solid #e8f5e9' }}>
          <button
            onClick={() => setJoined(!joined)}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ background: joined ? '#f0fdf4' : 'linear-gradient(135deg, #2d6a4f, #52b788)', color: joined ? '#2d6a4f' : 'white', border: joined ? '1px solid #bbf7d0' : 'none' }}
          >
            {joined ? '✓ Đã tham gia' : '+ Tham gia nhóm'}
          </button>
          <button className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#f0fdf4', border: '1px solid #e8f5e9' }}>
            <span>🔔</span>
          </button>
          <button className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#f0fdf4', border: '1px solid #e8f5e9' }}>
            <span>↗️</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="bg-white flex px-4 py-2 gap-2" style={{ borderBottom: '1px solid #e8f5e9' }}>
          {tabs.map((t, i) => (
            <button key={t} onClick={() => setTab(i)} className="flex-1 py-1.5 rounded-xl text-xs font-semibold transition-all" style={{ background: tab === i ? '#2d6a4f' : '#f0fdf4', color: tab === i ? 'white' : '#6b7280' }}>
              {t}
            </button>
          ))}
        </div>

        <div className="p-4 space-y-3">
          {tab === 0 && posts.slice(0, 4).map((post: Post) => {
            const postAuthor = users.find(u => u.id === post.userId);
            return (
            <div key={post.id} className="bg-white rounded-3xl overflow-hidden" style={{ border: '1px solid #e8f5e9' }}>
              <div className="p-3 flex items-center gap-2">
                <img src={postAuthor?.avatar} alt="" className="w-8 h-8 rounded-xl object-cover" />
                <div>
                  <p className="text-sm font-semibold text-gray-800">{postAuthor?.name}</p>
                  <p className="text-[10px] text-gray-400">{post.time} • {group.name}</p>
                </div>
              </div>
              {post.images[0] && <img src={post.images[0]} alt="" className="w-full h-40 object-cover" />}
              <div className="p-3">
                <p className="text-sm text-gray-700 line-clamp-2">{post.content}</p>
                <div className="flex gap-4 mt-2 pt-2" style={{ borderTop: '1px solid #f0fdf4' }}>
                  <span className="text-xs text-gray-400">❤️ {post.likes}</span>
                  <span className="text-xs text-gray-400">💬 {post.comments.length}</span>
                  <span className="text-xs text-gray-400">↗️ Chia sẻ</span>
                </div>
              </div>
            </div>
            );
          })}

          {tab === 1 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Admin & Kiểm duyệt viên</p>
              {users.slice(0, 2).map(u => (
                <div key={u.id} className="bg-white rounded-2xl p-3 flex items-center gap-3" style={{ border: '1px solid #e8f5e9' }}>
                  <img src={u.avatar} alt="" className="w-10 h-10 rounded-xl object-cover" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-800">{u.name}</p>
                    <p className="text-xs text-gray-400">🔑 Quản trị viên</p>
                  </div>
                </div>
              ))}
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-4 mb-2">Thành viên ({group.members.toLocaleString()})</p>
              {users.slice(2).map(u => (
                <div key={u.id} className="bg-white rounded-2xl p-3 flex items-center gap-3" style={{ border: '1px solid #e8f5e9' }}>
                  <img src={u.avatar} alt="" className="w-10 h-10 rounded-xl object-cover" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-800">{u.name}</p>
                    <p className="text-xs text-gray-400">{u.location}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 2 && (
            <div className="space-y-3">
              <div className="bg-white rounded-3xl p-4" style={{ border: '1px solid #e8f5e9' }}>
                <p className="font-semibold text-gray-800 mb-2 text-sm">📋 Giới thiệu</p>
                <p className="text-sm text-gray-600 leading-relaxed">{group.description}</p>
              </div>
              {[['👥', 'Thành viên', group.members.toLocaleString()], ['📝', 'Bài/tuần', group.posts], ['🔒', 'Loại nhóm', 'Công khai'], ['📍', 'Địa điểm', 'Toàn quốc']].map(([icon, label, val]) => (
                <div key={label} className="bg-white rounded-2xl p-3 flex items-center gap-3" style={{ border: '1px solid #e8f5e9' }}>
                  <span className="text-xl w-8 text-center">{icon}</span>
                  <div className="flex-1">
                    <p className="text-xs text-gray-400">{label}</p>
                    <p className="text-sm font-semibold text-gray-800">{val}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="h-4" />
        </div>
      </div>
    </div>
  );
}
