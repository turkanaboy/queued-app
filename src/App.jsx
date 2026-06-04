import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import LoginPage from './pages/LoginPage'
import SetupPage from './pages/SetupPage'
import FriendsPage from './pages/FriendsPage'
import SharedListPage from './pages/SharedListPage'
import AddRecommendationPage from './pages/AddRecommendationPage'
import ProfilePage from './pages/ProfilePage'
import CollectionPage from './pages/CollectionPage'
import Layout from './components/Layout'

function RequireAuth({ children }) {
  const { session, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center min-h-screen text-gray-400">Loading…</div>
  if (!session) return <Navigate to="/login" replace />
  return children
}

function RequireUsername({ children }) {
  const { profile, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center min-h-screen text-gray-400">Loading…</div>
  if (!profile?.username) return <Navigate to="/setup" replace />
  return children
}

function AppRoutes() {
  return (
    <BrowserRouter>
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
          <Route path="/collection" element={<CollectionPage />} />
          <Route path="/profile/:userId?" element={<ProfilePage />} />
        </Route>
      </Routes>
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
