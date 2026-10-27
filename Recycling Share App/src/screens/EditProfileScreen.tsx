import { useState } from 'react';
import { users, CURRENT_USER_ID } from '../data';

export default function EditProfileScreen({ onBack }: { onBack: () => void }) {
  const user = users.find(u => u.id === CURRENT_USER_ID)!;
  const [name, setName] = useState(user.name);
  const [username, setUsername] = useState(user.username);
  const [bio, setBio] = useState(user.bio);
  const [location, setLocation] = useState(user.location);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await new Promise(r => setTimeout(r, 1200));
    setSaving(false);
    setSaved(true);
    setTimeout(() => { setSaved(false); onBack(); }, 1000);
  };

  return (
    <div className="h-full flex flex-col" style={{ background: '#f0fdf4' }}>
      <div className="bg-white px-4 pt-12 pb-3 flex items-center gap-3" style={{ borderBottom: '1px solid #e8f5e9' }}>
        <button onClick={onBack} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#f0fdf4' }}>
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="#1b4332" strokeWidth={2} strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <h1 className="flex-1 text-xl font-bold" style={{ color: '#1b4332', fontFamily: 'Fraunces, Georgia, serif' }}>Chỉnh Sửa Hồ Sơ ✏️</h1>
        <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: saved ? '#22c55e' : 'linear-gradient(135deg, #2d6a4f, #52b788)' }}>
          {saving ? '...' : saved ? '✓ Đã lưu!' : 'Lưu'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Avatar */}
        <div className="bg-white rounded-3xl p-6 flex flex-col items-center" style={{ border: '1px solid #e8f5e9' }}>
          <div className="relative">
            <img src={user.avatar} alt={user.name} className="w-24 h-24 rounded-3xl object-cover" style={{ border: '4px solid #f0fdf4' }} />
            <button className="absolute -bottom-2 -right-2 w-8 h-8 rounded-xl flex items-center justify-center text-white text-sm" style={{ background: '#2d6a4f' }}>📷</button>
          </div>
          <p className="text-xs text-gray-400 mt-3">Nhấn để thay đổi ảnh đại diện</p>
        </div>

        {/* Fields */}
        {[
          { label: 'Họ và tên', value: name, set: setName, placeholder: 'Tên đầy đủ của bạn', icon: '👤' },
          { label: 'Username', value: username, set: setUsername, placeholder: 'ten_nguoi_dung', icon: '@' },
          { label: 'Địa điểm', value: location, set: setLocation, placeholder: 'Hà Nội, Việt Nam', icon: '📍' },
        ].map(({ label, value, set, placeholder, icon }) => (
          <div key={label} className="bg-white rounded-3xl p-4" style={{ border: '1px solid #e8f5e9' }}>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest flex items-center gap-1.5 mb-2">
              <span>{icon}</span>{label}
            </label>
            <input
              value={value} onChange={e => set(e.target.value)} placeholder={placeholder}
              className="w-full text-sm text-gray-800 bg-transparent outline-none"
            />
          </div>
        ))}

        {/* Bio */}
        <div className="bg-white rounded-3xl p-4" style={{ border: '1px solid #e8f5e9' }}>
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest flex items-center gap-1.5 mb-2">
            <span>📝</span>Giới thiệu
          </label>
          <textarea
            value={bio} onChange={e => setBio(e.target.value)}
            className="w-full text-sm text-gray-800 bg-transparent outline-none resize-none min-h-20"
            placeholder="Chia sẻ đôi điều về bạn và hành trình tái chế..."
          />
          <p className="text-[10px] text-right text-gray-300 mt-1">{bio.length}/150</p>
        </div>

        {/* Cover photo */}
        <div className="bg-white rounded-3xl overflow-hidden" style={{ border: '1px solid #e8f5e9' }}>
          <div className="relative" style={{ height: 120 }}>
            <img src={user.cover} alt="Cover" className="w-full h-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.3)' }}>
              <button className="px-4 py-2 rounded-2xl text-white text-sm font-semibold" style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.3)' }}>
                🖼️ Đổi ảnh bìa
              </button>
            </div>
          </div>
          <div className="px-4 py-3">
            <p className="text-xs font-semibold text-gray-500">Ảnh bìa trang cá nhân</p>
          </div>
        </div>

        <div className="h-4" />
      </div>
    </div>
  );
}
