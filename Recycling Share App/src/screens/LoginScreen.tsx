import { useState } from 'react';

interface Props {
  mode: 'login' | 'register';
  onAuth: () => void;
  onToggle: () => void;
  onForgotPassword: () => void;
}

export default function LoginScreen({ mode, onAuth, onToggle, onForgotPassword }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await new Promise(r => setTimeout(r, 1600));
    setLoading(false);
    onAuth();
  };

  return (
    <div className="relative h-full flex flex-col overflow-hidden">
      <div className="absolute inset-0">
        <img src="https://images.unsplash.com/photo-1780398021247-1b846ecc2de9?w=430&h=932&fit=crop&auto=format" alt="Crafting" className="w-full h-full object-cover" />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(27,67,50,0.75) 0%, rgba(27,67,50,0.35) 35%, rgba(13,31,21,0.85) 65%, #0d1f15 100%)' }} />
      </div>

      <div className="relative flex-1 flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-end pb-8 px-6">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-5 border border-white/25" style={{ background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(16px)' }}>
            <span className="text-4xl">♻️</span>
          </div>
          <h1 className="text-5xl font-bold text-white tracking-tight" style={{ fontFamily: 'Fraunces, Georgia, serif', textShadow: '0 2px 20px rgba(0,0,0,0.4)' }}>EcoShare</h1>
          <p className="text-green-200 mt-2 text-base text-center">Cộng đồng tái chế — Sống xanh cùng nhau 🌿</p>
          <div className="flex gap-6 mt-5">
            {[['1.247', 'thành viên'], ['89kg', 'tái chế/ngày'], ['4.6★', 'đánh giá']].map(([v, l]) => (
              <div key={l} className="text-center">
                <div className="text-white font-bold text-lg">{v}</div>
                <div className="text-green-300 text-xs">{l}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white px-6 pt-7 pb-10 fade-in" style={{ borderRadius: '32px 32px 0 0' }}>
          <h2 className="text-2xl font-bold text-gray-900 mb-1">{mode === 'login' ? 'Chào mừng trở lại! 👋' : 'Tạo tài khoản 🌱'}</h2>
          <p className="text-gray-400 text-sm mb-6">{mode === 'login' ? 'Đăng nhập để kết nối với cộng đồng xanh' : 'Tham gia ngay, cùng nhau bảo vệ Trái Đất'}</p>

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'register' && (
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Họ và tên</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Nguyễn Văn A" className="mt-1.5 w-full px-4 py-3.5 rounded-2xl text-sm text-gray-900 placeholder-gray-300 outline-none" style={{ background: '#f8faf8', border: '1.5px solid #e8f5e9' }} />
              </div>
            )}
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" className="mt-1.5 w-full px-4 py-3.5 rounded-2xl text-sm text-gray-900 placeholder-gray-300 outline-none" style={{ background: '#f8faf8', border: '1.5px solid #e8f5e9' }} />
            </div>
            <div className="relative">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Mật khẩu</label>
              <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="mt-1.5 w-full px-4 py-3.5 pr-14 rounded-2xl text-sm text-gray-900 placeholder-gray-300 outline-none" style={{ background: '#f8faf8', border: '1.5px solid #e8f5e9' }} />
              <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-4 top-9 text-xs font-medium" style={{ color: '#52b788' }}>{showPass ? 'Ẩn' : 'Hiện'}</button>
            </div>
            {mode === 'login' && (
              <div className="text-right">
                <button type="button" onClick={onForgotPassword} className="text-sm font-semibold" style={{ color: '#2d6a4f' }}>Quên mật khẩu?</button>
              </div>
            )}
            <button type="submit" disabled={loading} className="mt-2 w-full py-4 rounded-2xl font-semibold text-white text-base transition-all active:scale-[0.98]" style={{ background: loading ? '#9ca3af' : 'linear-gradient(135deg, #1b4332 0%, #2d6a4f 50%, #52b788 100%)', boxShadow: loading ? 'none' : '0 8px 24px rgba(45,106,79,0.4)' }}>
              {loading ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Đang xử lý...</span> : mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3"><div className="flex-1 h-px bg-gray-100" /><span className="text-xs text-gray-300">hoặc</span><div className="flex-1 h-px bg-gray-100" /></div>

          <div className="flex gap-3">
            {[['🇬', 'Google'], ['🍎', 'Apple']].map(([icon, label]) => (
              <button key={label} className="flex-1 py-3 rounded-2xl border flex items-center justify-center gap-2 text-sm font-medium text-gray-600 active:bg-gray-50" style={{ borderColor: '#e8f5e9' }}>
                <span>{icon}</span>{label}
              </button>
            ))}
          </div>

          <p className="mt-6 text-center text-sm text-gray-400">
            {mode === 'login' ? 'Chưa có tài khoản? ' : 'Đã có tài khoản? '}
            <button onClick={onToggle} className="font-bold" style={{ color: '#2d6a4f' }}>{mode === 'login' ? 'Đăng ký ngay' : 'Đăng nhập'}</button>
          </p>
        </div>
      </div>
    </div>
  );
}
