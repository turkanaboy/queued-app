import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

export default function SetupPage() {
  const { session, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [checking, setChecking] = useState(false)
  const [available, setAvailable] = useState(null)
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

  async function handleSubmit(e) {
    e.preventDefault()
    if (!available) return
    setLoading(true)
    setError('')
    const { error } = await supabase
      .from('users')
      .update({ username, display_name: displayName || username })
      .eq('id', session.user.id)
    if (error) { setError(error.message); setLoading(false); return }
    await refreshProfile()
    navigate('/friends')
  }

  const usernameValid = /^[a-z0-9_]{3,20}$/.test(username)

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Set up your profile</h1>
          <p className="text-gray-500 text-sm mt-1">Choose a username to get started</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={username}
                  onChange={e => checkUsername(e.target.value.toLowerCase())}
                  placeholder="yourhandle"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {username.length >= 3 && (
                  <span className="absolute right-3 top-2.5 text-sm">
                    {checking ? '…' : available ? '✓' : '✗'}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-1">3–20 chars, letters/numbers/underscores</p>
              {username && !usernameValid && (
                <p className="text-xs text-red-500 mt-1">Invalid format</p>
              )}
              {available === false && (
                <p className="text-xs text-red-500 mt-1">Username taken</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Display name <span className="text-gray-400">(optional)</span></label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Your Name"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading || !available || !usernameValid}
              className="w-full bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Saving…' : 'Continue'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
