import { posts } from '../data';
import type { Route } from '../navigation';
import PostCard from '../components/PostCard';

interface Props { tag: string; onBack: () => void; onPush: (r: Route) => void; }

export default function HashtagScreen({ tag, onBack, onPush }: Props) {
  const taggedPosts = posts.filter(p => p.tags.some(t => t.toLowerCase() === tag.toLowerCase()));

  return (
    <div className="h-full flex flex-col" style={{ background: '#f0fdf4' }}>
      <div className="bg-white px-4 pt-12 pb-4" style={{ borderBottom: '1px solid #e8f5e9' }}>
        <div className="flex items-center gap-3 mb-4">
          <button onClick={onBack} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#f0fdf4' }}>
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="#1b4332" strokeWidth={2} strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <div>
            <h1 className="text-xl font-bold" style={{ color: '#1b4332', fontFamily: 'Fraunces, Georgia, serif' }}>#{tag}</h1>
            <p className="text-xs text-gray-400">{taggedPosts.length} bài đăng</p>
          </div>
          <button className="ml-auto px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: 'linear-gradient(135deg, #2d6a4f, #52b788)' }}>
            + Theo dõi
          </button>
        </div>

        <div className="grid grid-cols-3 gap-1.5 rounded-2xl overflow-hidden">
          {taggedPosts.slice(0, 3).map(p => (
            <div key={p.id} className="relative" style={{ paddingTop: '100%' }}>
              <img src={p.images[0]} alt="" className="absolute inset-0 w-full h-full object-cover" />
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pt-2">
        {taggedPosts.length > 0 ? (
          taggedPosts.map(p => <PostCard key={p.id} post={p} />)
        ) : (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">🔍</p>
            <p className="text-gray-400 text-sm">Chưa có bài đăng nào với #{tag}</p>
          </div>
        )}
      </div>
    </div>
  );
}
