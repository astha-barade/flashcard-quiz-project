import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'

// Wraps every page with the top navigation bar.
export default function Layout() {
  return (
    <div className="app-shell">
      <Navbar />
      <main className="container">
        <Outlet />
      </main>
      <footer className="footer">Daily Flashcard Quiz Platform</footer>
    </div>
  )
}
