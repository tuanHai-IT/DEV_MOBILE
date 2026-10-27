import { useState } from 'react';
import type { User } from '../data';

const sampleImages = [
  { url: 'https://images.unsplash.com/photo-1525695230005-efd074980869?w=200&h=200&fit=crop&auto=format', label: 'Chậu chai nhựa' },
  { url: 'https://images.unsplash.com/photo-1757626065729-a13f763423e1?w=200&h=200&fit=crop&auto=format', label: 'Đèn thủy tinh' },
  { url: 'https://images.unsplash.com/photo-1779966946521-e9317485653b?w=200&h=200&fit=crop&auto=format', label: 'Xích đu lốp xe' },
  { url: 'https://images.unsplash.com/photo-1773612973407-3b65988ce51a?w=200&h=200&fit=crop&auto=format', label: 'Chắn gió nút chai' },
  { url: 'https://images.unsplash.com/photo-1776880858371-a2893dc61fa6?w=200&h=200&fit=crop&auto=format', label: 'CD chong chóng' },
  { url: 'https://images.unsplash.com/photo-1786840320329-cf55106ff617?w=200&h=200&fit=crop&auto=format', label: 'Kệ carton' },
];

const categories = ['Nhựa', 'Thủy tinh', 'Cao su', 'Giấy', 'Điện tử', 'Vải', 'Kim loại', 'Hỗn hợp'];
const postTypes = [
  { key: 'post', label: '📸 Bài chia sẻ', desc: 'Chia sẻ sản phẩm tái chế' },
  { key: 'tip', label: '💡 Mẹo hay', desc: 'Hướng dẫn cách tái chế' },
  { key: 'exchange', label: '🔄 Trao đổi', desc: 'Đăng đồ muốn trao đổi' },
];

export default function CreatePostModal({ currentUser, onClose }: { currentUser: User; onClose: () => void }) {
  const [step, setStep] = useState<'type' | 'compose'>('type');
  const [postType, setPostType] = useState('post');
  const [content, setContent] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [category, setCategory] = useState('');
  const [weight, setWeight] = useState('');
  const [tags, setTags] = useState('');
  const [posting, setPosting] = useState(false);
  const [done, setDone] = useState(false);

  const handlePost = async () => {
    if (!content.trim()) return;
    setPosting(true);
    await new Promise(r => setTimeout(r, 1500));
    setPosting(false);
    setDone(true);
    await new Promise(r => setTimeout(r, 1500));
    onClose();
  };

  if (done) {
    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/80" style={{ backdropFilter: 'blur(12px)' }}>
        <div className="text-center fade-in">
          <div className="text-6xl mb-4">🌿</div>
          <p className="text-xl font-bold" style={{ color: '#1b4332', fontFamily: 'Fraunces, Georgia, serif' }}>Đã đăng thành công!</p>
          <p className="text-gray-400 text-sm mt-1">Cảm ơn bạn đã chia sẻ với cộng đồng 💚</p>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-50 flex flex-col slide-up" style={{ background: '#f0fdf4' }}>
      {/* Header */}
      <div className="bg-white px-4 pt-12 pb-3 flex items-center gap-3" style={{ borderBottom: '1px solid #e8f5e9' }}>
        <button onClick={step === 'compose' ? () => setStep('type') : onClose} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#f0fdf4' }}>
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="#1b4332" strokeWidth={2} strokeLinecap="round">
            <path d={step === 'compose' ? 'M15 18l-6-6 6-6' : 'M6 18L18 6M6 6l12 12'} />
          </svg>
        </button>
        <h2 className="flex-1 font-bold text-lg" style={{ color: '#1b4332', fontFamily: 'Fraunces, Georgia, serif' }}>
          {step === 'type' ? 'Tạo bài đăng' : 'Soạn nội dung'}
        </h2>
        {step === 'compose' && (
          <button
            onClick={handlePost}
            disabled={!content.trim() || posting}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-white transition-all"
            style={{
              background: content.trim() && !posting ? 'linear-gradient(135deg, #2d6a4f, #52b788)' : '#d1d5db',
              boxShadow: content.trim() ? '0 4px 12px rgba(45,106,79,0.35)' : 'none',
            }}
          >
            {posting ? (
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Đang đăng
              </span>
            ) : 'Đăng'}
          </button>
        )}
      </div>

      {step === 'type' ? (
        <div className="flex-1 overflow-y-auto p-4">
          <p className="text-sm text-gray-500 mb-4">Bạn muốn chia sẻ gì với cộng đồng?</p>
          <div className="space-y-3">
            {postTypes.map(({ key, label, desc }) => (
              <button
                key={key}
                onClick={() => { setPostType(key); setStep('compose'); }}
                className="w-full text-left p-4 rounded-3xl bg-white flex items-center gap-4 transition-all active:scale-[0.98]"
                style={{ border: '1.5px solid #e8f5e9', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
              >
                <span className="text-3xl">{label.split(' ')[0]}</span>
                <div>
                  <p className="font-bold text-gray-900 text-sm">{label.split(' ').slice(1).join(' ')}</p>
                  <p className="text-gray-400 text-xs mt-0.5">{desc}</p>
                </div>
                <svg viewBox="0 0 24 24" className="ml-auto w-4 h-4 flex-none" fill="none" stroke="#9ca3af" strokeWidth={2} strokeLinecap="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            ))}
          </div>

          {/* Quick recycling facts */}
          <div className="mt-6 rounded-3xl p-4" style={{ background: 'linear-gradient(135deg, #1b4332, #2d6a4f)' }}>
            <p className="text-green-300 text-xs font-semibold mb-2">💡 BẠN CÓ BIẾT?</p>
            <p className="text-white text-sm leading-relaxed">
              Mỗi tấn giấy tái chế tiết kiệm được 17 cây xanh và 26.500 lít nước! 🌳
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {/* User info */}
          <div className="bg-white px-4 py-3 flex items-center gap-3" style={{ borderBottom: '1px solid #e8f5e9' }}>
            <img src={currentUser.avatar} alt={currentUser.name} className="w-10 h-10 rounded-2xl object-cover" />
            <div>
              <p className="font-semibold text-gray-900 text-sm">{currentUser.name}</p>
              <button className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: '#f0fdf4', color: '#2d6a4f' }}>
                🌍 Công khai <span>▾</span>
              </button>
            </div>
          </div>

          {/* Text input */}
          <div className="px-4 pt-4">
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder={postType === 'tip' ? 'Chia sẻ mẹo tái chế của bạn... Mô tả vật liệu, các bước thực hiện, kết quả 🌿' : postType === 'exchange' ? 'Mô tả đồ bạn muốn trao đổi... Tình trạng, kích thước, địa điểm gặp mặt 🔄' : 'Chia sẻ câu chuyện tái chế của bạn với cộng đồng... 💚'}
              className="w-full min-h-32 bg-transparent text-gray-800 text-sm leading-relaxed placeholder-gray-300 outline-none resize-none"
              autoFocus
            />
            <p className="text-right text-xs text-gray-300 mt-1">{content.length}/500</p>
          </div>

          {/* Selected image preview */}
          {selectedImage && (
            <div className="relative mx-4 mt-2 rounded-2xl overflow-hidden" style={{ height: 200 }}>
              <img src={selectedImage} alt="Selected" className="w-full h-full object-cover" />
              <button
                onClick={() => setSelectedImage(null)}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center text-white text-sm"
              >✕</button>
            </div>
          )}

          {/* Image picker */}
          <div className="px-4 mt-3">
            <p className="text-xs font-semibold text-gray-400 mb-2">📸 THÊM ẢNH</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              <button className="flex-none w-20 h-20 rounded-2xl flex flex-col items-center justify-center border-2 border-dashed border-green-200">
                <span className="text-green-400 text-xl">+</span>
                <span className="text-[9px] text-gray-400 mt-0.5">Từ máy</span>
              </button>
              {sampleImages.map(img => (
                <button
                  key={img.url}
                  onClick={() => setSelectedImage(img.url)}
                  className="flex-none w-20 h-20 rounded-2xl overflow-hidden relative"
                  style={{ border: selectedImage === img.url ? '2.5px solid #2d6a4f' : '2px solid transparent' }}
                >
                  <img src={img.url} alt={img.label} className="w-full h-full object-cover" />
                  {selectedImage === img.url && (
                    <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(45,106,79,0.3)' }}>
                      <span className="text-white text-lg">✓</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div className="px-4 mt-4">
            <p className="text-xs font-semibold text-gray-400 mb-2">🏷️ PHÂN LOẠI VẬT LIỆU</p>
            <div className="flex flex-wrap gap-2">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                  style={{
                    background: category === cat ? '#2d6a4f' : 'white',
                    color: category === cat ? 'white' : '#6b7280',
                    border: `1.5px solid ${category === cat ? '#2d6a4f' : '#e8f5e9'}`,
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Weight & Tags */}
          <div className="px-4 mt-4 grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-semibold text-gray-400 mb-1.5">⚖️ TRỌNG LƯỢNG TÁI CHẾ</p>
              <div className="flex items-center rounded-2xl px-3 py-2 bg-white" style={{ border: '1.5px solid #e8f5e9' }}>
                <input
                  value={weight} onChange={e => setWeight(e.target.value)}
                  placeholder="VD: 1.5"
                  className="flex-1 bg-transparent text-sm text-gray-800 outline-none w-0"
                />
                <span className="text-xs text-gray-400 font-medium">kg</span>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 mb-1.5">🔖 TAGS</p>
              <input
                value={tags} onChange={e => setTags(e.target.value)}
                placeholder="DIY, ZeroWaste..."
                className="w-full px-3 py-2 rounded-2xl text-sm text-gray-800 bg-white outline-none"
                style={{ border: '1.5px solid #e8f5e9' }}
              />
            </div>
          </div>

          <div className="h-8" />
        </div>
      )}
    </div>
  );
}
