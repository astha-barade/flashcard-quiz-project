import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { registerUser } from '../services/api'
import Alert from '../components/Alert'
import Button from '../components/Button'
import FormField from '../components/FormField'
import { IconCheckCircle, IconSparkles, IconTrophy } from '../components/Icons'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function Register() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [errors, setErrors] = useState({})
  const [apiError, setApiError] = useState('')
  const [loading, setLoading] = useState(false)

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  function validate() {
    const next = {}
    if (!form.name.trim()) next.name = 'Name is required.'
    if (!form.email.trim()) next.email = 'Email is required.'
    else if (!EMAIL_RE.test(form.email.trim())) next.email = 'Enter a valid email address.'
    if (!form.password) next.password = 'Password is required.'
    else if (form.password.length < 6) next.password = 'Use at least 6 characters.'
    if (form.confirm !== form.password) next.confirm = 'Passwords do not match.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setApiError('')
    if (!validate()) return
    setLoading(true)
    try {
      const user = await registerUser({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      })
      navigate('/login', { replace: true, state: { registeredEmail: user.email } })
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
        <h2>Join the daily habit.</h2>
        <p>Create a student account and start building your streak of quiz attempts.</p>

        <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '0.92rem', color: '#e2e8f0' }}>
            <span style={{ color: '#60a5fa' }}><IconSparkles size={18} /></span>
            <span>Free student account with instant quiz access</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '0.92rem', color: '#e2e8f0' }}>
            <span style={{ color: '#34d399' }}><IconCheckCircle size={18} /></span>
            <span>Track your learning accuracy and growth</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '0.92rem', color: '#e2e8f0' }}>
            <span style={{ color: '#fbbf24' }}><IconTrophy size={18} /></span>
            <span>Review question-by-question explanations</span>
          </div>
        </div>
      </aside>

      <section className="auth-card">
        <h1>Create your account</h1>
        <p className="muted">Registration creates a student account.</p>

        {apiError && <Alert type="error">{apiError}</Alert>}

        <form onSubmit={handleSubmit} noValidate>
          <FormField
            label="Full name"
            autoComplete="name"
            value={form.name}
            onChange={update('name')}
            error={errors.name}
            placeholder="Jane Doe"
          />
          <FormField
            label="Email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={update('email')}
            error={errors.email}
            placeholder="jane@example.com"
          />
          <FormField
            label="Password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={update('password')}
            error={errors.password}
            hint="At least 6 characters."
          />
          <FormField
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            value={form.confirm}
            onChange={update('confirm')}
            error={errors.confirm}
          />
          <Button type="submit" loading={loading} block style={{ fontWeight: 700, padding: '0.75rem' }}>
            Create account
          </Button>
        </form>

        <p className="auth-switch">
          Already registered? <Link to="/login">Log in</Link>
        </p>
      </section>
    </div>
  )
}
