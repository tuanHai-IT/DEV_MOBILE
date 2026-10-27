import { useState } from 'react';
import { posts, users, CURRENT_USER_ID } from '../data';
import type { Route } from '../navigation';

interface Props { postId: string; onBack: () => void; onPush: (r: Route) => void; }

export default function PostDetailScreen({ postId, onBack, onPush }: Props) {
  const post = posts.find(p => p.id === postId)!;
  const author = users.find(u => u.id === post.userId)!;
  const me = users.find(u => u.id === CURRENT_USER_ID)!;
  const [liked, setLiked] = useState(post.liked);
  const [likeCount, setLikeCount] = useState(post.likes);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState(post.comments);

  if (!post) return null;

  const handleLike = () => { setLiked(!liked); setLikeCount(c => liked ? c - 1 : c + 1); };
  const handleComment = () => {
    if (!commentText.trim()) return;
    setComments(cs => [...cs, { id: `nc${Date.now()}`, userId: CURRENT_USER_ID, content: commentText.trim(), time: 'Vừa xong', likes: 0 }]);
    setCommentText('');
  };

  return (
    <div className="h-full flex flex-col" style={{ background: '#f0fdf4' }}>
      <div className="bg-white px-4 pt-12 pb-3 flex items-center gap-3" style={{ borderBottom: '1px solid #e8f5e9' }}>
        <button onClick={onBack} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#f0fdf4' }}>
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="#1b4332" strokeWidth={2} strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <h1 className="flex-1 text-base font-bold" style={{ color: '#1b4332' }}>Bài đăng</h1>
        <button className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#f0fdf4' }}>
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="#6b7280" strokeWidth={1.8}><circle cx="12" cy="5" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="19" r="1" fill="currentColor" /></svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Author */}
        <div className="bg-white px-4 pt-4 pb-3">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={() => onPush({ screen: 'profile', userId: author.id })}>
              <img src={author.avatar} alt={author.name} className="w-11 h-11 rounded-2xl object-cover" />
            </button>
            <div className="flex-1">
              <p className="font-bold text-gray-900 text-sm">{author.name}</p>
              <p className="text-gray-400 text-xs">{post.time} · {post.category}</p>
            </div>
          </div>

          {/* Content */}
          <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-line mb-3">{post.content}</p>
          <div className="flex flex-wrap gap-1 mb-3">
            {post.tags.map(tag => (
              <button key={tag} onClick={() => onPush({ screen: 'hashtag', tag })} className="text-xs font-medium" style={{ color: '#52b788' }}>#{tag}</button>
            ))}
          </div>

          {/* Image */}
          {post.images[0] && (
            <button onClick={() => onPush({ screen: 'image-viewer', url: post.images[0] })} className="w-full rounded-2xl overflow-hidden block mb-3">
              <img src={post.images[0]} alt="Post" className="w-full object-cover" style={{ maxHeight: 350 }} />
            </button>
          )}

          {/* Stats + actions */}
          <div className="flex items-center gap-1 py-2" style={{ borderTop: '1px solid #f0fdf4', borderBottom: '1px solid #f0fdf4' }}>
            <span className="text-xs text-gray-400 flex-1">{likeCount.toLocaleString()} lượt thích · {comments.length} bình luận</span>
          </div>
          <div className="flex items-center pt-1">
            {[
              { icon: liked ? '❤️' : '🤍', label: liked ? 'Đã thích' : 'Thích', color: liked ? '#e11d48' : '#9ca3af', action: handleLike },
              { icon: '💬', label: 'Bình luận', color: '#9ca3af', action: () => {} },
              { icon: '↗️', label: 'Chia sẻ', color: '#9ca3af', action: () => {} },
            ].map(({ icon, label, color, action }) => (
              <button key={label} onClick={action} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium" style={{ color }}>
                <span>{icon}</span>{label}
              </button>
            ))}
          </div>
        </div>

        {/* Comments */}
        <div className="px-4 pt-4 pb-4 space-y-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{comments.length} bình luận</p>
          {comments.map(c => {
            const commenter = users.find(u => u.id === c.userId);
            if (!commenter) return null;
            return (
              <div key={c.id} className="flex gap-3">
                <button onClick={() => onPush({ screen: 'profile', userId: commenter.id })}>
                  <img src={commenter.avatar} alt={commenter.name} className="w-9 h-9 rounded-xl object-cover flex-none" />
                </button>
                <div className="flex-1">
                  <div className="rounded-3xl rounded-tl-none px-3.5 py-2.5" style={{ background: 'white', border: '1px solid #e8f5e9' }}>
                    <p className="text-xs font-bold text-gray-900 mb-0.5">{commenter.name}</p>
                    <p className="text-sm text-gray-700 leading-relaxed">{c.content}</p>
                  </div>
                  <div className="flex items-center gap-4 mt-1 px-1">
                    <span className="text-[10px] text-gray-400">{c.time}</span>
                    <button className="text-[10px] font-semibold text-gray-500">Thích {c.likes > 0 ? `(${c.likes})` : ''}</button>
                    <button className="text-[10px] font-semibold text-gray-500">Trả lời</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Comment input */}
      <div className="bg-white px-4 py-3 flex items-center gap-2" style={{ borderTop: '1px solid #e8f5e9' }}>
        <img src={me.avatar} alt="Me" className="w-8 h-8 rounded-xl object-cover flex-none" />
        <div className="flex-1 flex items-center rounded-2xl px-3 py-2 gap-2" style={{ background: '#f0fdf4', border: '1px solid #e8f5e9' }}>
          <input value={commentText} onChange={e => setCommentText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleComment()} placeholder="Viết bình luận..." className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none" />
        </div>
        <button onClick={handleComment} disabled={!commentText.trim()} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: commentText.trim() ? '#2d6a4f' : '#e5e7eb' }}>
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
        </button>
      </div>
    </div>
  );
}
