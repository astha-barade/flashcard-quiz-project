import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import { homePathFor, useAuth } from '../context/AuthContext'
import Alert from './Alert'

/**
 * Guards pages.
 *  - Not logged in      -> sent to /login
 *  - Wrong role         -> "not allowed" message (the backend would also reject it)
 * Usage: <Route element={<ProtectedRoute role="STUDENT" />}> ...pages... </Route>
 */
export function ProtectedRoute({ role }) {
  const { user, notice } = useAuth()
  const location = useLocation()

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname, message: notice }} />
  }

  if (role && user.role !== role) {
    return (
      <div className="narrow">
        <Alert
          type="warning"
          title="You can't open this page"
          action={
            <Link className="btn btn-secondary btn-sm" to={homePathFor(user)}>
              Go to my dashboard
            </Link>
          }
        >
          {role === 'ADMIN'
            ? 'This page is only for administrators.'
            : 'This page is only for students. Admin accounts are not allowed to use student pages by the backend.'}
        </Alert>
      </div>
    )
  }

  return <Outlet />
}

/** Login/Register pages: if you're already logged in, go to your home page. */
export function PublicOnlyRoute() {
  const { user } = useAuth()
  if (user) return <Navigate to={homePathFor(user)} replace />
  return <Outlet />
}
