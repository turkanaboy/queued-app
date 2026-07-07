import { Suspense, lazy, useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import Layout from './components/Layout'
import { acceptStoredInvite, getInviteFromUrl, getStoredInvite, rememberInvite } from './lib/invites'
import { clearStoredPartyInvite, getPartyInviteFromUrl, getStoredPartyInvite, joinParty, rememberPartyInvite } from './lib/parties'

const LoginPage = lazy(() => import('./pages/LoginPage'))
const SetupPage = lazy(() => import('./pages/SetupPage'))
const FriendsPage = lazy(() => import('./pages/FriendsPage'))
const SharedListPage = lazy(() => import('./pages/SharedListPage'))
const AddRecommendationPage = lazy(() => import('./pages/AddRecommendationPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const CollectionPage = lazy(() => import('./pages/CollectionPage'))
const QueuedUpPage = lazy(() => import('./pages/QueuedUpPage'))
const TriviaChallengePage = lazy(() => import('./pages/TriviaChallengePage'))
const PartiesPage = lazy(() => import('./pages/PartiesPage'))
const PartyDetailPage = lazy(() => import('./pages/PartyDetailPage'))

function LoadingScreen() {
  return <div className="flex items-center justify-center min-h-screen text-gray-400">Loading…</div>
}

function RequireAuth({ children }) {
  const { session, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!session) return <Navigate to="/login" replace />
  return children
}

function RequireUsername({ children }) {
  const { profile, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!profile?.username) return <Navigate to="/setup" replace />
  return children
}

function InviteHandler() {
  const { session, profile, loading } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const acceptingRef = useRef(false)
  const joiningPartyRef = useRef(false)
  const attemptedPartyTokens = useRef(new Set())

  useEffect(() => {
    const invite = getInviteFromUrl(location.search)
    if (invite) rememberInvite(invite)
    const partyInvite = getPartyInviteFromUrl(location.search)
    if (partyInvite) rememberPartyInvite(partyInvite)
  }, [location.search])

  useEffect(() => {
    if (loading || acceptingRef.current || !session || !profile?.username || !getStoredInvite()) return

    acceptingRef.current = true
    acceptStoredInvite()
      .then(accepted => {
        if (accepted && profile?.username && location.pathname !== '/friends') navigate('/friends', { replace: true })
      })
      .catch(() => {})
      .finally(() => { acceptingRef.current = false })
  }, [loading, session, profile, location.pathname, navigate])

  useEffect(() => {
    if (loading || joiningPartyRef.current || !session || !profile?.username || !getStoredPartyInvite()) return

    const token = getStoredPartyInvite()
    // Try each token at most once per session so a failure doesn't loop, but
    // keep it in storage on failure so a transient error can retry next launch.
    if (attemptedPartyTokens.current.has(token)) return
    attemptedPartyTokens.current.add(token)
    joiningPartyRef.current = true
    joinParty(token)
      .then(partyId => {
        clearStoredPartyInvite()
        navigate(`/parties/${partyId}`, { replace: true })
      })
      .catch(() => {
        navigate('/parties', { replace: true })
      })
      .finally(() => { joiningPartyRef.current = false })
  }, [loading, session, profile, navigate])

  return null
}

function AppRoutes() {
  return (
    <BrowserRouter>
      <InviteHandler />
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route path="/setup" element={
            <RequireAuth>
              <SetupPage />
            </RequireAuth>
          } />

          <Route element={
            <RequireAuth>
              <RequireUsername>
                <Layout />
              </RequireUsername>
            </RequireAuth>
          }>
            <Route index element={<Navigate to="/friends" replace />} />
            <Route path="/friends" element={<FriendsPage />} />
            <Route path="/list/:friendId" element={<SharedListPage />} />
            <Route path="/add" element={<AddRecommendationPage />} />
            <Route path="/queued" element={<QueuedUpPage />} />
            <Route path="/collection" element={<CollectionPage />} />
            <Route path="/profile/:userId?" element={<ProfilePage />} />
            <Route path="/trivia/:challengeId" element={<TriviaChallengePage />} />
            <Route path="/parties" element={<PartiesPage />} />
            <Route path="/parties/:partyId" element={<PartyDetailPage />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
