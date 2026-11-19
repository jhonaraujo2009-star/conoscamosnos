import { Compass, Flame, Heart, MessageCircle, Star, User } from 'lucide-react';

export default function MobileShell({
  activeTab,
  onChangeTab,
  unreadBadgeCount = 0,
  likesBadgeCount = 0,
  superLikesBadgeCount = 0,
  themeMood = null,
  children,
}) {
  const isSwipeDark = activeTab === 'swipe';

  const navItems = [
    { id: 'swipe', label: 'Descubrir', icon: Flame },
    { id: 'explore', label: 'Explorar', icon: Compass },
    { id: 'likes', label: 'Likes', icon: Heart, badge: likesBadgeCount },
    { id: 'chat', label: 'Chats', icon: MessageCircle, badge: unreadBadgeCount },
    { id: 'profile', label: 'Perfil', icon: User },
  ];

  const outerSwipeStyle =
    isSwipeDark && themeMood?.backdropStyle
      ? { background: themeMood.backdropStyle }
      : undefined;

  const navSwipeStyle = isSwipeDark
    ? {
        backgroundColor: themeMood?.navBg || '#12050B',
        borderColor: themeMood?.navBorder || 'rgba(255, 255, 255, 0.08)',
      }
    : undefined;

  return (
    <div
      style={outerSwipeStyle}
      className={`h-[100dvh] w-screen overflow-hidden overscroll-none flex justify-center transition-colors duration-500 ${
        isSwipeDark ? 'bg-[#12050B] text-white' : 'bg-[#FAF7F9] text-zinc-900'
      }`}
    >
      <div
        className={`w-full max-w-md h-[100dvh] flex flex-col overflow-hidden relative sm:border-x ${
          isSwipeDark
            ? 'bg-transparent sm:border-white/10'
            : 'bg-[#FAF7F9] sm:border-zinc-200/80'
        }`}
      >
        {/* Main Viewport Content */}
        <main
          className={`flex-1 min-h-0 flex flex-col ${
            isSwipeDark ? 'overflow-hidden' : 'overflow-y-auto no-scrollbar'
          }`}
        >
          {children}
        </main>

        {/* BottomNav Minimalista (5 Pestañas: Descubrir, Explorar, Likes, Chats, Perfil) */}
        <nav
          style={navSwipeStyle}
          className={`shrink-0 z-30 border-t px-1.5 pt-1.5 pb-2 pb-safe transition-colors duration-500 ${
            isSwipeDark
              ? 'bg-[#12050B]/92 border-white/[0.09] backdrop-blur-2xl'
              : 'bg-white/95 border-zinc-200/70 backdrop-blur-2xl'
          }`}
        >
          <div className="grid grid-cols-5 items-center">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              const isWarmAccent = item.id === 'swipe' || item.id === 'likes';

              const colorClass = active
                ? isWarmAccent
                  ? 'text-[#FF2E54]'
                  : isSwipeDark
                  ? 'text-white'
                  : 'text-zinc-900'
                : isSwipeDark
                ? 'text-zinc-500 hover:text-zinc-300'
                : 'text-zinc-400 hover:text-zinc-700';

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onChangeTab(item.id)}
                  className={`relative flex flex-col items-center justify-center py-1 transition-colors ${colorClass}`}
                >
                  <div className="relative flex items-center justify-center">
                    <Icon
                      className={`w-[23px] h-[23px] transition-transform duration-150 ${
                        active ? 'stroke-[2.4] scale-110' : 'stroke-[1.85]'
                      } ${
                        active && item.id === 'swipe'
                          ? 'fill-[#FF2E54]/20 drop-shadow-[0_0_8px_rgba(255,46,84,0.45)]'
                          : active && item.id === 'likes'
                          ? 'fill-[#FF2E54]/15 drop-shadow-[0_0_8px_rgba(255,46,84,0.35)]'
                          : ''
                      }`}
                    />
                    {(() => {
                      const isSuperPriority = item.id === 'likes' && superLikesBadgeCount > 0;
                      const displayCount = isSuperPriority
                        ? Math.max(item.badge || 0, superLikesBadgeCount)
                        : item.badge || 0;
                      if (displayCount <= 0) return null;

                      if (isSuperPriority) {
                        return (
                          <span
                            className={`absolute -top-2 -right-3.5 min-w-[24px] h-[19px] px-1.5 rounded-full bg-gradient-to-r from-sky-500 via-blue-500 to-amber-400 text-[9.5px] font-black text-white inline-flex items-center justify-center gap-0.5 shadow-[0_3px_12px_rgba(56,189,248,0.65)] ring-2 animate-pulse ${
                              isSwipeDark ? 'ring-[#12050B]' : 'ring-white'
                            }`}
                          >
                            <Star className="w-2.5 h-2.5 fill-amber-200 text-amber-200 shrink-0" />
                            <span>{displayCount > 99 ? '99+' : displayCount}</span>
                          </span>
                        );
                      }

                      return (
                        <span
                          className={`absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] px-1 rounded-full bg-gradient-to-r from-[#FF2E54] to-rose-500 text-[9.5px] font-black text-white flex items-center justify-center shadow-[0_2px_8px_rgba(255,46,84,0.55)] ring-2 ${
                            isSwipeDark ? 'ring-[#12050B]' : 'ring-white'
                          }`}
                        >
                          {displayCount > 99 ? '99+' : displayCount}
                        </span>
                      );
                    })()}
                  </div>
                  <span
                    className={`text-[10px] mt-1 tracking-tight ${
                      active ? 'font-extrabold' : 'font-medium'
                    }`}
                  >
                    {item.label}
                  </span>
                  <span
                    className={`mt-0.5 h-[3px] rounded-full transition-all duration-200 ${
                      active
                        ? isWarmAccent
                          ? 'w-4 bg-[#FF2E54] shadow-[0_0_8px_rgba(255,46,84,0.8)]'
                          : isSwipeDark
                          ? 'w-4 bg-white shadow-[0_0_8px_rgba(255,255,255,0.65)]'
                          : 'w-4 bg-zinc-900'
                        : 'w-0 bg-transparent'
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
