import { useState } from 'react';
import { recyclingTips } from '../data';

const steps: Record<string, { step: string; img?: string }[]> = {
  't1': [
    { step: 'Chuẩn bị chai nhựa PET sạch (chai nước, nước ngọt). Rửa sạch bên trong và để khô.' },
    { step: 'Dùng dao hoặc kéo cắt đôi chai theo đường chéo 45° ở khoảng 2/3 chai từ đáy lên.' },
    { step: 'Dùng dùi hoặc kéo đục 2 lỗ nhỏ ở 2 bên phần thân chai để xỏ dây treo.' },
    { step: 'Đục 3-4 lỗ nhỏ ở đáy chai để thoát nước khi tưới cây.' },
    { step: 'Cho đất màu vào 2/3 chai. Trồng cây con vào. Có thể dùng sỏi hoặc đá để trang trí.' },
    { step: 'Xỏ dây thừng qua 2 lỗ đã đục, buộc chặt và treo lên tường hoặc ban công. Hoàn thành!' },
  ],
  't2': [
    { step: 'Xin lốp xe cũ từ tiệm sửa xe gần nhà — họ thường cho miễn phí!' },
    { step: 'Rửa sạch lốp xe bằng nước và xà phòng. Để khô hoàn toàn.' },
    { step: 'Dùng dao cắt 2-3 lỗ thoát nước ở phần thấp nhất (nếu dùng làm chậu cây).' },
    { step: 'Nếu làm xích đu: dùng khoan đục 2 lỗ ở 2 bên đỉnh lốp để xỏ dây thừng.' },
    { step: 'Có thể sơn màu sắc tươi vui bằng sơn chống nước. Đợi khô hoàn toàn.' },
    { step: 'Cột dây thừng chắc chắn qua 2 lỗ, buộc lên cành cây hoặc giàn thép. An toàn cho bé!' },
  ],
};

export default function RecyclingGuideDetailScreen({ tipId, onBack }: { tipId: string; onBack: () => void }) {
  const tip = recyclingTips.find(t => t.id === tipId);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(tip?.likes || 0);
  const [savedStep, setSavedStep] = useState(-1);
  const guideSteps = steps[tipId] || [{ step: 'Chuẩn bị vật liệu theo hướng dẫn.' }, { step: 'Thực hiện từng bước cẩn thận.' }, { step: 'Hoàn thiện và trang trí theo ý thích!' }];

  if (!tip) return null;

  const diffColors = { easy: '#22c55e', medium: '#f59e0b', hard: '#ef4444' };
  const diffLabels = { easy: 'Dễ', medium: 'Trung bình', hard: 'Khó' };

  return (
    <div className="h-full flex flex-col" style={{ background: '#f0fdf4' }}>
      <div className="flex-1 overflow-y-auto">
        {/* Hero */}
        <div className="relative" style={{ height: 260 }}>
          <img src={tip.image.replace('w=300&h=300', 'w=430&h=300')} alt={tip.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.7) 100%)' }} />
          <button onClick={onBack} className="absolute top-12 left-4 w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)' }}>
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <div className="absolute bottom-4 left-4 right-4">
            <div className="flex gap-2 mb-2">
              <span className="text-xs font-semibold px-2 py-1 rounded-full text-white" style={{ background: diffColors[tip.difficulty] }}>
                {diffLabels[tip.difficulty]}
              </span>
              <span className="text-xs font-semibold px-2 py-1 rounded-full text-white" style={{ background: 'rgba(255,255,255,0.2)' }}>
                ⏱ {tip.time}
              </span>
              <span className="text-xs font-semibold px-2 py-1 rounded-full text-white" style={{ background: 'rgba(255,255,255,0.2)' }}>
                {tip.material}
              </span>
            </div>
            <h1 className="text-xl font-bold text-white leading-snug" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>{tip.title}</h1>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Author + stats */}
          <div className="bg-white rounded-3xl p-4 flex items-center gap-3" style={{ border: '1px solid #e8f5e9' }}>
            <div className="flex-1">
              <p className="text-xs text-gray-400">Tác giả</p>
              <p className="font-semibold text-gray-800">{tip.author}</p>
            </div>
            <div className="flex gap-4">
              <div className="text-center">
                <p className="font-bold text-gray-900">{likeCount.toLocaleString()}</p>
                <p className="text-xs text-gray-400">thích</p>
              </div>
            </div>
            <button onClick={() => { setLiked(!liked); setLikeCount(c => liked ? c - 1 : c + 1); }} className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: liked ? '#fce7f3' : '#f0fdf4' }}>
              <span className="text-lg">{liked ? '❤️' : '🤍'}</span>
            </button>
          </div>

          {/* Description */}
          <div className="bg-white rounded-3xl p-4" style={{ border: '1px solid #e8f5e9' }}>
            <p className="font-semibold text-gray-800 mb-2 text-sm">📋 Mô tả</p>
            <p className="text-gray-600 text-sm leading-relaxed">{tip.description}</p>
          </div>

          {/* Steps */}
          <div className="bg-white rounded-3xl p-4" style={{ border: '1px solid #e8f5e9' }}>
            <p className="font-semibold text-gray-800 mb-4 text-sm">📝 Các bước thực hiện</p>
            <div className="space-y-3">
              {guideSteps.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setSavedStep(savedStep === i ? -1 : i)}
                  className="w-full flex gap-3 text-left p-3 rounded-2xl transition-all"
                  style={{ background: savedStep === i ? '#f0fdf4' : '#fafafa', border: `1.5px solid ${savedStep === i ? '#bbf7d0' : 'transparent'}` }}
                >
                  <span className="flex-none w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: savedStep === i ? '#2d6a4f' : '#d1d5db' }}>
                    {savedStep === i ? '✓' : i + 1}
                  </span>
                  <p className="text-sm text-gray-700 leading-relaxed flex-1">{s.step}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Tips */}
          <div className="rounded-3xl p-4" style={{ background: 'linear-gradient(135deg, #1b4332, #2d6a4f)', border: '1px solid #e8f5e9' }}>
            <p className="font-semibold text-green-200 mb-3 text-sm">💡 Mẹo thêm</p>
            {['Rửa sạch và làm khô vật liệu trước khi bắt đầu', 'Có thể sơn màu để sản phẩm đẹp hơn', 'Chia sẻ thành quả lên EcoShare để truyền cảm hứng!'].map(t => (
              <div key={t} className="flex gap-2 mb-2">
                <span className="text-green-400 flex-none">•</span>
                <p className="text-sm text-green-100">{t}</p>
              </div>
            ))}
          </div>

          <div className="h-4" />
        </div>
      </div>

      <div className="bg-white px-4 py-3 flex gap-3" style={{ borderTop: '1px solid #e8f5e9' }}>
        <button className="flex-1 py-3 rounded-2xl text-sm font-semibold border" style={{ borderColor: '#bbf7d0', color: '#2d6a4f' }}>
          💾 Lưu hướng dẫn
        </button>
        <button className="flex-1 py-3 rounded-2xl text-sm font-semibold text-white" style={{ background: 'linear-gradient(135deg, #2d6a4f, #52b788)' }}>
          ↗️ Chia sẻ
        </button>
      </div>
    </div>
  );
}
