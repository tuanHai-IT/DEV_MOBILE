import { useState } from 'react';
import { users, posts } from '../data';
import { useNav } from '../navigation';

interface Props {
  userId: string;
  isOwnProfile: boolean;
  onBack?: () => void;
}

export default function ProfileScreen({ userId, isOwnProfile, onBack }: Props) {
  const { push } = useNav();
  const user = users.find(u => u.id === userId)!;
  const userPosts = posts.filter(p => p.userId === userId);
  const [activeTab, setActiveTab] = useState<'posts' | 'tips' | 'saved'>('posts');
  const [following, setFollowing] = useState(user.isFriend);

  const tabPosts = userPosts.filter(p => {
    if (activeTab === 'posts') return true;
    if (activeTab === 'tips') return p.type === 'tip';
    return p.liked;
  });

  return (
    <div className="h-full flex flex-col" style={{ background: '#f0fdf4' }}>
      <div className="flex-1 overflow-y-auto">
        {/* Cover + Back */}
        <div className="relative" style={{ height: 200 }}>
          <img src={user.cover} alt="Cover" className="w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.5) 100%)' }} />

          <div className="absolute top-12 left-4 right-4 flex items-center justify-between">
            {onBack ? (
              <button onClick={onBack} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.25)', backdropFilter: 'blur(8px)' }}>
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
              </button>
            ) : <div />}
            <div className="flex gap-2">
              {isOwnProfile && (
                <button onClick={() => push({ screen: 'edit-profile' })} className="h-9 px-4 rounded-xl text-xs font-semibold text-white" style={{ background: 'rgba(255,255,255,0.25)', backdropFilter: 'blur(8px)' }}>
                  ✏️ Chỉnh sửa
                </button>
              )}
              <button onClick={() => isOwnProfile ? push({ screen: 'settings' }) : undefined} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.25)', backdropFilter: 'blur(8px)' }}>
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="white" strokeWidth={2}>
                  <circle cx="12" cy="5" r="1" fill="white" /><circle cx="12" cy="12" r="1" fill="white" /><circle cx="12" cy="19" r="1" fill="white" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Profile info card */}
        <div className="bg-white mx-4 -mt-16 relative z-10 rounded-3xl p-5 shadow-lg" style={{ border: '1px solid #e8f5e9' }}>
          <div className="flex items-end gap-4 mb-4">
            <div className="relative -mt-14">
              <img src={user.avatar} alt={user.name} className="w-20 h-20 rounded-2xl object-cover border-4 border-white shadow-md" />
              {user.isOnline && <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-white" style={{ background: '#22c55e' }} />}
            </div>
            <div className="flex-1 pb-1 min-w-0">
              <h2 className="font-bold text-gray-900 text-lg leading-tight">{user.name}</h2>
              <p className="text-gray-400 text-xs">@{user.username}</p>
              {user.badge && (
                <span className="inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#fef3c7', color: '#92400e' }}>
                  {user.badge}
                </span>
              )}
            </div>
          </div>

          <p className="text-sm text-gray-600 leading-relaxed mb-4 whitespace-pre-line">{user.bio}</p>

          <div className="flex items-center gap-4 mb-4">
            <span className="text-xs text-gray-400">📍 {user.location}</span>
            <span className="text-xs text-gray-400">📅 {user.joinDate}</span>
          </div>

          <div className="grid grid-cols-4 gap-2 mb-4">
            {[
              { val: user.posts, label: 'Bài đăng' },
              { val: user.friends, label: 'Bạn bè', action: () => push({ screen: 'friends' }) },
              { val: `${user.recycled}kg`, label: 'Tái chế', action: () => push({ screen: 'my-impact' }) },
              { val: user.points.toLocaleString(), label: 'Điểm Eco', action: () => push({ screen: 'reward-shop' }) },
            ].map(({ val, label, action }) => (
              <button key={label} onClick={action} className="text-center">
                <div className="font-bold text-lg" style={{ color: '#1b4332' }}>{val}</div>
                <div className="text-[10px] text-gray-400 font-medium">{label}</div>
              </button>
            ))}
          </div>

          <div className="rounded-2xl p-3 mb-4" style={{ background: '#f0fdf4' }}>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="font-semibold" style={{ color: '#1b4332' }}>🌿 Cấp độ Eco</span>
              <span className="text-gray-400">{user.points}/{Math.ceil(user.points / 1000) * 1000} điểm</span>
            </div>
            <div className="h-2.5 rounded-full" style={{ background: '#d1fae5' }}>
              <div className="h-2.5 rounded-full" style={{ width: `${(user.points % 1000) / 10}%`, background: 'linear-gradient(90deg, #2d6a4f, #52b788)' }} />
            </div>
            <div className="flex items-center justify-between mt-1">
              <p className="text-[10px] text-gray-400">{user.points < 1000 ? '🌱 Người mới bắt đầu' : user.points < 2000 ? '🌿 Eco Warrior' : '🌳 Eco Champion'}</p>
              {isOwnProfile && <button onClick={() => push({ screen: 'badges' })} className="text-[10px] font-semibold" style={{ color: '#2d6a4f' }}>Huy hiệu →</button>}
            </div>
          </div>

          {isOwnProfile ? (
            <div className="flex gap-2">
              <button onClick={() => push({ screen: 'my-impact' })} className="flex-1 py-3 rounded-2xl text-sm font-semibold" style={{ background: '#f0fdf4', color: '#2d6a4f', border: '1px solid #bbf7d0' }}>
                📊 Tác động
              </button>
              <button onClick={() => push({ screen: 'settings' })} className="flex-1 py-3 rounded-2xl text-sm font-semibold" style={{ background: '#f0fdf4', color: '#2d6a4f', border: '1px solid #bbf7d0' }}>
                ⚙️ Cài đặt
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setFollowing(!following)}
                className="flex-1 py-3 rounded-2xl font-semibold text-sm transition-all active:scale-95"
                style={{ background: following ? '#f0fdf4' : 'linear-gradient(135deg, #2d6a4f, #52b788)', color: following ? '#2d6a4f' : 'white', border: following ? '1.5px solid #bbf7d0' : 'none', boxShadow: following ? 'none' : '0 4px 12px rgba(45,106,79,0.35)' }}
              >
                {following ? '✓ Bạn bè' : '+ Kết bạn'}
              </button>
              <button onClick={() => push({ screen: 'chat', userId })} className="flex-1 py-3 rounded-2xl font-semibold text-sm border" style={{ borderColor: '#bbf7d0', color: '#2d6a4f', background: 'white' }}>
                💬 Nhắn tin
              </button>
            </div>
          )}
        </div>

        {/* Posts tabs */}
        <div className="mt-4 mx-4">
          <div className="flex rounded-2xl p-1 mb-3" style={{ background: 'white', border: '1px solid #e8f5e9' }}>
            {(['posts', 'tips', 'saved'] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)} className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all" style={{ background: activeTab === tab ? '#2d6a4f' : 'transparent', color: activeTab === tab ? 'white' : '#9ca3af' }}>
                {tab === 'posts' ? '📸 Bài đăng' : tab === 'tips' ? '💡 Mẹo' : '🔖 Đã lưu'}
              </button>
            ))}
          </div>

          {tabPosts.length > 0 ? (
            <div className="grid grid-cols-3 gap-1.5 pb-6">
              {tabPosts.map(post => (
                <button key={post.id} onClick={() => push({ screen: 'post-detail', postId: post.id })} className="relative rounded-2xl overflow-hidden" style={{ paddingTop: '100%' }}>
                  <img src={post.images[0]} alt="Post" className="absolute inset-0 w-full h-full object-cover" />
                  {post.type === 'tip' && (
                    <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'rgba(45,106,79,0.85)' }}>
                      <span className="text-[8px]">💡</span>
                    </div>
                  )}
                  <div className="absolute bottom-0 inset-x-0 p-1.5" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.5), transparent)' }}>
                    <p className="text-white text-[9px] font-medium">❤️ {post.likes}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-4xl mb-3">📸</p>
              <p className="text-gray-400 text-sm">Chưa có bài đăng nào</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
