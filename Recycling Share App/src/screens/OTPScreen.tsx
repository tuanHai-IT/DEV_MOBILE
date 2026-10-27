import { useState, useRef } from 'react';

interface Props { onBack: () => void; onVerify: () => void; phone?: string; }

export default function OTPScreen({ onBack, onVerify, phone }: Props) {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resent, setResent] = useState(false);
  const refs = Array.from({ length: 6 }, () => useRef<HTMLInputElement>(null));

  const handleChange = (i: number, val: string) => {
    if (!/^[0-9]?$/.test(val)) return;
    const next = [...code];
    next[i] = val;
    setCode(next);
    if (val && i < 5) refs[i + 1].current?.focus();
    if (!val && i > 0) refs[i - 1].current?.focus();
  };

  const handleVerify = async () => {
    if (code.join('').length < 6) return;
    setLoading(true);
    await new Promise(r => setTimeout(r, 1500));
    onVerify();
  };

  const handleResend = async () => {
    setResent(true);
    await new Promise(r => setTimeout(r, 2000));
    setResent(false);
  };

  const filled = code.every(c => c !== '');

  return (
    <div className="h-full flex flex-col" style={{ background: '#f0fdf4' }}>
      {/* Header */}
      <div className="bg-white px-4 pt-14 pb-6" style={{ borderBottom: '1px solid #e8f5e9' }}>
        <button onClick={onBack} className="w-9 h-9 rounded-xl flex items-center justify-center mb-6" style={{ background: '#f0fdf4' }}>
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="#1b4332" strokeWidth={2} strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <div className="text-4xl mb-3">📱</div>
        <h1 className="text-2xl font-bold mb-2" style={{ color: '#1b4332', fontFamily: 'Fraunces, Georgia, serif' }}>Xác minh OTP</h1>
        <p className="text-gray-500 text-sm leading-relaxed">
          Mã xác minh 6 chữ số đã được gửi đến<br />
          <span className="font-semibold text-gray-700">{phone || 'email của bạn'}</span>
        </p>
      </div>

      <div className="flex-1 p-6">
        {/* OTP boxes */}
        <div className="flex gap-3 justify-center mt-4 mb-8">
          {code.map((c, i) => (
            <input
              key={i} ref={refs[i]} maxLength={1} value={c}
              onChange={e => handleChange(i, e.target.value)}
              className="w-12 h-14 text-center text-xl font-bold rounded-2xl outline-none transition-all"
              style={{
                background: c ? '#f0fdf4' : 'white',
                border: `2px solid ${c ? '#2d6a4f' : '#e8f5e9'}`,
                color: '#1b4332',
              }}
              inputMode="numeric"
            />
          ))}
        </div>

        {/* Verify button */}
        <button
          onClick={handleVerify} disabled={!filled || loading}
          className="w-full py-4 rounded-2xl font-semibold text-white text-base transition-all active:scale-95"
          style={{ background: filled ? 'linear-gradient(135deg, #1b4332, #52b788)' : '#d1d5db', boxShadow: filled ? '0 8px 24px rgba(45,106,79,0.4)' : 'none' }}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Đang xác minh...
            </span>
          ) : '✓ Xác minh'}
        </button>

        {/* Resend */}
        <div className="text-center mt-6">
          <p className="text-sm text-gray-400 mb-2">Không nhận được mã?</p>
          <button
            onClick={handleResend} disabled={resent}
            className="text-sm font-semibold" style={{ color: resent ? '#9ca3af' : '#2d6a4f' }}
          >
            {resent ? '✓ Đã gửi lại!' : 'Gửi lại mã OTP'}
          </button>
        </div>

        {/* Info */}
        <div className="mt-8 p-4 rounded-2xl" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
          <p className="text-xs text-gray-500 text-center">🔒 Mã OTP có hiệu lực trong 5 phút. Không chia sẻ mã này với ai.</p>
        </div>
      </div>
    </div>
  );
}
