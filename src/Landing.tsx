import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import './App.css'

function Landing() {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark')

  useEffect(() => {
    document.body.className = darkMode ? 'dark' : 'light'
  }, [darkMode])

  return (
    <div className="landing-container">
      <header>
        <div className="nav-container">
          <div className="logo-placeholder">DutyWise</div>
          <nav>
            <Link to="/calendar">Calendar</Link>
            <button className="theme-toggle" onClick={() => {
              const newMode = !darkMode;
              setDarkMode(newMode);
              localStorage.setItem('theme', newMode ? 'dark' : 'light');
            }}>
              {darkMode ? '☀️' : '🌙'}
            </button>
          </nav>
        </div>
      </header>

      <section className="hero">
        <h1>DutyWise</h1>
        <p>Manage your pilot duties with ease. Track schedules, rest periods, and stay compliant.</p>
        <Link to="/calendar" className="cta-button">Get Started</Link>
      </section>

      <section className="features">
        <h2>Features</h2>
        <div className="feature-grid">
          <div className="feature">
            <h3>Calendar View</h3>
            <p>Visual calendar with color-coded duty and rest periods.</p>
          </div>
          <div className="feature">
            <h3>Event Management</h3>
            <p>Add, edit, and delete duty events with ease.</p>
          </div>
          <div className="feature">
            <h3>Dark Mode</h3>
            <p>Switch between light and dark themes.</p>
          </div>
          <div className="feature">
            <h3>Mobile Friendly</h3>
            <p>Works great on all devices.</p>
          </div>
        </div>
      </section>

      <footer>
        <p>&copy; 2025 DutyWise. All rights reserved.</p>
      </footer>
    </div>
  )
}

export default Landing
