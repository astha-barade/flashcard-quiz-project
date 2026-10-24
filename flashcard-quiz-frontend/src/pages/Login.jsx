import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { homePathFor, useAuth } from '../context/AuthContext'
import Alert from '../components/Alert'
import Button from '../components/Button'
import FormField from '../components/FormField'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function Login() {
  const { login, notice } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Register page sends us back here with the new email + a success message.
  const [email, setEmail] = useState(location.state?.registeredEmail || '')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [apiError, setApiError] = useState('')
  const [loading, setLoading] = useState(false)

  const infoMessage = location.state?.registeredEmail
    ? 'Account created! Log in with your new credentials.'
    : location.state?.message || notice

  function validate() {
    const next = {}
    if (!email.trim()) next.email = 'Email is required.'
    else if (!EMAIL_RE.test(email.trim())) next.email = 'Enter a valid email address.'
    if (!password) next.password = 'Password is required.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setApiError('')
    if (!validate()) return
    setLoading(true)
    try {
      const user = await login({ email: email.trim(), password })
      // Send admins to /admin and students to /dashboard.
      // "from" is only honoured if it belongs to the user's role.
      const from = location.state?.from
      const allowedFrom =
        from && (user.role === 'ADMIN' ? from.startsWith('/admin') : !from.startsWith('/admin'))
      navigate(allowedFrom ? from : homePathFor(user), { replace: true })
    } catch (err) {
      setApiError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-wrap">
      <aside className="auth-brand">
        <span className="brand-mark big" aria-hidden="true">▤</span>
        <h2>Learn a little, every day.</h2>
        <p>One quiz a day, instant scores, and a record of every attempt.</p>
      </aside>

      <section className="auth-card">
        <h1>Welcome back</h1>
        <p className="muted">Log in to take today's quiz.</p>

        {infoMessage && <Alert type="info">{infoMessage}</Alert>}
        {apiError && <Alert type="error">{apiError}</Alert>}

        <form onSubmit={handleSubmit} noValidate>
          <FormField
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
            placeholder="you@example.com"
          />
          <FormField
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
          />
          <Button type="submit" loading={loading} block>
            Log in
          </Button>
        </form>

        <p className="auth-switch">
          New here? <Link to="/register">Create an account</Link>
        </p>
      </section>
    </div>
  )
}
