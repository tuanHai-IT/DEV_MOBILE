import { useState } from 'react';

const reasons = [
  { id: 'spam', label: 'Spam hoặc lừa đảo', icon: '⚠️' },
  { id: 'fake', label: 'Thông tin sai sự thật', icon: '❌' },
  { id: 'inappropriate', label: 'Nội dung không phù hợp', icon: '🚫' },
  { id: 'hate', label: 'Ngôn ngữ thù hận', icon: '😡' },
  { id: 'copyright', label: 'Vi phạm bản quyền', icon: '©️' },
  { id: 'other', label: 'Lý do khác', icon: '💬' },
];

export default function ReportScreen({ postId, onBack }: { postId?: string; onBack: () => void }) {
  const [step, setStep] = useState(1);
  const [reason, setReason] = useState('');
  const [detail, setDetail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center" style={{ background: '#f0fdf4' }}>
        <div className="text-7xl mb-6">✅</div>
        <h2 className="text-2xl font-bold mb-3" style={{ color: '#1b4332', fontFamily: 'Fraunces, Georgia, serif' }}>Đã gửi báo cáo!</h2>
        <p className="text-gray-500 text-sm mb-2">Cảm ơn bạn đã giúp EcoShare trở nên an toàn hơn.</p>
        <p className="text-gray-400 text-xs mb-8">Đội ngũ kiểm duyệt sẽ xem xét báo cáo trong vòng 24 giờ.</p>
        <button onClick={onBack} className="w-full py-4 rounded-2xl font-semibold text-white" style={{ background: 'linear-gradient(135deg, #1b4332, #52b788)' }}>
          Quay lại
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" style={{ background: '#f0fdf4' }}>
      <div className="bg-white px-4 pt-12 pb-3 flex items-center gap-3" style={{ borderBottom: '1px solid #e8f5e9' }}>
        <button onClick={step === 1 ? onBack : () => setStep(1)} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#f0fdf4' }}>
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="#1b4332" strokeWidth={2} strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <h1 className="flex-1 text-lg font-bold" style={{ color: '#1b4332', fontFamily: 'Fraunces, Georgia, serif' }}>
          🚩 Báo Cáo Vi Phạm
        </h1>
        {postId && <span className="text-xs text-gray-400">#{postId}</span>}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {step === 1 ? (
          <>
            <div className="bg-white rounded-3xl p-4" style={{ border: '1px solid #e8f5e9' }}>
              <p className="font-semibold text-gray-800 mb-1">Tại sao bạn báo cáo bài đăng này?</p>
              <p className="text-sm text-gray-400 mb-4">Chọn lý do phù hợp nhất với tình huống của bạn.</p>
              <div className="space-y-2">
                {reasons.map(r => (
                  <button
                    key={r.id}
                    onClick={() => setReason(r.id)}
                    className="w-full flex items-center gap-3 p-3 rounded-2xl transition-all text-left"
                    style={{ background: reason === r.id ? '#f0fdf4' : '#fafafa', border: `1.5px solid ${reason === r.id ? '#bbf7d0' : 'transparent'}` }}
                  >
                    <span className="text-xl">{r.icon}</span>
                    <span className="flex-1 text-sm font-medium text-gray-700">{r.label}</span>
                    <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-none" style={{ borderColor: reason === r.id ? '#2d6a4f' : '#e5e7eb', background: reason === r.id ? '#2d6a4f' : 'transparent' }}>
                      {reason === r.id && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-3xl p-4" style={{ background: 'linear-gradient(135deg, #f0fdf4, #d1fae5)', border: '1px solid #bbf7d0' }}>
              <p className="text-sm text-gray-600 leading-relaxed">
                <span className="font-semibold text-green-800">🔒 Bảo mật:</span> Báo cáo của bạn sẽ được giữ hoàn toàn ẩn danh. Người dùng được báo cáo sẽ không biết danh tính của bạn.
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="bg-white rounded-3xl p-4" style={{ border: '1px solid #e8f5e9' }}>
              <p className="font-semibold text-gray-800 mb-2">Chi tiết thêm (tùy chọn)</p>
              <p className="text-sm text-gray-400 mb-3">Mô tả thêm để đội kiểm duyệt hiểu rõ hơn về vấn đề.</p>
              <textarea
                value={detail}
                onChange={e => setDetail(e.target.value)}
                placeholder="Vd: Bài đăng chứa thông tin sai về cách tái chế nhựa PET..."
                className="w-full text-sm text-gray-700 outline-none resize-none leading-relaxed"
                rows={5}
                style={{ borderBottom: '1px solid #e8f5e9', paddingBottom: 8 }}
              />
              <p className="text-xs text-gray-400 text-right mt-1">{detail.length}/500</p>
            </div>

            <div className="bg-white rounded-3xl p-4" style={{ border: '1px solid #e8f5e9' }}>
              <p className="font-semibold text-gray-800 mb-3">Tóm tắt báo cáo</p>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{reasons.find(r => r.id === reason)?.icon}</span>
                <p className="text-sm text-gray-700">{reasons.find(r => r.id === reason)?.label}</p>
              </div>
              {postId && <p className="text-xs text-gray-400">Bài đăng: #{postId}</p>}
            </div>
          </>
        )}
        <div className="h-4" />
      </div>

      <div className="bg-white px-4 py-3" style={{ borderTop: '1px solid #e8f5e9' }}>
        {step === 1 ? (
          <button disabled={!reason} onClick={() => setStep(2)} className="w-full py-4 rounded-2xl font-semibold text-white disabled:opacity-40" style={{ background: 'linear-gradient(135deg, #1b4332, #52b788)' }}>
            Tiếp theo →
          </button>
        ) : (
          <button onClick={() => setSubmitted(true)} className="w-full py-4 rounded-2xl font-semibold text-white" style={{ background: 'linear-gradient(135deg, #dc2626, #ef4444)', boxShadow: '0 6px 20px rgba(220,38,38,0.3)' }}>
            🚩 Gửi báo cáo
          </button>
        )}
      </div>
    </div>
  );
}
