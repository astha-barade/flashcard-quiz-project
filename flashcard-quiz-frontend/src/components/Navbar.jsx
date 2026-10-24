import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { homePathFor, useAuth } from '../context/AuthContext'
import Badge from './Badge'

const STUDENT_LINKS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/quiz', label: "Today's Quiz" },
  { to: '/attempts', label: 'My Attempts' },
]
const ADMIN_LINKS = [{ to: '/admin', label: 'Admin Dashboard' }]

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

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link to={user ? homePathFor(user) : '/login'} className="brand" onClick={() => setOpen(false)}>
          <span className="brand-mark" aria-hidden="true">▤</span>
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
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} onClick={() => setOpen(false)}>
              {l.label}
            </NavLink>
          ))}
          {user ? (
            <div className="nav-user">
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
