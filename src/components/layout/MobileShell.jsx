import { Compass, Flame, Heart, MessageCircle, User } from 'lucide-react';

export default function MobileShell({
  activeTab,
  onChangeTab,
  unreadBadgeCount = 0,
  likesBadgeCount = 0,
  themeMood = null,
  children,
}) {
  const isSwipeDark = activeTab === 'swipe';

  const navItems = [
    { id: 'swipe', label: 'Swipe', icon: Flame },
    { id: 'explore', label: 'Explorar', icon: Compass },
    { id: 'likes', label: 'Likes', icon: Heart, badge: likesBadgeCount },
    { id: 'chat', label: 'Chat', icon: MessageCircle, badge: unreadBadgeCount },
    { id: 'profile', label: 'Perfil', icon: User },
  ];

  const outerSwipeStyle =
    isSwipeDark && themeMood?.backdropStyle
      ? { background: themeMood.backdropStyle }
      : undefined;

  const navSwipeStyle = isSwipeDark
    ? {
        backgroundColor: themeMood?.navBg || '#14060D',
        borderColor: themeMood?.navBorder || 'rgba(255, 46, 84, 0.2)',
      }
    : undefined;

  return (
    <div
      style={outerSwipeStyle}
      className={`h-[100dvh] w-screen overflow-hidden overscroll-none flex justify-center transition-colors duration-500 ${
        isSwipeDark ? 'bg-[#16060E] text-white' : 'bg-[#F4F4F6] text-zinc-900'
      }`}
    >
      <div
        className={`w-full max-w-md h-[100dvh] flex flex-col overflow-hidden relative sm:border-x ${
          isSwipeDark
            ? 'bg-transparent sm:border-white/10'
            : 'bg-[#F4F4F6] sm:border-zinc-200/80'
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

        {/* BottomNav Fixed (5 Tabs with Dynamic Theme) */}
        <nav
          style={navSwipeStyle}
          className={`shrink-0 z-30 border-t px-2 pt-1.5 pb-2 pb-safe transition-colors duration-500 ${
            isSwipeDark
              ? 'bg-[#14060D] border-rose-500/20'
              : 'bg-[#FFFFFF] border-zinc-200/70'
          }`}
        >
          <div className="grid grid-cols-5 items-center">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;

              const colorClass = isSwipeDark
                ? active
                  ? 'text-white'
                  : 'text-zinc-500 hover:text-zinc-300'
                : active
                ? 'text-zinc-900'
                : 'text-zinc-400 hover:text-zinc-700';

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onChangeTab(item.id)}
                  className={`relative flex flex-col items-center justify-center py-1.5 transition-colors ${colorClass}`}
                >
                  <div className="relative">
                    <Icon
                      className={`w-6 h-6 transition-transform ${
                        active ? 'stroke-[2.5] scale-105' : 'stroke-[1.9]'
                      } ${
                        active && item.id === 'swipe' && !isSwipeDark
                          ? 'text-[#FF2E54]'
                          : ''
                      }`}
                    />
                    {item.badge > 0 && (
                      <span className="absolute -top-1 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-[#FF2E54] text-[10px] font-bold text-white flex items-center justify-center">
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-[10px] mt-1 tracking-tight ${
                      active ? 'font-bold' : 'font-medium'
                    }`}
                  >
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
