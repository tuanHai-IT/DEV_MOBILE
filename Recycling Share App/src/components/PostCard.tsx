import { useState } from 'react';
import { users, type Post } from '../data';
import { useNav } from '../navigation';

interface Props {
  post: Post;
}

export default function PostCard({ post }: Props) {
  const { push } = useNav();
  const [liked, setLiked] = useState(post.liked);
  const [likeCount, setLikeCount] = useState(post.likes);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [saved, setSaved] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const author = users.find(u => u.id === post.userId)!;

  const handleLike = () => {
    setLiked(!liked);
    setLikeCount(c => liked ? c - 1 : c + 1);
  };

  const preview = post.content.length > 120 && !expanded
    ? post.content.slice(0, 120) + '...'
    : post.content;

  const categoryColors: Record<string, string> = {
    'Nhựa': '#3b82f6', 'Thủy tinh': '#06b6d4', 'Cao su': '#f59e0b',
    'Điện tử': '#8b5cf6', 'Carton': '#78716c', 'Hỗn hợp': '#10b981',
  };

  return (
    <div className="bg-white rounded-3xl overflow-hidden shadow-sm mb-3 mx-4 fade-in" style={{ border: '1px solid #e8f5e9' }}>
      {/* Header */}
      <div className="flex items-center px-4 pt-4 pb-3 gap-3">
        <button onClick={() => push({ screen: 'profile', userId: author.id })} className="relative flex-none">
          <img src={author.avatar} alt={author.name} className="w-11 h-11 rounded-2xl object-cover" />
          {author.isOnline && (
            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white" style={{ background: '#22c55e' }} />
          )}
        </button>
        <div className="flex-1 min-w-0">
          <button onClick={() => push({ screen: 'profile', userId: author.id })} className="text-left">
            <p className="font-semibold text-gray-900 text-sm leading-tight">{author.name}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-gray-400 text-xs">{post.time}</span>
              <span className="text-gray-200">•</span>
              <span
                className="text-xs font-medium px-1.5 py-0.5 rounded-full"
                style={{ background: (categoryColors[post.category] || '#10b981') + '18', color: categoryColors[post.category] || '#10b981' }}
              >
                {post.category}
              </span>
              {post.recycledWeight && (
                <>
                  <span className="text-gray-200">•</span>
                  <span className="text-xs text-green-600 font-medium">♻️ {post.recycledWeight}</span>
                </>
              )}
            </div>
          </button>
        </div>
        <button onClick={() => push({ screen: 'report', postId: post.id })} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400">
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
            <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
          </svg>
        </button>
      </div>

      {/* Content text */}
      <div className="px-4 pb-3">
        <button onClick={() => push({ screen: 'post-detail', postId: post.id })} className="text-left w-full">
          <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-line">{preview}</p>
        </button>
        {post.content.length > 120 && (
          <button onClick={() => setExpanded(!expanded)} className="text-green-600 text-xs font-medium mt-1">
            {expanded ? 'Thu gọn' : 'Xem thêm'}
          </button>
        )}
        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {post.tags.map(tag => (
              <button key={tag} onClick={() => push({ screen: 'hashtag', tag })} className="text-xs font-medium" style={{ color: '#52b788' }}>
                #{tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Image */}
      {post.images[0] && (
        <button onClick={() => push({ screen: 'image-viewer', url: post.images[0] })} className="relative mx-4 rounded-2xl overflow-hidden mb-3 block w-[calc(100%-2rem)]" style={{ background: '#e8f5e9' }}>
          <img
            src={post.images[0]} alt="Post"
            className="w-full object-cover"
            style={{ maxHeight: 340, minHeight: 200 }}
          />
          {post.type === 'tip' && (
            <div className="absolute top-3 left-3 flex items-center gap-1 px-2.5 py-1 rounded-full text-white text-xs font-semibold" style={{ background: 'rgba(45,106,79,0.85)', backdropFilter: 'blur(8px)' }}>
              💡 Mẹo hay
            </div>
          )}
        </button>
      )}

      {/* Stats row */}
      <div className="flex items-center px-4 py-2 gap-1">
        <div className="flex -space-x-1 mr-1">
          {['❤️', '♻️', '🌿'].map(e => (
            <span key={e} className="w-5 h-5 rounded-full bg-white flex items-center justify-center text-xs shadow-sm border border-white">{e}</span>
          ))}
        </div>
        <span className="text-gray-400 text-xs flex-1">{likeCount.toLocaleString()} lượt thích</span>
        <button onClick={() => push({ screen: 'post-detail', postId: post.id })} className="text-gray-400 text-xs">
          {post.comments.length} bình luận
        </button>
        <span className="text-gray-200 mx-1">•</span>
        <span className="text-gray-400 text-xs">{post.shares} lượt chia sẻ</span>
      </div>

      {/* Divider */}
      <div className="h-px mx-4" style={{ background: '#f0fdf4' }} />

      {/* Action buttons */}
      <div className="flex items-center px-2 py-1">
        <button
          onClick={handleLike}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm font-medium transition-all active:scale-95"
          style={{ color: liked ? '#e11d48' : '#9ca3af' }}
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill={liked ? 'currentColor' : 'none'} stroke={liked ? 'none' : 'currentColor'} strokeWidth={1.8}>
            <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {liked ? 'Đã thích' : 'Thích'}
        </button>

        <button
          onClick={() => push({ screen: 'post-detail', postId: post.id })}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm font-medium text-gray-400"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
            <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 12.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          Bình luận
        </button>

        <button className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm font-medium text-gray-400">
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          Chia sẻ
        </button>

        <button
          onClick={() => setSaved(!saved)}
          className="w-10 flex items-center justify-center py-2.5"
          style={{ color: saved ? '#2d6a4f' : '#d1d5db' }}
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill={saved ? 'currentColor' : 'none'} stroke={saved ? 'none' : 'currentColor'} strokeWidth={1.8}>
            <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Comments section (inline preview) */}
      {showComments && (
        <div className="px-4 pb-4 fade-in" style={{ borderTop: '1px solid #f0fdf4' }}>
          <div className="space-y-3 mt-3">
            {post.comments.slice(0, 2).map(comment => {
              const commenter = users.find(u => u.id === comment.userId);
              if (!commenter) return null;
              return (
                <div key={comment.id} className="flex gap-2.5">
                  <img src={commenter.avatar} alt={commenter.name} className="w-7 h-7 rounded-xl object-cover flex-none mt-0.5" />
                  <div className="flex-1">
                    <div className="rounded-2xl rounded-tl-none px-3 py-2" style={{ background: '#f0fdf4' }}>
                      <p className="text-xs font-semibold text-gray-800 mb-0.5">{commenter.name}</p>
                      <p className="text-xs text-gray-600 leading-relaxed">{comment.content}</p>
                    </div>
                    <div className="flex items-center gap-3 mt-1 px-1">
                      <span className="text-[10px] text-gray-400">{comment.time}</span>
                      <button className="text-[10px] text-gray-500 font-medium">Thích ({comment.likes})</button>
                    </div>
                  </div>
                </div>
              );
            })}
            {post.comments.length > 2 && (
              <button onClick={() => push({ screen: 'post-detail', postId: post.id })} className="text-xs font-semibold" style={{ color: '#2d6a4f' }}>
                Xem tất cả {post.comments.length} bình luận →
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 mt-3">
            <div className="w-7 h-7 rounded-xl overflow-hidden flex-none" style={{ background: '#d1fae5' }}>
              <span className="text-xs flex items-center justify-center h-full">👤</span>
            </div>
            <div className="flex-1 flex items-center rounded-2xl px-3 py-2 gap-2" style={{ background: '#f0fdf4' }}>
              <input
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                placeholder="Bình luận..."
                className="flex-1 bg-transparent text-xs text-gray-700 placeholder-gray-400 outline-none"
              />
              {commentText && (
                <button onClick={() => setCommentText('')} className="text-xs font-semibold" style={{ color: '#2d6a4f' }}>Gửi</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
