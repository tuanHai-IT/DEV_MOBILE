import { useState } from 'react';
import { users, chats, type Message } from '../data';

interface Props {
  currentUserId: string;
  initialChatUserId?: string;
  onBack?: () => void;
}

export default function MessagesScreen({ currentUserId, initialChatUserId, onBack }: Props) {
  const [chatUserId, setChatUserId] = useState<string | null>(initialChatUserId || null);

  if (chatUserId) {
    return (
      <ChatDetail
        userId={chatUserId}
        currentUserId={currentUserId}
        onBack={() => {
          if (initialChatUserId) {
            onBack?.();
          } else {
            setChatUserId(null);
          }
        }}
      />
    );
  }

  return <ChatList onOpenChat={setChatUserId} currentUserId={currentUserId} onBack={onBack} />;
}

function ChatList({ onOpenChat, currentUserId, onBack }: { onOpenChat: (id: string) => void; currentUserId: string; onBack?: () => void }) {
  const [search, setSearch] = useState('');

  const sortedChats = chats.filter(c => {
    const user = users.find(u => u.id === c.userId);
    return !search || user?.name.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="h-full flex flex-col" style={{ background: '#f0fdf4' }}>
      <div className="bg-white px-4 pt-12 pb-3" style={{ borderBottom: '1px solid #e8f5e9' }}>
        <div className="flex items-center justify-between mb-3">
          {onBack ? (
            <button onClick={onBack} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#f0fdf4' }}>
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="#1b4332" strokeWidth={2} strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
          ) : null}
          <h1 className="text-xl font-bold flex-1" style={{ color: '#1b4332', fontFamily: 'Fraunces, Georgia, serif' }}>
            Tin nhắn 💬
          </h1>
          <button className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#f0fdf4' }}>
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="#2d6a4f" strokeWidth={1.8} strokeLinecap="round">
              <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        </div>
        <div className="relative">
          <svg viewBox="0 0 24 24" className="absolute left-3 top-3 w-4 h-4" fill="none" stroke="#9ca3af" strokeWidth={2} strokeLinecap="round">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Tìm kiếm tin nhắn..."
            className="w-full pl-9 pr-4 py-2.5 rounded-2xl text-sm text-gray-700 placeholder-gray-300 outline-none"
            style={{ background: '#f0fdf4', border: '1px solid #e8f5e9' }}
          />
        </div>
      </div>

      <div className="bg-white px-4 py-3" style={{ borderBottom: '1px solid #e8f5e9' }}>
        <p className="text-xs font-semibold text-gray-400 mb-2">ĐANG HOẠT ĐỘNG</p>
        <div className="flex gap-4 overflow-x-auto">
          {users.filter(u => u.isOnline && u.id !== currentUserId && u.isFriend).map(user => (
            <button key={user.id} onClick={() => onOpenChat(user.id)} className="flex-none flex flex-col items-center gap-1">
              <div className="relative">
                <img src={user.avatar} alt={user.name} className="w-11 h-11 rounded-2xl object-cover" />
                <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white" style={{ background: '#22c55e' }} />
              </div>
              <span className="text-[10px] text-gray-500">{user.name.split(' ').pop()}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {sortedChats.map(chat => {
          const user = users.find(u => u.id === chat.userId)!;
          const lastMsg = chat.messages[chat.messages.length - 1];
          return (
            <button
              key={chat.id}
              onClick={() => onOpenChat(user.id)}
              className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-white/80 transition"
            >
              <div className="relative flex-none">
                <img src={user.avatar} alt={user.name} className="w-14 h-14 rounded-2xl object-cover" />
                {user.isOnline && <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#f0fdf4]" style={{ background: '#22c55e' }} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-gray-900 text-sm truncate">{user.name}</p>
                  <p className="text-[10px] flex-none ml-2" style={{ color: chat.unread > 0 ? '#2d6a4f' : '#9ca3af' }}>{chat.lastActive}</p>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <p className={`text-xs truncate flex-1 ${chat.unread > 0 ? 'font-semibold text-gray-800' : 'text-gray-400'}`}>
                    {lastMsg.senderId === currentUserId ? 'Bạn: ' : ''}{lastMsg.content}
                  </p>
                  {chat.unread > 0 && (
                    <span className="flex-none ml-2 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ background: '#2d6a4f' }}>
                      {chat.unread}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ChatDetail({ userId, currentUserId, onBack }: { userId: string; currentUserId: string; onBack: () => void }) {
  const user = users.find(u => u.id === userId)!;
  const chat = chats.find(c => c.userId === userId);
  const [messages, setMessages] = useState<Message[]>(chat?.messages || []);
  const [input, setInput] = useState('');

  const send = () => {
    if (!input.trim()) return;
    setMessages(ms => [...ms, {
      id: `m${Date.now()}`, senderId: currentUserId, content: input.trim(),
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }), read: true,
    }]);
    setInput('');
  };

  const quickReplies = ['👍 Hay quá!', '♻️ Mình cũng thích!', '🌿 Cảm ơn bạn!', '📸 Gửi ảnh cho mình'];

  return (
    <div className="h-full flex flex-col slide-in-right" style={{ background: '#f0fdf4' }}>
      <div className="bg-white px-4 pt-12 pb-3 flex items-center gap-3" style={{ borderBottom: '1px solid #e8f5e9' }}>
        <button onClick={onBack} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#f0fdf4' }}>
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="#1b4332" strokeWidth={2} strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <div className="relative">
          <img src={user.avatar} alt={user.name} className="w-10 h-10 rounded-2xl object-cover" />
          {user.isOnline && <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white" style={{ background: '#22c55e' }} />}
        </div>
        <div className="flex-1">
          <p className="font-bold text-gray-900 text-sm">{user.name}</p>
          <p className="text-xs" style={{ color: user.isOnline ? '#22c55e' : '#9ca3af' }}>
            {user.isOnline ? '● Đang hoạt động' : `Hoạt động ${chat?.lastActive}`}
          </p>
        </div>
        <button className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#f0fdf4' }}>
          <svg viewBox="0 0 24 24" className="w-4.5 h-4.5" fill="none" stroke="#2d6a4f" strokeWidth={1.8} strokeLinecap="round">
            <path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2">
        {messages.map((msg, i) => {
          const isMe = msg.senderId === currentUserId;
          const showAvatar = !isMe && (i === 0 || messages[i - 1]?.senderId !== msg.senderId);
          return (
            <div key={msg.id} className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
              {!isMe && (
                <div className="w-7 flex-none">
                  {showAvatar && <img src={user.avatar} alt={user.name} className="w-7 h-7 rounded-xl object-cover" />}
                </div>
              )}
              <div className={`max-w-[72%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                <div
                  className="px-4 py-2.5 rounded-3xl text-sm leading-relaxed"
                  style={{
                    background: isMe ? 'linear-gradient(135deg, #2d6a4f, #52b788)' : 'white',
                    color: isMe ? 'white' : '#1f2937',
                    borderBottomRightRadius: isMe ? 6 : 24,
                    borderBottomLeftRadius: isMe ? 24 : 6,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                  }}
                >
                  {msg.content}
                </div>
                <span className="text-[10px] text-gray-400 mt-1 px-1">{msg.time}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-4 pb-2 flex gap-2 overflow-x-auto">
        {quickReplies.map(r => (
          <button key={r} onClick={() => setInput(r)} className="flex-none px-3 py-1.5 rounded-full text-xs font-medium border" style={{ borderColor: '#bbf7d0', color: '#2d6a4f', background: 'white' }}>
            {r}
          </button>
        ))}
      </div>

      <div className="bg-white px-4 py-3 flex items-center gap-3" style={{ borderTop: '1px solid #e8f5e9' }}>
        <button className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#f0fdf4' }}>
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="#2d6a4f" strokeWidth={1.8} strokeLinecap="round">
            <path d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        </button>
        <div className="flex-1 flex items-center rounded-2xl px-4 py-2.5" style={{ background: '#f0fdf4', border: '1px solid #e8f5e9' }}>
          <input
            value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="Nhắn tin..."
            className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-300 outline-none"
          />
          <button className="ml-2 text-base">🌿</button>
        </div>
        <button onClick={send} disabled={!input.trim()} className="w-10 h-10 rounded-2xl flex items-center justify-center transition-all" style={{ background: input.trim() ? 'linear-gradient(135deg, #2d6a4f, #52b788)' : '#e5e7eb', boxShadow: input.trim() ? '0 4px 12px rgba(45,106,79,0.4)' : 'none' }}>
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
