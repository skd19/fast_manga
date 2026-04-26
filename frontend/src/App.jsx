import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/layout/Layout'

// Pages
import HomePage from './pages/HomePage'
import MangaDetailPage from './pages/MangaDetailPage'
import ChapterReadPage from './pages/ChapterReadPage'
import BrowsePage from './pages/BrowsePage'
import SearchPage from './pages/SearchPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ProfilePage from './pages/ProfilePage'
import PublicProfilePage from './pages/PublicProfilePage'
import BookmarksPage from './pages/BookmarksPage'
import ScraperDashboard from './pages/admin/ScraperDashboard'
import MangaManagePage from './pages/admin/MangaManagePage'
import MangaEditPage from './pages/admin/MangaEditPage'
import NotFoundPage from './pages/NotFoundPage'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  return user ? children : <Navigate to="/login" replace />
}

function StaffRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  if (!user.is_staff && !user.is_superuser) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      {/* Reader has its own minimal layout */}
      <Route path="/manga/:mangaSlug/chapter/:chapterSlug" element={<ChapterReadPage />} />

      {/* Main layout */}
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/browse" element={<BrowsePage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/manga/:slug" element={<MangaDetailPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Protected */}
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/profile/:username" element={<PublicProfilePage />} />
        <Route path="/bookmarks" element={<ProtectedRoute><BookmarksPage /></ProtectedRoute>} />

        {/* Staff / admin */}
        <Route path="/staff/scrapers" element={<StaffRoute><ScraperDashboard /></StaffRoute>} />
        <Route path="/staff/manga" element={<StaffRoute><MangaManagePage /></StaffRoute>} />
        <Route path="/staff/manga/:mangaId/edit" element={<StaffRoute><MangaEditPage /></StaffRoute>} />

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
