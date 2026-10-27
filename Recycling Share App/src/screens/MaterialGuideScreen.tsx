import { useState } from 'react';
import { materials } from '../moreData';

export default function MaterialGuideScreen({ onBack }: { onBack: () => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const detail = materials.find(m => m.id === selected);

  return (
    <div className="h-full flex flex-col" style={{ background: '#f0fdf4' }}>
      <div className="bg-white px-4 pt-12 pb-3 flex items-center gap-3" style={{ borderBottom: '1px solid #e8f5e9' }}>
        <button onClick={selected ? () => setSelected(null) : onBack} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#f0fdf4' }}>
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="#1b4332" strokeWidth={2} strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <h1 className="flex-1 text-xl font-bold" style={{ color: '#1b4332', fontFamily: 'Fraunces, Georgia, serif' }}>
          {selected ? detail?.name : 'Cẩm Nang Vật Liệu 📚'}
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto">
        {!selected ? (
          <div className="p-4">
            <p className="text-sm text-gray-500 mb-4">Tìm hiểu cách tái chế đúng cách từng loại vật liệu</p>
            <div className="grid grid-cols-2 gap-3">
              {materials.map(m => (
                <button key={m.id} onClick={() => setSelected(m.id)} className="bg-white rounded-3xl p-4 text-left transition-all active:scale-95" style={{ border: '1px solid #e8f5e9', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl mb-3" style={{ background: m.bgColor }}>
                    {m.icon}
                  </div>
                  <p className="font-bold text-gray-800 text-sm">{m.name}</p>
                  {m.code && <p className="text-xs text-gray-400 mt-0.5">Mã: {m.code}</p>}
                  <div className="mt-2 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full" style={{ background: m.recyclable ? '#22c55e' : '#ef4444' }} />
                    <span className="text-xs font-medium" style={{ color: m.recyclable ? '#16a34a' : '#dc2626' }}>
                      {m.recyclable ? `Tái chế được (${m.recyclingRate})` : 'Không tái chế được'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : detail ? (
          <div className="p-4 space-y-4 fade-in">
            <div className="bg-white rounded-3xl p-5" style={{ border: '1px solid #e8f5e9' }}>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-4xl" style={{ background: detail.bgColor }}>{detail.icon}</div>
                <div>
                  <h2 className="font-bold text-gray-900 text-lg">{detail.name}</h2>
                  {detail.code && <p className="text-gray-400 text-xs">Ký hiệu: {detail.code}</p>}
                  <div className="flex items-center gap-1 mt-1">
                    <span className="w-2 h-2 rounded-full" style={{ background: '#22c55e' }} />
                    <span className="text-xs font-semibold" style={{ color: '#16a34a' }}>Tỉ lệ tái chế: {detail.recyclingRate}</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-2xl" style={{ background: '#f0fdf4' }}>
                  <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">Thời gian phân hủy</p>
                  <p className="text-xs font-semibold text-gray-700">{detail.processingTime}</p>
                </div>
                <div className="p-3 rounded-2xl" style={{ background: '#fef3c7' }}>
                  <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">Tái chế được</p>
                  <p className="text-xs font-semibold" style={{ color: '#92400e' }}>{detail.recyclingRate}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-4" style={{ border: '1px solid #e8f5e9' }}>
              <p className="font-semibold text-gray-800 mb-3 text-sm">📦 Đồ dùng thường gặp</p>
              <div className="flex flex-wrap gap-2">
                {detail.commonItems.map(item => (
                  <span key={item} className="px-3 py-1.5 rounded-full text-xs font-medium" style={{ background: detail.bgColor, color: detail.color }}>{item}</span>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-3xl p-4" style={{ border: '1px solid #e8f5e9' }}>
              <p className="font-semibold text-gray-800 mb-3 text-sm">💡 Cách tái chế đúng</p>
              {detail.tips.map((tip, i) => (
                <div key={i} className="flex gap-2.5 mb-2">
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white flex-none" style={{ background: detail.color }}>{i + 1}</span>
                  <p className="text-sm text-gray-600 leading-relaxed">{tip}</p>
                </div>
              ))}
            </div>

            <div className="rounded-3xl p-4" style={{ background: 'linear-gradient(135deg, #1b4332, #2d6a4f)' }}>
              <p className="text-green-300 text-xs font-bold mb-1">🌍 BẠN CÓ BIẾT?</p>
              <p className="text-white text-sm leading-relaxed">{detail.ecoFact}</p>
            </div>
            <div className="h-4" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
