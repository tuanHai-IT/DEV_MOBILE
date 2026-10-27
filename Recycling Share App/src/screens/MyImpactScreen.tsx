import { impactStats } from '../moreData';
import { users, CURRENT_USER_ID } from '../data';

export default function MyImpactScreen({ onBack }: { onBack: () => void }) {
  const user = users.find(u => u.id === CURRENT_USER_ID)!;
  const totalKg = impactStats.reduce((s, m) => s + m.kg, 0);
  const totalCo2 = impactStats.reduce((s, m) => s + m.co2, 0);
  const totalTrees = impactStats.reduce((s, m) => s + m.trees, 0);
  const totalWater = impactStats.reduce((s, m) => s + m.water, 0);
  const maxKg = Math.max(...impactStats.map(m => m.kg));

  return (
    <div className="h-full flex flex-col" style={{ background: '#f0fdf4' }}>
      <div className="bg-white px-4 pt-12 pb-3 flex items-center gap-3" style={{ borderBottom: '1px solid #e8f5e9' }}>
        <button onClick={onBack} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#f0fdf4' }}>
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="#1b4332" strokeWidth={2} strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <h1 className="text-xl font-bold" style={{ color: '#1b4332', fontFamily: 'Fraunces, Georgia, serif' }}>Tác Động Của Tôi 🌍</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Hero card */}
        <div className="rounded-3xl p-5 text-white" style={{ background: 'linear-gradient(135deg, #1b4332, #2d6a4f, #52b788)' }}>
          <div className="flex items-center gap-3 mb-4">
            <img src={user.avatar} alt={user.name} className="w-12 h-12 rounded-2xl object-cover border-2 border-white/30" />
            <div>
              <p className="font-bold">{user.name}</p>
              <p className="text-green-200 text-xs">Eco Warrior 🏆</p>
            </div>
          </div>
          <div className="text-center py-2">
            <p className="text-5xl font-bold">{totalKg}<span className="text-2xl text-green-200">kg</span></p>
            <p className="text-green-200 text-sm mt-1">tổng rác tái chế (7 tháng)</p>
          </div>
          <div className="mt-4 pt-4 grid grid-cols-3 gap-2" style={{ borderTop: '1px solid rgba(255,255,255,0.2)' }}>
            {[['🌿', `${totalCo2}kg`, 'CO₂ tiết kiệm'], ['🌳', totalTrees.toFixed(1), 'Cây tương đương'], ['💧', `${totalWater}L`, 'Nước tiết kiệm']].map(([icon, val, label]) => (
              <div key={label} className="text-center">
                <p className="text-base">{icon}</p>
                <p className="text-white font-bold text-sm">{val}</p>
                <p className="text-green-300 text-[10px]">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Monthly chart */}
        <div className="bg-white rounded-3xl p-4" style={{ border: '1px solid #e8f5e9' }}>
          <p className="font-semibold text-gray-800 mb-1 text-sm">📊 Rác Tái Chế Theo Tháng</p>
          <p className="text-xs text-gray-400 mb-4">Tháng 4 – Tháng 10/2026 (kg)</p>
          <div className="flex items-end gap-2 h-32">
            {impactStats.map(m => (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[9px] text-gray-500 font-medium">{m.kg}</span>
                <div className="w-full rounded-t-xl transition-all" style={{ height: `${(m.kg / maxKg) * 100}%`, background: m.month === 'T10' ? 'linear-gradient(to top, #1b4332, #52b788)' : '#bbf7d0', minHeight: 8 }} />
                <span className="text-[10px] text-gray-400">{m.month}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Category breakdown */}
        <div className="bg-white rounded-3xl p-4" style={{ border: '1px solid #e8f5e9' }}>
          <p className="font-semibold text-gray-800 mb-3 text-sm">♻️ Loại Rác Tái Chế</p>
          {[
            { type: 'Nhựa', pct: 45, color: '#3b82f6', icon: '🧴' },
            { type: 'Thủy tinh', pct: 22, color: '#06b6d4', icon: '🍾' },
            { type: 'Giấy/Carton', pct: 18, color: '#f59e0b', icon: '📦' },
            { type: 'Kim loại', pct: 10, color: '#6b7280', icon: '🥫' },
            { type: 'Khác', pct: 5, color: '#10b981', icon: '🔄' },
          ].map(({ type, pct, color, icon }) => (
            <div key={type} className="mb-2.5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-600 flex items-center gap-1.5"><span>{icon}</span>{type}</span>
                <span className="text-xs font-semibold" style={{ color }}>{pct}%</span>
              </div>
              <div className="h-2 rounded-full" style={{ background: '#f0fdf4' }}>
                <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: color }} />
              </div>
            </div>
          ))}
        </div>

        {/* Fun facts */}
        <div className="bg-white rounded-3xl p-4" style={{ border: '1px solid #e8f5e9' }}>
          <p className="font-semibold text-gray-800 mb-3 text-sm">🌟 Bạn Đã Làm Được Điều Này!</p>
          {[
            `🌳 Tương đương trồng ${totalTrees.toFixed(0)} cây xanh`,
            `🚗 Tiết kiệm ${(totalCo2 * 0.4).toFixed(0)}km lái xe ô tô`,
            `💧 Tiết kiệm ${totalWater}L nước sạch`,
            `⚡ Tiết kiệm ${(totalKg * 5.8).toFixed(0)} kWh điện năng`,
          ].map(fact => (
            <div key={fact} className="flex items-start gap-2 mb-2 p-3 rounded-2xl" style={{ background: '#f0fdf4' }}>
              <p className="text-xs text-gray-700">{fact}</p>
            </div>
          ))}
        </div>

        <div className="h-4" />
      </div>
    </div>
  );
}
