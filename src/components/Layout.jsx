import { useState } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import { useUnreadCount } from '../hooks/useUnreadCount'
import { RecommendationSheet } from '../pages/AddRecommendationPage'

export default function Layout() {
  const unreadCount = useUnreadCount()
  const [showRecommendSheet, setShowRecommendSheet] = useState(false)

  return (
    <div className="min-h-dvh flex flex-col">
      <main className="flex-1 overflow-y-auto pb-28">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-1/2 z-20 w-full max-w-[430px] -translate-x-1/2 px-4 pb-[calc(18px+env(safe-area-inset-bottom))] pt-2">
        <div className="flex items-center justify-between rounded-[26px] border border-[rgba(150,214,180,0.16)] bg-[rgba(4,26,18,0.9)] px-5 py-2.5 shadow-[0_18px_40px_rgba(0,0,0,0.4)] backdrop-blur-[20px]">
          <TabItem to="/friends" label="Friends" badge={unreadCount}>
            <FriendsIcon />
          </TabItem>

          <TabItem to="/queued" label="Queued">
            <ListIcon />
          </TabItem>

          <button
            type="button"
            onClick={() => setShowRecommendSheet(true)}
            className="btn-press -mt-[22px] flex h-[50px] w-[50px] items-center justify-center rounded-full border border-[rgba(216,168,74,0.36)] bg-[linear-gradient(135deg,#C96B4B,#B87333)] text-[#FFF8E8] shadow-[0_8px_22px_rgba(0,0,0,0.35)]"
            aria-label="Add title"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </button>

          <TabItem to="/collection" label="Discover">
            <DiscoverIcon />
          </TabItem>

          <TabItem to="/profile" label="Profile">
            <ProfileIcon />
          </TabItem>
        </div>
      </nav>

      {showRecommendSheet && <RecommendationSheet onClose={() => setShowRecommendSheet(false)} />}
    </div>
  )
}

function TabItem({ to, label, badge, children }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `btn-press flex flex-col items-center gap-1 rounded-2xl px-0.5 py-0 transition-all ${
          isActive ? 'opacity-100 text-[#F4E9D1]' : 'opacity-75 text-[#F4E9D1]/75'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span className={`relative flex h-[38px] w-[38px] items-center justify-center rounded-full transition-all ${
            isActive ? 'bg-[#F4E9D1] text-[#052016]' : 'border border-[rgba(150,214,180,0.16)] bg-[rgba(6,40,28,0.7)] text-[#F4E9D1]'
          }`}>
            {children}
            {badge > 0 && (
              <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
                {badge > 9 ? '9+' : badge}
              </span>
            )}
          </span>
          <span className={`text-[9px] font-bold ${isActive ? 'text-[#F7F1E4]' : 'text-[rgba(214,240,224,0.5)]'}`}>{label}</span>
        </>
      )}
    </NavLink>
  )
}

function ListIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M8 6h13M8 12h13M8 18h13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
    </svg>
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
