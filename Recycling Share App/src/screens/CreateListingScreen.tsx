import { useState } from 'react';

const categories = ['Nhựa', 'Giấy', 'Kim loại', 'Điện tử', 'Vải', 'Khác'];
const conditions = ['Mới', 'Như mới', 'Tốt', 'Còn dùng được'];
const listingTypes = ['Bán', 'Trao đổi', 'Cho tặng'];

const sampleImages = [
  'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=200&h=200&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=200&h=200&fit=crop&auto=format',
];

export default function CreateListingScreen({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ title: '', category: '', condition: '', type: 'Bán', price: '', desc: '' });
  const [images, setImages] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));

  if (submitted) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center" style={{ background: '#f0fdf4' }}>
        <div className="text-7xl mb-6">🎉</div>
        <h2 className="text-2xl font-bold mb-3" style={{ color: '#1b4332', fontFamily: 'Fraunces, Georgia, serif' }}>Đăng thành công!</h2>
        <p className="text-gray-500 text-sm mb-2">Tin đăng của bạn đã được đưa lên chợ EcoShare.</p>
        <p className="text-gray-400 text-xs mb-8">Bạn sẽ nhận thông báo khi có người quan tâm.</p>
        <button onClick={onBack} className="w-full py-4 rounded-2xl font-semibold text-white" style={{ background: 'linear-gradient(135deg, #1b4332, #52b788)' }}>
          Về trang chủ
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
          {step === 1 ? '📦 Đăng Tin Mới' : '💰 Giá & Chi tiết'}
        </h1>
        <div className="flex gap-1">
          {[1, 2].map(s => (
            <div key={s} className="h-1.5 rounded-full transition-all" style={{ width: step >= s ? 24 : 12, background: step >= s ? '#2d6a4f' : '#e5e7eb' }} />
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {step === 1 ? (
          <>
            {/* Photos */}
            <div className="bg-white rounded-3xl p-4" style={{ border: '1px solid #e8f5e9' }}>
              <p className="font-semibold text-gray-800 text-sm mb-3">📷 Thêm ảnh (tối đa 6)</p>
              <div className="flex gap-2 flex-wrap">
                {images.map((img, i) => (
                  <div key={i} className="relative w-20 h-20 rounded-2xl overflow-hidden">
                    <img src={img} alt="" className="w-full h-full object-cover" />
                    <button onClick={() => setImages(im => im.filter((_, idx) => idx !== i))} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">✕</button>
                  </div>
                ))}
                {images.length < 6 && (
                  <button onClick={() => setImages(im => [...im, sampleImages[im.length % 2]])} className="w-20 h-20 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center" style={{ borderColor: '#bbf7d0', background: '#f0fdf4' }}>
                    <span className="text-2xl">+</span>
                    <span className="text-[10px] text-gray-400">Thêm ảnh</span>
                  </button>
                )}
              </div>
            </div>

            {/* Category */}
            <div className="bg-white rounded-3xl p-4" style={{ border: '1px solid #e8f5e9' }}>
              <p className="font-semibold text-gray-800 text-sm mb-3">🗂️ Danh mục</p>
              <div className="flex flex-wrap gap-2">
                {categories.map(c => (
                  <button key={c} onClick={() => set('category', c)} className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all" style={{ background: form.category === c ? '#2d6a4f' : '#f0fdf4', color: form.category === c ? 'white' : '#6b7280' }}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Type */}
            <div className="bg-white rounded-3xl p-4" style={{ border: '1px solid #e8f5e9' }}>
              <p className="font-semibold text-gray-800 text-sm mb-3">🏷️ Hình thức</p>
              <div className="flex gap-2">
                {listingTypes.map(t => (
                  <button key={t} onClick={() => set('type', t)} className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all" style={{ background: form.type === t ? '#2d6a4f' : '#f0fdf4', color: form.type === t ? 'white' : '#6b7280' }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Condition */}
            <div className="bg-white rounded-3xl p-4" style={{ border: '1px solid #e8f5e9' }}>
              <p className="font-semibold text-gray-800 text-sm mb-3">✨ Tình trạng</p>
              <div className="flex flex-wrap gap-2">
                {conditions.map(c => (
                  <button key={c} onClick={() => set('condition', c)} className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all" style={{ background: form.condition === c ? '#2d6a4f' : '#f0fdf4', color: form.condition === c ? 'white' : '#6b7280' }}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Title */}
            <div className="bg-white rounded-3xl p-4" style={{ border: '1px solid #e8f5e9' }}>
              <p className="font-semibold text-gray-800 text-sm mb-2">📝 Tiêu đề</p>
              <input value={form.title} onChange={e => set('title', e.target.value)} className="w-full text-sm text-gray-700 outline-none" placeholder="Vd: Chai nhựa PET loại lớn cần thanh lý..." style={{ borderBottom: '1px solid #e8f5e9', paddingBottom: 8 }} />
            </div>

            {/* Price */}
            {form.type === 'Bán' && (
              <div className="bg-white rounded-3xl p-4" style={{ border: '1px solid #e8f5e9' }}>
                <p className="font-semibold text-gray-800 text-sm mb-2">💰 Giá bán (₫)</p>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 font-bold">₫</span>
                  <input type="number" value={form.price} onChange={e => set('price', e.target.value)} className="flex-1 text-lg font-bold text-gray-800 outline-none" placeholder="0" />
                </div>
              </div>
            )}

            {/* Description */}
            <div className="bg-white rounded-3xl p-4" style={{ border: '1px solid #e8f5e9' }}>
              <p className="font-semibold text-gray-800 text-sm mb-2">📋 Mô tả</p>
              <textarea value={form.desc} onChange={e => set('desc', e.target.value)} className="w-full text-sm text-gray-600 outline-none resize-none" rows={4} placeholder="Mô tả chi tiết sản phẩm, lý do đăng, cách thức giao nhận..." />
            </div>

            {/* Eco tip */}
            <div className="rounded-3xl p-4" style={{ background: 'linear-gradient(135deg, #1b4332, #2d6a4f)' }}>
              <p className="text-white text-sm font-semibold mb-1">🌱 Mẹo từ EcoShare</p>
              <p className="text-green-200 text-xs leading-relaxed">Thêm hashtag #taiche #ecoshare vào mô tả để tin của bạn được nhiều người thấy hơn!</p>
            </div>
          </>
        )}
        <div className="h-4" />
      </div>

      <div className="bg-white px-4 py-3" style={{ borderTop: '1px solid #e8f5e9' }}>
        {step === 1 ? (
          <button onClick={() => setStep(2)} className="w-full py-4 rounded-2xl font-semibold text-white" style={{ background: 'linear-gradient(135deg, #1b4332, #52b788)', boxShadow: '0 6px 20px rgba(45,106,79,0.35)' }}>
            Tiếp theo →
          </button>
        ) : (
          <button onClick={() => setSubmitted(true)} disabled={!form.title} className="w-full py-4 rounded-2xl font-semibold text-white disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #1b4332, #52b788)', boxShadow: '0 6px 20px rgba(45,106,79,0.35)' }}>
            🚀 Đăng tin ngay
          </button>
        )}
      </div>
    </div>
  );
}
