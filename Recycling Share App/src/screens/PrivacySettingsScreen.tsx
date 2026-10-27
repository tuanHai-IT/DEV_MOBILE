import { useState } from 'react';

const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
  <button onClick={() => onChange(!value)} className="relative w-12 h-6 rounded-full transition-all flex-none" style={{ background: value ? '#2d6a4f' : '#d1d5db' }}>
    <span className="absolute top-0.5 transition-all w-5 h-5 rounded-full bg-white shadow" style={{ left: value ? 26 : 2 }} />
  </button>
);

export default function PrivacySettingsScreen({ onBack }: { onBack: () => void }) {
  const [settings, setSettings] = useState({
    publicProfile: true,
    showLocation: true,
    showRecycled: true,
    allowMessages: true,
    allowFriendRequests: true,
    showOnlineStatus: false,
    indexInSearch: true,
    showActivity: false,
    shareData: false,
  });

  const toggle = (key: keyof typeof settings) => setSettings(s => ({ ...s, [key]: !s[key] }));

  const groups = [
    {
      title: '👁️ Hồ sơ',
      items: [
        { key: 'publicProfile' as const, label: 'Hồ sơ công khai', sub: 'Mọi người đều xem được hồ sơ của bạn' },
        { key: 'showLocation' as const, label: 'Hiển thị vị trí', sub: 'Tỉnh/thành phố trong hồ sơ' },
        { key: 'showRecycled' as const, label: 'Hiển thị thống kê tái chế', sub: 'Số kg tái chế và điểm Eco' },
        { key: 'indexInSearch' as const, label: 'Xuất hiện trong tìm kiếm', sub: 'Người khác tìm được bạn qua username' },
      ],
    },
    {
      title: '💬 Tương tác',
      items: [
        { key: 'allowMessages' as const, label: 'Nhận tin nhắn từ mọi người', sub: 'Không chỉ bạn bè' },
        { key: 'allowFriendRequests' as const, label: 'Nhận lời mời kết bạn', sub: 'Từ người lạ' },
        { key: 'showOnlineStatus' as const, label: 'Hiển thị trạng thái online', sub: 'Bạn bè thấy khi bạn online' },
        { key: 'showActivity' as const, label: 'Hiển thị hoạt động gần đây', sub: '"Hoạt động X phút trước"' },
      ],
    },
    {
      title: '📊 Dữ liệu',
      items: [
        { key: 'shareData' as const, label: 'Chia sẻ dữ liệu ẩn danh', sub: 'Giúp cải thiện ứng dụng' },
      ],
    },
  ];

  return (
    <div className="h-full flex flex-col" style={{ background: '#f0fdf4' }}>
      <div className="bg-white px-4 pt-12 pb-3 flex items-center gap-3" style={{ borderBottom: '1px solid #e8f5e9' }}>
        <button onClick={onBack} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#f0fdf4' }}>
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="#1b4332" strokeWidth={2} strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <h1 className="text-xl font-bold" style={{ color: '#1b4332', fontFamily: 'Fraunces, Georgia, serif' }}>Quyền Riêng Tư 🔒</h1>
      </div>

      <div className="flex-1 overflow-y-auto py-3 space-y-4">
        {groups.map(g => (
          <div key={g.title} className="px-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{g.title}</p>
            <div className="bg-white rounded-3xl overflow-hidden" style={{ border: '1px solid #e8f5e9' }}>
              {g.items.map((item, i) => (
                <div key={item.key}>
                  <div className="flex items-center gap-3 px-4 py-3.5">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">{item.label}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{item.sub}</p>
                    </div>
                    <Toggle value={settings[item.key]} onChange={() => toggle(item.key)} />
                  </div>
                  {i < g.items.length - 1 && <div className="h-px mx-4" style={{ background: '#f0fdf4' }} />}
                </div>
              ))}
            </div>
          </div>
        ))}
        <div className="px-4 pb-4">
          <div className="p-4 rounded-2xl" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
            <p className="text-xs text-gray-500 text-center">🔐 EcoShare không bán dữ liệu cá nhân của bạn cho bên thứ ba.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
