import type { Tab } from '../App';

interface Props {
  active: Tab;
  onTab: (tab: Tab) => void;
  onCreate: () => void;
}

const HomeIcon = ({ filled }: { filled: boolean }) => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill={filled ? 'currentColor' : 'none'} stroke={filled ? 'none' : 'currentColor'} strokeWidth={1.8}>
    {filled
      ? <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
      : <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />}
  </svg>
);

const ExploreIcon = ({ filled }: { filled: boolean }) => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill={filled ? 'currentColor' : 'none'} stroke={filled ? 'none' : 'currentColor'} strokeWidth={1.8}>
    {filled
      ? <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15l-4-4 1.41-1.41L11 14.17l7.59-7.59L20 8l-9 9z" />
      : <path d="M12 2a10 10 0 100 20A10 10 0 0012 2zm0 0" strokeLinecap="round" />}
    {!filled && <path d="M14.5 9.5l-5 2.5 2.5 5 5-2.5-2.5-5z" strokeLinejoin="round" />}
  </svg>
);

const ChatIcon = ({ filled }: { filled: boolean }) => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill={filled ? 'currentColor' : 'none'} stroke={filled ? 'none' : 'currentColor'} strokeWidth={1.8}>
    {filled
      ? <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
      : <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" strokeLinecap="round" strokeLinejoin="round" />}
  </svg>
);

const ProfileIcon = ({ filled }: { filled: boolean }) => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill={filled ? 'currentColor' : 'none'} stroke={filled ? 'none' : 'currentColor'} strokeWidth={1.8}>
    {filled
      ? <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
      : <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" strokeLinecap="round" strokeLinejoin="round" />}
  </svg>
);

export default function BottomNav({ active, onTab, onCreate }: Props) {
  const items: { key: Tab; label: string; Icon: typeof HomeIcon }[] = [
    { key: 'home', label: 'Trang chủ', Icon: HomeIcon },
    { key: 'explore', label: 'Khám phá', Icon: ExploreIcon },
    { key: 'messages', label: 'Tin nhắn', Icon: ChatIcon },
    { key: 'profile', label: 'Hồ sơ', Icon: ProfileIcon },
  ];

  return (
    <nav
      className="relative z-50 bg-white border-t flex items-center px-2 pb-2 pt-1"
      style={{ borderColor: '#e8f5e9' }}
    >
      {/* Left pair */}
      {items.slice(0, 2).map(({ key, label, Icon }) => (
        <button
          key={key}
          onClick={() => onTab(key)}
          className="flex-1 flex flex-col items-center gap-0.5 py-1 transition-all"
          style={{ color: active === key ? '#2d6a4f' : '#9ca3af' }}
        >
          <Icon filled={active === key} />
          <span className="text-[10px] font-medium">{label}</span>
          {active === key && (
            <span className="w-1 h-1 rounded-full" style={{ background: '#2d6a4f' }} />
          )}
        </button>
      ))}

      {/* Center create button */}
      <button
        onClick={onCreate}
        className="flex-none mx-2 w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg active:scale-95 transition-transform"
        style={{ background: 'linear-gradient(135deg, #2d6a4f, #52b788)', boxShadow: '0 6px 20px rgba(45,106,79,0.45)' }}
      >
        <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      {/* Right pair */}
      {items.slice(2).map(({ key, label, Icon }) => (
        <button
          key={key}
          onClick={() => onTab(key)}
          className="flex-1 flex flex-col items-center gap-0.5 py-1 transition-all"
          style={{ color: active === key ? '#2d6a4f' : '#9ca3af' }}
        >
          <Icon filled={active === key} />
          <span className="text-[10px] font-medium">{label}</span>
          {active === key && (
            <span className="w-1 h-1 rounded-full" style={{ background: '#2d6a4f' }} />
          )}
        </button>
      ))}
    </nav>
  );
}
