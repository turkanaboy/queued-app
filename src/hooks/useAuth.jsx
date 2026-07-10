/* eslint-disable react-refresh/only-export-components */
import { useState, useEffect, createContext, useContext } from 'react'
import { supabase } from '../lib/supabase'
import { startNativeAuthListener } from '../lib/nativeAuth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function fetchProfile(userId) {
    setError('')
    // Explicit columns: the API no longer exposes users.email, so select('*') fails.
    const { data, error: profileError } = await supabase
      .from('users')
      .select('id, username, display_name, platforms, favorite_genres, created_at')
      .eq('id', userId)
      .maybeSingle()
    if (profileError) setError(profileError.message)
    setProfile(data)
    setLoading(false)
  }

  useEffect(() => {
    // getSession owns initialization — reads from localStorage synchronously.
    supabase.auth.getSession().then(({ data: { session }, error: sessionError }) => {
      if (sessionError) {
        setError(sessionError.message)
        setLoading(false)
        return
      }
      setSession(session)
      if (session) fetchProfile(session.user.id)
      else setLoading(false)
    })

    // onAuthStateChange handles subsequent events only.
    // We skip INITIAL_SESSION to avoid a race: it can fire null before
    // getSession has read the stored token, which would incorrectly redirect to /login.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return

      setSession(session)
      if (session) fetchProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    })

    const stopNativeAuthListener = startNativeAuthListener(() => {
      supabase.auth.getSession().then(({ data: { session }, error: sessionError }) => {
        if (sessionError) {
          setError(sessionError.message)
          setLoading(false)
          return
        }
        setSession(session)
        if (session) fetchProfile(session.user.id)
      })
    }, nativeError => setError(nativeError.message || 'Unable to complete sign in.'))

    return () => {
      stopNativeAuthListener()
      subscription.unsubscribe()
    }
  }, [])

  async function refreshProfile() {
    if (session) await fetchProfile(session.user.id)
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, error, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
