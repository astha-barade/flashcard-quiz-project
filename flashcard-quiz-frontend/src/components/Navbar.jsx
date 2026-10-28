import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { homePathFor, useAuth } from '../context/AuthContext'
import Badge from './Badge'
import { IconBook, IconTrophy, IconBarChart, IconLayers, IconSparkles } from './Icons'

const STUDENT_LINKS = [
  { to: '/dashboard', label: 'Dashboard', icon: IconSparkles },
  { to: '/quiz', label: "Today's Quiz", icon: IconBook },
  { to: '/attempts', label: 'My Attempts', icon: IconTrophy },
]
const ADMIN_LINKS = [
  { to: '/admin', label: 'Admin Dashboard', icon: IconLayers },
  { to: '/admin/analytics', label: 'Results & Analytics', icon: IconBarChart },
]

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const links = user?.role === 'ADMIN' ? ADMIN_LINKS : user ? STUDENT_LINKS : []

  function handleLogout() {
    logout()
    setOpen(false)
    navigate('/login')
  }

  const initial = user?.name ? user.name.charAt(0).toUpperCase() : 'U'

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link to={user ? homePathFor(user) : '/login'} className="brand" onClick={() => setOpen(false)}>
          <span className="brand-mark" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/>
              <path d="M6 6h10"/>
              <path d="M6 10h10"/>
            </svg>
          </span>
          <span>Daily Flashcards</span>
        </Link>

        {user && (
          <button
            className="nav-toggle"
            aria-label="Toggle menu"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? '✕' : '☰'}
          </button>
        )}

        <nav className={`nav-links ${open ? 'open' : ''}`}>
          {links.map((l) => {
            const Icon = l.icon
            return (
              <NavLink key={l.to} to={l.to} onClick={() => setOpen(false)}>
                {Icon && <Icon size={16} />}
                <span>{l.label}</span>
              </NavLink>
            )
          })}
          {user ? (
            <div className="nav-user">
              <span
                style={{
                  display: 'inline-grid',
                  placeItems: 'center',
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.2)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                }}
              >
                {initial}
              </span>
              <span className="nav-user-name">{user.name}</span>
              <Badge tone={user.role === 'ADMIN' ? 'amber' : 'navy'}>{user.role}</Badge>
              <button className="btn btn-ghost-light btn-sm" onClick={handleLogout}>
                Log out
              </button>
            </div>
          ) : (
            <div className="nav-user">
              <NavLink to="/login">Log in</NavLink>
              <NavLink to="/register">Register</NavLink>
            </div>
          )}
        </nav>
      </div>
    </header>
  )
}
