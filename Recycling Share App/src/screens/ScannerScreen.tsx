import { useState } from 'react';
import { materials } from '../moreData';

type ScanState = 'idle' | 'scanning' | 'result';

export default function ScannerScreen({ onBack }: { onBack: () => void }) {
  const [state, setState] = useState<ScanState>('idle');
  const [result, setResult] = useState<typeof materials[0] | null>(null);

  const handleScan = () => {
    setState('scanning');
    setTimeout(() => {
      setState('result');
      setResult(materials[Math.floor(Math.random() * materials.length)]);
    }, 2000);
  };

  return (
    <div className="h-full flex flex-col" style={{ background: '#000' }}>
      {/* Viewfinder */}
      <div className="flex-1 relative overflow-hidden">
        {/* Fake camera feed */}
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, #1a2e1a 0%, #000 100%)' }}>
          {/* Grid lines */}
          <div className="absolute inset-0 opacity-20">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="absolute border-white/20" style={{ left: `${(i + 1) * 20}%`, top: 0, bottom: 0, borderLeftWidth: 1 }} />
            ))}
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="absolute border-white/20" style={{ top: `${(i + 1) * 14.3}%`, left: 0, right: 0, borderTopWidth: 1 }} />
            ))}
          </div>

          {/* Scanning animation */}
          {state === 'scanning' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-48 h-48 relative">
                <div className="absolute inset-0 border-2 border-green-400 rounded-2xl animate-pulse" />
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-green-400 animate-bounce" style={{ animation: 'slideDown 1s ease-in-out infinite' }} />
              </div>
            </div>
          )}

          {/* Scan frame (idle) */}
          {state === 'idle' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-52 h-52 relative">
                {/* Corners */}
                {[['top-0 left-0', 'border-t-2 border-l-2'], ['top-0 right-0', 'border-t-2 border-r-2'], ['bottom-0 left-0', 'border-b-2 border-l-2'], ['bottom-0 right-0', 'border-b-2 border-r-2']].map(([pos, border]) => (
                  <div key={pos} className={`absolute w-8 h-8 ${pos} ${border} border-green-400 rounded-sm`} />
                ))}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl mb-2">♻️</span>
                  <p className="text-white/60 text-xs text-center">Đưa sản phẩm vào khung</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-12 pb-4" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)' }}>
          <button onClick={onBack} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }}>
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <h1 className="text-white font-bold text-lg" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>📸 Nhận Diện Vật Liệu</h1>
          <button className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }}>
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="white" strokeWidth={1.8} strokeLinecap="round"><path d="M9 2H7a2 2 0 00-2 2v2M9 22H7a2 2 0 01-2-2v-2M15 2h2a2 2 0 012 2v2M15 22h2a2 2 0 002-2v-2" /></svg>
          </button>
        </div>

        {/* Result overlay */}
        {state === 'result' && result && (
          <div className="absolute inset-0 flex flex-col justify-end" style={{ background: 'rgba(0,0,0,0.5)' }}>
            <div className="bg-white rounded-t-3xl p-5 fade-in">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-4xl" style={{ background: result.bgColor }}>{result.icon}</div>
                <div>
                  <p className="text-xs font-bold text-green-600 mb-1">✅ Đã nhận diện</p>
                  <h3 className="text-lg font-bold text-gray-900" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>{result.name}</h3>
                  {result.code && <p className="text-xs text-gray-400">Ký hiệu: {result.code}</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="p-3 rounded-2xl" style={{ background: '#f0fdf4' }}>
                  <p className="text-[10px] text-gray-400 mb-0.5">Tái chế được?</p>
                  <p className="text-sm font-bold" style={{ color: result.recyclable ? '#16a34a' : '#dc2626' }}>
                    {result.recyclable ? '✓ Có thể tái chế' : '✕ Không tái chế'}
                  </p>
                </div>
                <div className="p-3 rounded-2xl" style={{ background: '#fef3c7' }}>
                  <p className="text-[10px] text-gray-400 mb-0.5">Tỉ lệ tái chế</p>
                  <p className="text-sm font-bold" style={{ color: '#92400e' }}>{result.recyclingRate}</p>
                </div>
              </div>
              <p className="text-xs text-gray-500 mb-4 leading-relaxed">{result.ecoFact}</p>
              <div className="flex gap-3">
                <button onClick={() => setState('idle')} className="flex-1 py-3 rounded-xl text-sm font-semibold" style={{ background: '#f0fdf4', color: '#2d6a4f', border: '1px solid #bbf7d0' }}>
                  Quét lại
                </button>
                <button className="flex-1 py-3 rounded-xl text-sm font-semibold text-white" style={{ background: 'linear-gradient(135deg, #2d6a4f, #52b788)' }}>
                  Xem hướng dẫn
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom controls */}
      {state !== 'result' && (
        <div className="px-6 py-6 flex flex-col items-center gap-4" style={{ background: 'rgba(0,0,0,0.8)' }}>
          <p className="text-white/50 text-xs text-center">Quét QR hoặc chụp ảnh để nhận diện vật liệu tái chế</p>
          <div className="flex items-center gap-8">
            <button className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.1)' }}>
              <span className="text-xl">🖼️</span>
            </button>
            <button
              onClick={handleScan}
              disabled={state === 'scanning'}
              className="w-20 h-20 rounded-full flex items-center justify-center transition-all active:scale-95 disabled:opacity-70"
              style={{ background: state === 'scanning' ? 'rgba(52,183,120,0.5)' : 'linear-gradient(135deg, #2d6a4f, #52b788)', boxShadow: '0 0 0 4px rgba(52,183,120,0.2)' }}
            >
              {state === 'scanning' ? (
                <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full" style={{ animation: 'spin 0.8s linear infinite' }} />
              ) : (
                <span className="text-3xl">📷</span>
              )}
            </button>
            <button className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.1)' }}>
              <span className="text-xl">💡</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
