import { useState } from 'react';
import { users, CURRENT_USER_ID, type User } from '../data';

export default function StoriesBar() {
  const [viewedStory, setViewedStory] = useState<string | null>(null);
  const [activeStory, setActiveStory] = useState<User | null>(null);
  const [progress, setProgress] = useState(0);

  const storiesUsers = users.filter(u => u.hasStory && u.id !== CURRENT_USER_ID);
  const currentUser = users.find(u => u.id === CURRENT_USER_ID)!;

  const openStory = (user: User) => {
    setActiveStory(user);
    setProgress(0);
    setViewedStory(user.id);
    setTimeout(() => setActiveStory(null), 4000);
  };

  const storyImages: Record<string, string> = {
    '2': 'https://images.unsplash.com/photo-1779966946521-e9317485653b?w=430&h=760&fit=crop&auto=format',
    '3': 'https://images.unsplash.com/photo-1757626065729-a13f763423e1?w=430&h=760&fit=crop&auto=format',
    '5': 'https://images.unsplash.com/photo-1773612973407-3b65988ce51a?w=430&h=760&fit=crop&auto=format',
    '6': 'https://images.unsplash.com/photo-1776880858371-a2893dc61fa6?w=430&h=760&fit=crop&auto=format',
    '1': 'https://images.unsplash.com/photo-1525695230005-efd074980869?w=430&h=760&fit=crop&auto=format',
  };

  return (
    <>
      <div className="flex gap-3 px-4 py-3 overflow-x-auto">
        {/* My story */}
        <button className="flex-none flex flex-col items-center gap-1.5 w-16">
          <div className="relative">
            <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-dashed border-green-300">
              <img src={currentUser.avatar} alt="Bạn" className="w-full h-full object-cover" />
            </div>
            <span
              className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full text-white flex items-center justify-center text-xs font-bold"
              style={{ background: '#2d6a4f', border: '2px solid white' }}
            >+</span>
          </div>
          <span className="text-[10px] text-gray-500 truncate w-14 text-center">Thêm tin</span>
        </button>

        {/* Friends' stories */}
        {storiesUsers.map(user => {
          const seen = viewedStory === user.id || user.storySeen;
          return (
            <button
              key={user.id}
              onClick={() => openStory(user)}
              className="flex-none flex flex-col items-center gap-1.5 w-16"
            >
              <div className={seen ? 'story-ring-seen' : 'story-ring'} style={{ display: 'inline-block' }}>
                <div className="w-[52px] h-[52px] rounded-xl overflow-hidden border-2 border-white">
                  <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                </div>
              </div>
              {user.isOnline && !seen && (
                <span
                  className="w-3 h-3 rounded-full border-2 border-white -mt-3 ml-8 z-10"
                  style={{ background: '#22c55e', display: 'block', position: 'relative', top: -44, left: 40 }}
                />
              )}
              <span className="text-[10px] text-gray-600 truncate w-14 text-center font-medium" style={{ marginTop: user.isOnline && !seen ? -10 : 0 }}>
                {user.name.split(' ').pop()}
              </span>
            </button>
          );
        })}
      </div>

      {/* Story viewer overlay */}
      {activeStory && (
        <div
          className="absolute inset-0 z-50 bg-black flex flex-col"
          onClick={() => setActiveStory(null)}
        >
          <img
            src={storyImages[activeStory.id] || activeStory.cover}
            alt="Story"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.7) 100%)' }} />

          {/* Progress bar */}
          <div className="relative z-10 px-4 pt-12 flex gap-1">
            <div className="flex-1 h-0.5 rounded-full bg-white/40">
              <div className="h-full rounded-full bg-white" style={{ width: '70%', transition: 'width 4s linear' }} />
            </div>
          </div>

          {/* User info */}
          <div className="relative z-10 flex items-center gap-3 px-4 pt-3">
            <img src={activeStory.avatar} alt={activeStory.name} className="w-9 h-9 rounded-full border-2 border-white object-cover" />
            <div>
              <p className="text-white font-semibold text-sm">{activeStory.name}</p>
              <p className="text-white/70 text-xs">2 giờ trước</p>
            </div>
            <button className="ml-auto text-white text-xl" onClick={() => setActiveStory(null)}>✕</button>
          </div>

          {/* Story caption */}
          <div className="absolute bottom-20 left-4 right-4 z-10">
            <p className="text-white text-sm font-medium" style={{ textShadow: '0 1px 8px rgba(0,0,0,0.8)' }}>
              ♻️ Dự án tái chế mới nhất của mình! Mọi người ủng hộ nhé 💚
            </p>
          </div>
        </div>
      )}
    </>
  );
}
