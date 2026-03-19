import React, { useState } from 'react'
import logo from '@src/assets/logo.png'
import './Login.css'

const Login = ({ onLogin }) => {
  const brandText = 'CREEK FRESH'
  const [loginType, setLoginType] = useState('user') // 'user' or 'admin'
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')

    if (loginType === 'user') {
      if (!name.trim()) {
        setError('Please enter your name')
        return
      }
      onLogin({ name: name.trim() }, 'user')
    } else {
      if (!username.trim() || !password.trim()) {
        setError('Please enter both username and password')
        return
      }
      // Restriction removed: allow any non-empty admin credentials for now
      onLogin({ username: username.trim() }, 'admin')
    }
  }

  return (
    <div className="login-container">
      <div className="water-background">
        <div className="wave wave1"></div>
        <div className="wave wave2"></div>
        <div className="wave wave3"></div>
      </div>
      
      <div className="login-card">
        <div className="login-header">
          <img className="brand-logo" src={logo} alt="Creek Fresh logo" />
          <h1 className="login-title animated-brand" aria-label={brandText}>
            {brandText.split('').map((ch, idx) => (
              <span
                key={`${ch}-${idx}`}
                className={`brand-letter ${ch === ' ' ? 'space' : ''}`}
                style={{ animationDelay: `${idx * 70}ms` }}
                aria-hidden="true"
              >
                {ch === ' ' ? '\u00A0' : ch}
              </span>
            ))}
          </h1>
          <p className="login-subtitle">Pure water. Smart management. Seamless access.</p>
          <p className="login-caption">Select access type to continue</p>
          <div className="login-pills">
            <span className="login-pill">📗 Live inventory</span>
            <span className="login-pill">🛡️ Secure admin access</span>
            <span className="login-pill">🟡 Fast order</span>
          </div>
        </div>

        <div className="login-type-selector">
          <button
            className={`type-btn ${loginType === 'user' ? 'active' : ''}`}
            onClick={() => {
              setLoginType('user')
              setError('')
              setName('')
            }}
          >
            <span className="type-title">👤 User</span>
            <span className="type-sub">Place orders, track requests, and manage water needs</span>
          </button>
          <button
            className={`type-btn ${loginType === 'admin' ? 'active' : ''}`}
            onClick={() => {
              setLoginType('admin')
              setError('')
              setUsername('')
              setPassword('')
            }}
          >
            <span className="type-title">✅ Admin</span>
            <span className="type-sub">Monitor sales, inventory, bottles, and daily performance</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {loginType === 'user' ? (
            <div className="form-group">
              <label htmlFor="name">Name</label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="form-input"
                autoFocus
              />
            </div>
          ) : (
            <>
              <div className="form-group">
                <label htmlFor="username">Username</label>
                <input
                  type="text"
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username"
                  className="form-input"
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="form-input"
                />
              </div>
            </>
          )}

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="login-btn">
            <span>Continue</span>
          </button>
        </form>

        <div className="login-footer">
          <p>Water management system</p>
        </div>
      </div>

      <div className="floating-bubbles">
        {[...Array(10)].map((_, i) => (
          <div key={i} className="bubble" style={{
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 3}s`,
            animationDuration: `${10 + Math.random() * 8}s`
          }}></div>
        ))}
      </div>
    </div>
  )
}

export default Login
