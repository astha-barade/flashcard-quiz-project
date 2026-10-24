import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { registerUser } from '../services/api'
import Alert from '../components/Alert'
import Button from '../components/Button'
import FormField from '../components/FormField'

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
        <span className="brand-mark big" aria-hidden="true">▤</span>
        <h2>Join the daily habit.</h2>
        <p>Create a student account and start building your streak of quiz attempts.</p>
      </aside>

      <section className="auth-card">
        <h1>Create your account</h1>
        <p className="muted">Registration creates a student account.</p>

        {apiError && <Alert type="error">{apiError}</Alert>}

        <form onSubmit={handleSubmit} noValidate>
          <FormField label="Full name" autoComplete="name" value={form.name} onChange={update('name')} error={errors.name} />
          <FormField
            label="Email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={update('email')}
            error={errors.email}
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
          <Button type="submit" loading={loading} block>
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
