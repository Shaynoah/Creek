import React, { useEffect, useState } from 'react'
import Login from './components/Login'
import UserDashboard from './components/UserDashboard'
import AdminDashboard from './components/AdminDashboard'
import './App.css'

const SESSION_KEY = 'creekFreshSessionV1'

function App() {
  const [user, setUser] = useState(null)
  const [userType, setUserType] = useState(null)

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (!parsed || typeof parsed !== 'object') return
      if (parsed.userType !== 'user' && parsed.userType !== 'admin') return
      if (!parsed.user) return
      setUser(parsed.user)
      setUserType(parsed.userType)
    } catch {
      // ignore
    }
  }, [])

  const handleLogin = (userData, type) => {
    setUser(userData)
    setUserType(type)
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ user: userData, userType: type }))
    } catch {
      // ignore
    }
  }

  const handleLogout = () => {
    setUser(null)
    setUserType(null)
    try {
      sessionStorage.removeItem(SESSION_KEY)
    } catch {
      // ignore
    }
  }

  const handleAdminProfileUpdate = (updatedAdmin) => {
    setUser(updatedAdmin)
    try {
      const raw = sessionStorage.getItem(SESSION_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (!parsed || typeof parsed !== 'object') return
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...parsed, user: updatedAdmin }))
    } catch {
      // ignore
    }
  }

  return (
    <div className="app-container">
      <div className="app-stage" key={user ? `dash-${userType || 'unknown'}` : 'login'}>
        {!user ? (
          <Login onLogin={handleLogin} />
        ) : userType === 'user' ? (
          <UserDashboard user={user} onLogout={handleLogout} />
        ) : (
          <AdminDashboard admin={user} onLogout={handleLogout} onProfileUpdate={handleAdminProfileUpdate} />
        )}
      </div>
    </div>
  )
}

export default App
