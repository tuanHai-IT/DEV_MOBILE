import { useState } from 'react';
import { users, notifications as initialNotifs, type Notification } from '../data';

export default function NotificationsScreen({ onBack }: { onBack: () => void }) {
  const [notifs, setNotifs] = useState(initialNotifs.map(n => ({ ...n })));

  const markRead = (id: string) => {
    setNotifs(ns => ns.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllRead = () => setNotifs(ns => ns.map(n => ({ ...n, read: true })));

  const typeIcon = (type: Notification['type']) => {
    return { like: '❤️', comment: '💬', friend_request: '👋', challenge: '🏆', mention: '📣' }[type];
  };

  const today = notifs.slice(0, 3);
  const earlier = notifs.slice(3);
  const unread = notifs.filter(n => !n.read).length;

  return (
    <div className="h-full flex flex-col" style={{ background: '#f0fdf4' }}>
      <div className="bg-white px-4 pt-12 pb-3" style={{ borderBottom: '1px solid #e8f5e9' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#f0fdf4' }}>
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="#1b4332" strokeWidth={2} strokeLinecap="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <h1 className="text-xl font-bold" style={{ color: '#1b4332', fontFamily: 'Fraunces, Georgia, serif' }}>
              Thông báo 🔔
            </h1>
            {unread > 0 && (
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white" style={{ background: '#ef4444' }}>
                {unread}
              </span>
            )}
          </div>
          {unread > 0 && (
            <button onClick={markAllRead} className="text-xs font-semibold" style={{ color: '#2d6a4f' }}>
              Đọc tất cả
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-3">
        <Section title="Hôm nay" items={today} onRead={markRead} typeIcon={typeIcon} />
        {earlier.length > 0 && <Section title="Trước đó" items={earlier} onRead={markRead} typeIcon={typeIcon} />}
      </div>
    </div>
  );
}

function Section({
  title, items, onRead, typeIcon,
}: {
  title: string;
  items: Notification[];
  onRead: (id: string) => void;
  typeIcon: (t: Notification['type']) => string;
}) {
  return (
    <div className="mb-4">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider px-4 mb-2">{title}</p>
      {items.map(notif => {
        const user = users.find(u => u.id === notif.userId)!;
        if (!user) return null;
        return (
          <button
            key={notif.id}
            onClick={() => onRead(notif.id)}
            className="w-full flex items-center gap-3 px-4 py-3.5 transition"
            style={{ background: notif.read ? 'transparent' : 'rgba(255,255,255,0.8)' }}
          >
            <div className="relative flex-none">
              <img src={user.avatar} alt={user.name} className="w-12 h-12 rounded-2xl object-cover" />
              <span
                className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white flex items-center justify-center text-sm"
                style={{ border: '1.5px solid #e8f5e9' }}
              >
                {typeIcon(notif.type)}
              </span>
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm text-gray-800 leading-snug">
                <span className="font-semibold">{user.name}</span>{' '}
                <span className={notif.read ? 'text-gray-500' : 'text-gray-800'}>{notif.content}</span>
              </p>
              <p className="text-xs text-gray-400 mt-0.5">{notif.time}</p>
            </div>
            {!notif.read && (
              <span className="flex-none w-2.5 h-2.5 rounded-full" style={{ background: '#2d6a4f' }} />
            )}
          </button>
        );
      })}
    </div>
  );
}
