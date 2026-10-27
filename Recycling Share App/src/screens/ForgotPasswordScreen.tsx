import { useState } from 'react';

interface Props { onBack: () => void; onSent: () => void; }

export default function ForgotPasswordScreen({ onBack, onSent }: Props) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    await new Promise(r => setTimeout(r, 1500));
    setLoading(false);
    onSent();
  };

  return (
    <div className="h-full flex flex-col" style={{ background: '#f0fdf4' }}>
      <div className="bg-white px-4 pt-14 pb-6" style={{ borderBottom: '1px solid #e8f5e9' }}>
        <button onClick={onBack} className="w-9 h-9 rounded-xl flex items-center justify-center mb-6" style={{ background: '#f0fdf4' }}>
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="#1b4332" strokeWidth={2} strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <div className="text-4xl mb-3">🔑</div>
        <h1 className="text-2xl font-bold mb-2" style={{ color: '#1b4332', fontFamily: 'Fraunces, Georgia, serif' }}>Quên Mật Khẩu?</h1>
        <p className="text-gray-500 text-sm leading-relaxed">Nhập email của bạn và chúng mình sẽ gửi link đặt lại mật khẩu.</p>
      </div>

      <div className="flex-1 p-6">
        <form onSubmit={handleSend} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Địa chỉ Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="email@example.com"
              className="mt-2 w-full px-4 py-3.5 rounded-2xl text-sm text-gray-800 placeholder-gray-300 outline-none"
              style={{ background: 'white', border: '1.5px solid #e8f5e9' }}
            />
          </div>
          <button
            type="submit" disabled={!email.trim() || loading}
            className="w-full py-4 rounded-2xl font-semibold text-white text-base transition-all active:scale-95"
            style={{ background: email.trim() ? 'linear-gradient(135deg, #1b4332, #52b788)' : '#d1d5db', boxShadow: email.trim() ? '0 8px 24px rgba(45,106,79,0.4)' : 'none' }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Đang gửi...
              </span>
            ) : '📧 Gửi Link Đặt Lại'}
          </button>
        </form>

        <div className="mt-8 space-y-3">
          {['Kiểm tra thư mục Spam nếu không thấy email', 'Link có hiệu lực trong 30 phút', 'Liên hệ hỗ trợ nếu vẫn gặp vấn đề'].map((tip, i) => (
            <div key={i} className="flex gap-3 items-start p-3 rounded-2xl" style={{ background: '#f0fdf4' }}>
              <span className="text-base">{['📂', '⏰', '💬'][i]}</span>
              <p className="text-xs text-gray-500">{tip}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
