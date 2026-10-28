import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { homePathFor, useAuth } from '../context/AuthContext'
import Alert from '../components/Alert'
import Button from '../components/Button'
import FormField from '../components/FormField'
import { IconBook, IconCheckCircle, IconSparkles, IconTrophy } from '../components/Icons'

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
        <span className="brand-mark big" aria-hidden="true">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/>
            <path d="M6 6h10"/>
            <path d="M6 10h10"/>
          </svg>
        </span>
        <h2>Learn a little, every day.</h2>
        <p>One quiz a day, instant scores, and a record of every attempt.</p>

        <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '0.92rem', color: '#e2e8f0' }}>
            <span style={{ color: '#60a5fa' }}><IconSparkles size={18} /></span>
            <span>Daily curated flashcard challenges</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '0.92rem', color: '#e2e8f0' }}>
            <span style={{ color: '#34d399' }}><IconCheckCircle size={18} /></span>
            <span>Immediate answer validation and detailed reviews</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '0.92rem', color: '#e2e8f0' }}>
            <span style={{ color: '#fbbf24' }}><IconTrophy size={18} /></span>
            <span>Consistent progress tracking and learning streaks</span>
          </div>
        </div>
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
          <Button type="submit" loading={loading} block style={{ fontWeight: 700, padding: '0.75rem' }}>
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
