import { Coins, Compass, Crown, Flame, Gem, MessageCircle, ShieldCheck, User, Zap } from 'lucide-react';
import { isBoostActive } from '../../utils/formatters';

export default function MobileShell({
  userProfile,
  activeTab,
  onChangeTab,
  onOpenCoinStore,
  onOpenWithdrawals,
  onOpenBoost,
  onOpenAdmin,
  unreadBadgeCount = 0,
  children,
}) {
  const boosted = isBoostActive(userProfile);

  const navItems = [
    { id: 'home', label: 'Inicio', icon: Flame },
    { id: 'discover', label: 'Descubrir', icon: Compass },
    { id: 'chat', label: 'Chats', icon: MessageCircle, badge: unreadBadgeCount },
    { id: 'profile', label: 'Perfil', icon: User },
  ];

  return (
    <div className="min-h-screen bg-slate-950 flex justify-center">
      <div className="w-full max-w-md min-h-screen flex flex-col bg-[#090d16] sm:border-x sm:border-slate-800/80 relative shadow-2xl">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 bg-[#090d16]/90 backdrop-blur-xl border-b border-slate-800/80 px-3.5 py-2.5 pt-safe flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500 via-pink-500 to-amber-400 flex items-center justify-center shrink-0 shadow shadow-brand-500/30">
              <Crown className="w-4 h-4 text-white" />
            </div>
            <div className="truncate">
              <p className="text-sm font-extrabold tracking-tight text-white leading-none">
                Conoscamosnos
              </p>
              <p className="text-[10px] text-slate-400 truncate mt-0.5">
                {userProfile?.country?.flag} {userProfile?.city || userProfile?.country?.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {userProfile?.role === 'admin' && (
              <button
                type="button"
                onClick={onOpenAdmin}
                className="p-2 rounded-xl bg-indigo-500/20 border border-indigo-400/40 text-indigo-300 hover:bg-indigo-500/30 transition"
                title="Panel Super Admin"
              >
                <ShieldCheck className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={onOpenBoost}
              className={`px-2 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 border transition ${
                boosted
                  ? 'bg-amber-500/20 border-amber-400/60 text-amber-300'
                  : 'bg-slate-900 border-slate-700 text-slate-200 hover:border-amber-400/50'
              }`}
              title="Boost VIP"
            >
              <Zap className={`w-3.5 h-3.5 ${boosted ? 'fill-amber-400 text-amber-400' : 'text-amber-400'}`} />
              <span className="hidden xs:inline">{boosted ? 'VIP' : 'Boost'}</span>
            </button>

            <button
              type="button"
              onClick={onOpenWithdrawals}
              className="px-2 py-1.5 rounded-xl bg-cyan-500/15 border border-cyan-500/35 text-cyan-200 text-xs font-bold flex items-center gap-1 hover:bg-cyan-500/25 transition"
              title="Mis Diamantes y Retiros USD"
            >
              <Gem className="w-3.5 h-3.5 text-cyan-400" />
              <span>{userProfile?.earningsDiamonds || 0}</span>
            </button>

            <button
              type="button"
              onClick={onOpenCoinStore}
              className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/25 to-brand-500/25 border border-amber-400/50 text-amber-200 text-xs font-bold flex items-center gap-1 hover:brightness-110 transition"
              title="Tienda de Monedas"
            >
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              <span>{userProfile?.coins || 0}</span>
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto pb-24">{children}</main>

        {/* Bottom Navigation */}
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-30 bg-slate-950/95 backdrop-blur-xl border-t border-slate-800/90 px-2 py-1.5 pb-safe">
          <div className="grid grid-cols-4 gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onChangeTab(item.id)}
                  className={`relative flex flex-col items-center justify-center py-2 rounded-2xl transition ${
                    active ? 'text-brand-400 bg-brand-500/10' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="relative">
                    <Icon className={`w-5 h-5 ${active ? 'stroke-[2.5]' : ''}`} />
                    {item.badge > 0 && (
                      <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-brand-500 text-[10px] font-bold text-white flex items-center justify-center">
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-semibold mt-0.5">{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
