import { Coins, Compass, Flame, Gem, Heart, MessageCircle, ShieldCheck, User, Zap } from 'lucide-react';
import { getPrimaryPhoto, isBoostActive } from '../../utils/formatters';

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
    { id: 'discover', label: 'Tarjetas', icon: Flame },
    { id: 'home', label: 'Explorar', icon: Compass },
    { id: 'chat', label: 'Mensajes', icon: MessageCircle, badge: unreadBadgeCount },
    { id: 'profile', label: 'Mi Perfil', icon: User },
  ];

  return (
    <div className="min-h-screen bg-luxury-mesh flex justify-center">
      <div className="w-full max-w-lg min-h-screen flex flex-col bg-[#FAF7F5]/90 sm:bg-white/75 sm:backdrop-blur-2xl sm:border-x sm:border-rose-100/80 relative shadow-soft">
        {/* Top Header */}
        <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-xl border-b border-rose-100/80 px-4 py-2.5 pt-safe flex items-center justify-between gap-2 shadow-[0_2px_15px_-3px_rgba(15,23,42,0.04)]">
          <button
            type="button"
            onClick={() => onChangeTab('discover')}
            className="flex items-center gap-2.5 min-w-0 text-left group"
          >
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-brand-500 via-rose-500 to-amber-400 flex items-center justify-center shrink-0 shadow-md shadow-brand-500/20 group-hover:scale-105 transition">
              <Heart className="w-4 h-4 text-white fill-white" />
            </div>
            <div className="truncate">
              <p className="font-display text-base font-extrabold tracking-tight text-slate-900 leading-none">
                Conoscamosnos
              </p>
              <p className="text-[11px] font-medium text-slate-500 truncate mt-0.5 flex items-center gap-1">
                <span>{userProfile?.country?.flag}</span>
                <span className="truncate">{userProfile?.city || userProfile?.country?.name}</span>
              </p>
            </div>
          </button>

          <div className="flex items-center gap-1.5 shrink-0">
            {userProfile?.role === 'admin' && (
              <button
                type="button"
                onClick={onOpenAdmin}
                className="p-2 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 hover:bg-indigo-100 transition"
                title="Panel Super Admin"
              >
                <ShieldCheck className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={onOpenBoost}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 border transition shadow-sm ${
                boosted
                  ? 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-300 text-amber-800'
                  : 'bg-white border-slate-200/90 text-slate-700 hover:border-amber-300 hover:bg-amber-50/40'
              }`}
              title="Boost VIP"
            >
              <Zap className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
              <span className="hidden xs:inline">{boosted ? 'VIP' : 'Boost'}</span>
            </button>

            <button
              type="button"
              onClick={onOpenWithdrawals}
              className="px-2.5 py-1.5 rounded-xl bg-sky-50 border border-sky-200/80 text-sky-800 text-xs font-bold flex items-center gap-1 hover:bg-sky-100/70 transition shadow-sm"
              title="Mis Diamantes y Retiros USD"
            >
              <Gem className="w-3.5 h-3.5 text-sky-500" />
              <span>{userProfile?.earningsDiamonds || 0}</span>
            </button>

            <button
              type="button"
              onClick={onOpenCoinStore}
              className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-50 to-rose-50 border border-amber-200/90 text-amber-900 text-xs font-extrabold flex items-center gap-1 hover:brightness-95 transition shadow-sm"
              title="Tienda de Monedas"
            >
              <Coins className="w-3.5 h-3.5 text-amber-500" />
              <span>{userProfile?.coins || 0}</span>
            </button>

            <button
              type="button"
              onClick={() => onChangeTab('profile')}
              className={`ml-0.5 relative rounded-full p-0.5 transition ${
                activeTab === 'profile'
                  ? 'ring-2 ring-brand-500'
                  : 'ring-1 ring-slate-200 hover:ring-brand-300'
              }`}
              title={`Perfil activo: ${userProfile?.name}`}
            >
              <img
                src={getPrimaryPhoto(userProfile, 120)}
                alt={userProfile?.name}
                className="w-7 h-7 rounded-full object-cover"
              />
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto pb-28">{children}</main>

        {/* Floating Glassmorphic Bottom Navigation */}
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg z-30 px-3 pb-2.5 pb-safe pointer-events-none">
          <nav className="pointer-events-auto bg-white/90 backdrop-blur-2xl border border-slate-200/80 rounded-3xl px-2 py-1.5 shadow-[0_12px_36px_-4px_rgba(15,23,42,0.12)]">
            <div className="grid grid-cols-4 gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onChangeTab(item.id)}
                    className={`relative flex flex-col items-center justify-center py-2 rounded-2xl transition-all duration-200 ${
                      active
                        ? 'text-brand-600 bg-gradient-to-b from-brand-50 to-rose-50/70 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50/70'
                    }`}
                  >
                    <div className="relative">
                      <Icon className={`w-5 h-5 transition-transform ${active ? 'stroke-[2.5] scale-105' : 'stroke-[1.9]'}`} />
                      {item.badge > 0 && (
                        <span className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] px-1 rounded-full bg-gradient-to-r from-brand-500 to-rose-500 text-[10px] font-extrabold text-white flex items-center justify-center shadow-sm ring-2 ring-white">
                          {item.badge > 99 ? '99+' : item.badge}
                        </span>
                      )}
                    </div>
                    <span className={`text-[11px] mt-0.5 ${active ? 'font-extrabold text-brand-600' : 'font-semibold'}`}>
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </nav>
        </div>
      </div>
    </div>
  );
}
