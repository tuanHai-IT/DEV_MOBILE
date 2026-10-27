import type { Route } from '../navigation';

interface Props { onBack: () => void; onPush: (r: Route) => void; }

const SettingRow = ({ icon, label, sub, danger, onClick, right }: { icon: string; label: string; sub?: string; danger?: boolean; onClick?: () => void; right?: string }) => (
  <button onClick={onClick} className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-gray-50 transition">
    <span className="text-xl w-7 text-center">{icon}</span>
    <div className="flex-1 text-left">
      <p className="text-sm font-medium" style={{ color: danger ? '#ef4444' : '#1f2937' }}>{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
    {right ? <span className="text-xs text-gray-400 font-medium">{right}</span> : (
      <svg viewBox="0 0 24 24" className="w-4 h-4 flex-none" fill="none" stroke="#d1d5db" strokeWidth={2} strokeLinecap="round"><path d="M9 18l6-6-6-6" /></svg>
    )}
  </button>
);

export default function SettingsScreen({ onBack, onPush }: Props) {
  const sections = [
    {
      title: 'Tài khoản',
      items: [
        { icon: '👤', label: 'Chỉnh sửa hồ sơ', sub: 'Tên, ảnh đại diện, bio', onClick: () => onPush({ screen: 'edit-profile' }) },
        { icon: '🔒', label: 'Quyền riêng tư', sub: 'Ai xem được bài đăng của bạn', onClick: () => onPush({ screen: 'privacy-settings' }) },
        { icon: '🔑', label: 'Đổi mật khẩu', sub: 'Bảo mật tài khoản' },
        { icon: '📧', label: 'Email & Số điện thoại', sub: 'lan@example.com' },
      ],
    },
    {
      title: 'Thông báo',
      items: [
        { icon: '🔔', label: 'Thông báo đẩy', sub: 'Bật', right: 'Bật' },
        { icon: '💬', label: 'Thông báo tin nhắn', right: 'Bật' },
        { icon: '❤️', label: 'Lượt thích & Bình luận', right: 'Bật' },
        { icon: '🏆', label: 'Thử thách & Điểm', right: 'Bật' },
      ],
    },
    {
      title: 'Về EcoShare',
      items: [
        { icon: '🌿', label: 'Tác động môi trường của tôi', onClick: () => onPush({ screen: 'my-impact' }) },
        { icon: '🏅', label: 'Huy hiệu của tôi', onClick: () => onPush({ screen: 'badges' }) },
        { icon: '❓', label: 'Trung tâm hỗ trợ', onClick: () => onPush({ screen: 'help-center' }) },
        { icon: '📋', label: 'Điều khoản & Chính sách', sub: 'Phiên bản 2.1' },
        { icon: 'ℹ️', label: 'Về ứng dụng', sub: 'EcoShare v2.5.1', right: 'v2.5.1' },
      ],
    },
    {
      title: '',
      items: [
        { icon: '🚪', label: 'Đăng xuất', danger: true },
        { icon: '🗑️', label: 'Xóa tài khoản', sub: 'Hành động không thể hoàn tác', danger: true },
      ],
    },
  ];

  return (
    <div className="h-full flex flex-col" style={{ background: '#f0fdf4' }}>
      <div className="bg-white px-4 pt-12 pb-3 flex items-center gap-3" style={{ borderBottom: '1px solid #e8f5e9' }}>
        <button onClick={onBack} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#f0fdf4' }}>
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="#1b4332" strokeWidth={2} strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <h1 className="text-xl font-bold" style={{ color: '#1b4332', fontFamily: 'Fraunces, Georgia, serif' }}>Cài Đặt ⚙️</h1>
      </div>

      <div className="flex-1 overflow-y-auto py-3">
        {sections.map((section, si) => (
          <div key={si} className="mb-3">
            {section.title && <p className="text-xs font-bold text-gray-400 uppercase tracking-wider px-4 mb-1">{section.title}</p>}
            <div className="bg-white mx-4 rounded-3xl overflow-hidden" style={{ border: '1px solid #e8f5e9' }}>
              {section.items.map((item, ii) => (
                <div key={ii}>
                  <SettingRow {...item} />
                  {ii < section.items.length - 1 && <div className="h-px ml-14" style={{ background: '#f0fdf4' }} />}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
