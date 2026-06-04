import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { PLATFORMS, platformInitials } from '../lib/platforms'

export default function SetupPage() {
  const { session, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [checking, setChecking] = useState(false)
  const [available, setAvailable] = useState(null)
  const [selectedPlatforms, setSelectedPlatforms] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function checkUsername(val) {
    setUsername(val)
    setAvailable(null)
    if (val.length < 3) return
    setChecking(true)
    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('username', val)
      .maybeSingle()
    setAvailable(!data)
    setChecking(false)
  }

  function togglePlatform(id) {
    setSelectedPlatforms(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!available) return
    setLoading(true)
    setError('')
    const { error } = await supabase.from('users').upsert({
      id: session.user.id,
      email: session.user.email,
      username,
      display_name: displayName || username,
      platforms: selectedPlatforms,
    })
    if (error) { setError(error.message); setLoading(false); return }
    await refreshProfile()
    navigate('/friends')
  }

  const usernameValid = /^[a-z0-9_]{3,20}$/.test(username)

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 py-12">
      <div className="anim-scale mb-8 text-center">
        <h1 className="text-3xl font-extrabold text-white">Set up your profile</h1>
        <p className="text-white/60 mt-1 text-sm">Just a few things to get started</p>
      </div>

      <div className="glass w-full max-w-sm rounded-[28px] p-7 anim-up shadow-2xl space-y-5">
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Username */}
          <div>
            <label className="block text-white/70 text-xs font-semibold uppercase tracking-wider mb-2">Username</label>
            <div className="relative">
              <input
                type="text"
                required
                value={username}
                onChange={e => checkUsername(e.target.value.toLowerCase())}
                placeholder="yourhandle"
                className="input-glass pr-10"
              />
              {username.length >= 3 && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-lg">
                  {checking ? '⏳' : available ? '✅' : '❌'}
                </span>
              )}
            </div>
            <p className="text-white/40 text-xs mt-1.5">3–20 chars · letters, numbers, underscores</p>
            {username && !usernameValid && <p className="text-rose-300 text-xs mt-1">Invalid format</p>}
            {available === false && <p className="text-rose-300 text-xs mt-1">Username taken</p>}
          </div>

          {/* Display name */}
          <div>
            <label className="block text-white/70 text-xs font-semibold uppercase tracking-wider mb-2">
              Display name <span className="text-white/30 normal-case font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Your Name"
              className="input-glass"
            />
          </div>

          {/* Streaming platforms */}
          <div>
            <label className="block text-white/70 text-xs font-semibold uppercase tracking-wider mb-1">
              Your streaming platforms
            </label>
            <p className="text-white/40 text-xs mb-3">So friends know what you can watch</p>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map(p => {
                const active = selectedPlatforms.includes(p.id)
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => togglePlatform(p.id)}
                    className="btn-press text-xs font-bold px-3 py-1.5 rounded-full border transition-all"
                    style={{
                      background: active ? p.color : 'rgba(255,255,255,0.1)',
                      border: active ? `1px solid ${p.color}` : '1px solid rgba(255,255,255,0.2)',
                      color: active ? 'white' : 'rgba(255,255,255,0.6)',
                    }}
                  >
                    {active && '✓ '}{platformInitials(p.name)}
                  </button>
                )
              })}
            </div>
            {selectedPlatforms.length > 0 && (
              <p className="text-white/40 text-xs mt-2">{selectedPlatforms.length} selected</p>
            )}
          </div>

          {error && <p className="text-rose-300 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading || !available || !usernameValid}
            className="btn-press w-full py-3.5 rounded-2xl font-bold text-sm text-purple-900 shadow-lg disabled:opacity-40"
            style={{ background: 'white' }}
          >
            {loading ? 'Saving…' : "Let's go 🚀"}
          </button>
        </form>
      </div>
    </div>
  )
}
