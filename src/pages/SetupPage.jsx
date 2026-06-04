import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { PLATFORMS, platformInitials } from '../lib/platforms'

const GENRES = ['Action', 'Comedy', 'Drama', 'Horror', 'Sci-Fi', 'Romance', 'Thriller', 'Documentary', 'Animation', 'Fantasy']

const WATCHING_STYLES = [
  { value: 'solo',     label: 'Solo viewer',   emoji: '🧑' },
  { value: 'partner',  label: 'With someone',  emoji: '💑' },
  { value: 'family',   label: 'Family nights', emoji: '👨‍👩‍👧' },
  { value: 'flexible', label: 'Whatever mood', emoji: '🎲' },
]

export default function SetupPage() {
  const { session, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [checking, setChecking] = useState(false)
  const [available, setAvailable] = useState(null)
  const [selectedPlatforms, setSelectedPlatforms] = useState([])
  const [selectedGenres, setSelectedGenres] = useState([])
  const [watchingStyle, setWatchingStyle] = useState(null)
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

  function toggleGenre(g) {
    setSelectedGenres(prev =>
      prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]
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
      favorite_genres: selectedGenres,
      watching_style: watchingStyle,
    })
    if (error) { setError(error.message); setLoading(false); return }
    await refreshProfile()

    // Fire bot recommendations in the background — bot friendship is now also
    // created by DB trigger, so this is belt-and-suspenders for the recs.
    const token = (await supabase.auth.getSession()).data.session?.access_token
    fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bot-recommendations`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ user_id: session.user.id }),
      }
    ).catch(() => {})

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

          {/* Favorite genres */}
          <div>
            <label className="block text-white/70 text-xs font-semibold uppercase tracking-wider mb-1">
              Favorite genres
            </label>
            <p className="text-white/40 text-xs mb-3">Pick as many as you like</p>
            <div className="flex flex-wrap gap-2">
              {GENRES.map(g => {
                const active = selectedGenres.includes(g)
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => toggleGenre(g)}
                    className="btn-press text-xs font-bold px-3 py-1.5 rounded-full border transition-all"
                    style={{
                      background: active ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)',
                      border: active ? '1px solid rgba(255,255,255,0.6)' : '1px solid rgba(255,255,255,0.2)',
                      color: active ? 'white' : 'rgba(255,255,255,0.6)',
                    }}
                  >
                    {active && '✓ '}{g}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Watching style */}
          <div>
            <label className="block text-white/70 text-xs font-semibold uppercase tracking-wider mb-3">
              How do you usually watch?
            </label>
            <div className="grid grid-cols-2 gap-2">
              {WATCHING_STYLES.map(s => {
                const active = watchingStyle === s.value
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setWatchingStyle(active ? null : s.value)}
                    className="btn-press flex items-center gap-2 px-3 py-2.5 rounded-2xl border text-left transition-all"
                    style={{
                      background: active ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)',
                      border: active ? '1px solid rgba(255,255,255,0.5)' : '1px solid rgba(255,255,255,0.15)',
                    }}
                  >
                    <span className="text-base">{s.emoji}</span>
                    <span className="text-xs font-semibold text-white">{s.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {error && <p className="text-rose-300 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading || !available || !usernameValid}
            className="btn-press w-full py-3.5 rounded-2xl font-bold text-sm text-[#040C21] shadow-lg disabled:opacity-40"
            style={{ background: 'white' }}
          >
            {loading ? 'Saving…' : "Let's go 🚀"}
          </button>
        </form>
      </div>
    </div>
  )
}
