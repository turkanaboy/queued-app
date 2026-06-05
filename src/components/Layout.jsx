import { Outlet, NavLink } from 'react-router-dom'
import { useUnreadCount } from '../hooks/useUnreadCount'

export default function Layout() {
  const unreadCount = useUnreadCount()

  return (
    <div className="min-h-dvh flex flex-col">
      <main className="flex-1 overflow-y-auto pb-28 px-4 pt-6">
        <Outlet />
      </main>

      {/* Bottom tab bar: Friends | Collection | [+FAB] | Profile */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] px-4 pb-6 z-20">
        <div className="glass-dark rounded-[28px] px-4 py-3 flex items-center justify-between">
          <TabItem to="/friends" label="Friends" badge={unreadCount}>
            <FriendsIcon />
          </TabItem>

          <TabItem to="/collection" label="Discover">
            <DiscoverIcon />
          </TabItem>

          {/* Center FAB */}
          <NavLink
            to="/add"
            className="btn-press btn-copper -mt-5 w-14 h-14 rounded-full flex items-center justify-center"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </NavLink>

          <TabItem to="/profile" label="Profile">
            <ProfileIcon />
          </TabItem>
        </div>
      </nav>
    </div>
  )
}

function TabItem({ to, label, badge, children }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `btn-press flex flex-col items-center gap-1 px-2 py-1 rounded-2xl transition-all ${
          isActive ? 'opacity-100 text-[#F4E9D1]' : 'opacity-75 text-[#F4E9D1]/75'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span className={`relative w-9 h-9 rounded-full flex items-center justify-center transition-all ${
            isActive ? 'scale-105 bg-[#F4E9D1] text-[#052016]' : 'bg-[#052016]/60 text-[#F4E9D1] border border-[#F4E9D1]/20'
          }`}>
            {children}
            {badge > 0 && (
              <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
                {badge > 9 ? '9+' : badge}
              </span>
            )}
          </span>
          <span className="text-[9px] font-semibold">{label}</span>
        </>
      )}
    </NavLink>
  )
}

function FriendsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

function DiscoverIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
      <polygon points="16.24,7.76 14.12,14.12 7.76,16.24 9.88,9.88" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function ProfileIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2"/>
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}


export function InitialsAvatar({ name, size = 'md', className = '' }) {
  const initials = (name || '?')
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const hues = [14, 330, 280, 200, 160, 40]
  const hue  = hues[(name?.charCodeAt(0) ?? 0) % hues.length]

  const sizes = {
    sm: { ring: 'p-[2px]', inner: 'w-8 h-8 text-xs' },
    md: { ring: 'p-[3px]', inner: 'w-10 h-10 text-sm' },
    lg: { ring: 'p-[3px]', inner: 'w-16 h-16 text-xl' },
    xl: { ring: 'p-[4px]', inner: 'w-20 h-20 text-2xl' },
  }
  const s = sizes[size] || sizes.md

  return (
    <div className={`avatar-ring ${s.ring} shrink-0 ${className}`}>
      <div className={`${s.inner} rounded-full flex items-center justify-center text-[#052016] font-bold`}
        style={{ background: `linear-gradient(135deg, hsl(${hue}, 52%, 76%), #F4E9D1)` }}>
        {initials}
      </div>
    </div>
  )
}
