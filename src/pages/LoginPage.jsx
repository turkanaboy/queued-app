import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { getInviteFromUrl, rememberInvite } from '../lib/invites'
import { buildAuthRedirectUrl, isNativeApp } from '../lib/nativeAuth'

export default function LoginPage() {
  const navigate = useNavigate()
  const { session, profile, loading: authLoading } = useAuth()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (authLoading || !session) return
    navigate(profile?.username ? '/friends' : '/setup', { replace: true })
  }, [authLoading, session, profile, navigate])

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const invite = getInviteFromUrl()
    if (invite) rememberInvite(invite)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: buildAuthRedirectUrl(invite) },
    })
    if (error) setError(error.message)
    else setSent(true)
    setLoading(false)
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 py-12">
      {/* Logo */}
      <div className="anim-scale mb-10 text-center">
        <div className="w-20 h-20 rounded-[28px] mx-auto mb-4 flex items-center justify-center shadow-2xl"
          style={{ background: 'rgba(255,255,255,0.25)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.4)' }}>
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <rect x="6" y="10" width="28" height="4" rx="2" fill="white"/>
            <rect x="6" y="18" width="20" height="4" rx="2" fill="white" opacity="0.7"/>
            <rect x="6" y="26" width="24" height="4" rx="2" fill="white" opacity="0.5"/>
          </svg>
        </div>
        <h1 className="text-4xl font-extrabold text-white tracking-tight">Queued</h1>
        <p className="text-white/60 mt-1 text-sm font-medium">Share what's worth your time.</p>
      </div>

      {/* Card */}
      <div className="glass w-full max-w-sm rounded-[28px] p-7 anim-up shadow-2xl">
        {sent ? (
          <div className="text-center py-4">
            <div className="text-5xl mb-4">📬</div>
            <p className="text-xl font-bold text-white">Check your inbox</p>
            <p className="text-white/60 mt-2 text-sm">{isNativeApp() ? 'Open the magic link on this device for' : 'We sent a magic link to'}</p>
            <p className="text-white font-semibold mt-1">{email}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-white/70 text-xs font-semibold uppercase tracking-wider mb-2">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="input-glass"
              />
            </div>
            {error && <p className="text-rose-300 text-sm font-medium">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="btn-press w-full py-3.5 rounded-2xl font-bold text-sm text-[#040C21] shadow-lg disabled:opacity-50 transition-all"
              style={{ background: 'white' }}
            >
              {loading ? 'Sending...' : 'Send magic link'}
            </button>
          </form>
        )}
      </div>

      <p className="text-white/30 text-xs mt-8">No password needed. Ever.</p>
    </div>
  )
}
