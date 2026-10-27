import { useState } from 'react';

interface Props { url: string; onBack: () => void; }

export default function ImageViewerScreen({ url, onBack }: Props) {
  const [scale, setScale] = useState(1);

  return (
    <div className="h-full flex flex-col bg-black relative">
      {/* Controls */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 pt-14 pb-4" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)' }}>
        <button onClick={onBack} className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)' }}>
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <div className="flex gap-2">
          <button className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)' }}>
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="white" strokeWidth={1.8} strokeLinecap="round"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
          </button>
          <button className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)' }}>
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="white" strokeWidth={1.8} strokeLinecap="round"><path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m9.632 4.684a3 3 0 10-5.367 2.684 3 3 0 005.367-2.684zm0-9.316a3 3 0 10-5.368-2.684 3 3 0 005.368 2.684z" /></svg>
          </button>
        </div>
      </div>

      {/* Image */}
      <div className="flex-1 flex items-center justify-center overflow-hidden" onDoubleClick={() => setScale(s => s === 1 ? 2 : 1)}>
        <img
          src={url.replace('w=400&h=500', 'w=430&h=800')}
          alt="Full view"
          className="w-full h-full object-contain transition-transform duration-300"
          style={{ transform: `scale(${scale})`, cursor: scale > 1 ? 'zoom-out' : 'zoom-in' }}
        />
      </div>

      {/* Bottom hint */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center">
        <p className="text-white/50 text-xs">Nhấn đôi để phóng to · Vuốt xuống để đóng</p>
      </div>
    </div>
  );
}
