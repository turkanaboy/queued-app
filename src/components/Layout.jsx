import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useUnreadCount } from '../hooks/useUnreadCount'
import { supabase } from '../lib/supabase'

export default function Layout() {
  const { profile } = useAuth()
  const unreadCount = useUnreadCount()
  const navigate = useNavigate()

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const navClass = ({ isActive }) =>
    `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? 'bg-indigo-100 text-indigo-700'
        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
    }`

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 flex items-center justify-between h-14">
          <span className="font-bold text-indigo-600 text-lg tracking-tight">Queued</span>
          <div className="flex items-center gap-1">
            <NavLink to="/friends" className={navClass}>Friends</NavLink>
            <NavLink to="/add" className={navClass}>+ Rec</NavLink>
            <NavLink to={`/profile`} className={navClass}>
              <InitialsAvatar name={profile?.display_name || profile?.username} size="sm" />
            </NavLink>
          </div>
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <span className="bg-indigo-600 text-white text-xs font-bold rounded-full px-2 py-0.5">
                {unreadCount}
              </span>
            )}
            <button onClick={handleSignOut} className="text-xs text-gray-400 hover:text-gray-600">
              Sign out
            </button>
          </div>
        </div>
      </nav>
      <main className="max-w-3xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}

export function InitialsAvatar({ name, size = 'md', className = '' }) {
  const initials = (name || '?')
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const colors = [
    'bg-indigo-500', 'bg-violet-500', 'bg-pink-500',
    'bg-teal-500', 'bg-amber-500', 'bg-rose-500',
  ]
  const color = colors[(name?.charCodeAt(0) ?? 0) % colors.length]

  const sizes = { sm: 'w-7 h-7 text-xs', md: 'w-9 h-9 text-sm', lg: 'w-14 h-14 text-xl' }

  return (
    <span className={`${sizes[size]} ${color} ${className} rounded-full flex items-center justify-center text-white font-semibold`}>
      {initials}
    </span>
  )
}
