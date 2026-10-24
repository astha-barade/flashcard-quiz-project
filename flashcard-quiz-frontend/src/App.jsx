import { Navigate, Route, Routes } from 'react-router-dom'
import { homePathFor, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import { ProtectedRoute, PublicOnlyRoute } from './components/ProtectedRoute'
import Login from './pages/Login'
import Register from './pages/Register'
import StudentDashboard from './pages/StudentDashboard'
import DailyQuiz from './pages/DailyQuiz'
import QuizResults from './pages/QuizResults'
import MyAttempts from './pages/MyAttempts'
import AdminDashboard from './pages/AdminDashboard'
import NotFound from './pages/NotFound'

export default function App() {
  const { user } = useAuth()

  return (
    <Routes>
      <Route element={<Layout />}>
        {/* "/" sends you to the right place */}
        <Route path="/" element={<Navigate to={user ? homePathFor(user) : '/login'} replace />} />

        {/* Public pages (redirect away if already logged in) */}
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>

        {/* Student-only pages (backend: /api/student/** requires ROLE_STUDENT) */}
        <Route element={<ProtectedRoute role="STUDENT" />}>
          <Route path="/dashboard" element={<StudentDashboard />} />
          <Route path="/quiz" element={<DailyQuiz />} />
          <Route path="/results/:quizId" element={<QuizResults />} />
          <Route path="/attempts" element={<MyAttempts />} />
        </Route>

        {/* Admin-only pages (backend: /api/admin/** requires ROLE_ADMIN) */}
        <Route element={<ProtectedRoute role="ADMIN" />}>
          <Route path="/admin" element={<AdminDashboard />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
