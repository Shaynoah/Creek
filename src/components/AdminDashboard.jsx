import React, { useEffect, useRef, useState } from 'react'
import logo from '@src/assets/logo.png'
import './Dashboard.css'

const ORDERS_KEY = 'creekFreshOrdersV1'
const ORDERS_BACKUP_KEY = 'creekFreshOrdersBackupV1'
const ORDERS_SESSION_KEY = 'creekFreshOrdersSessionV1'

const toLocalDateKey = (d) => {
  return new Date(d).toLocaleDateString('en-CA')
}

const formatKsh = (amount) => `KSh ${Number(amount || 0).toLocaleString()}`

// Inventory storage keys
const TANKS_KEY = 'creekFreshInvTanksV1'
const BOTTLES_KEY = 'creekFreshInvBottlesV1'
const PRODUCTS_KEY = 'creekFreshProductPricesV1'

const bottleSizes = [
  { id: '20l-bottle', label: '20L bottle' },
  { id: '10l-bottle', label: '10L bottle' },
  { id: '5l-bottle', label: '5L bottle' },
  { id: '1l-bottle', label: '1L bottle' },
  { id: '500ml-bottle', label: '500ml bottle' },
]

const defaultBottlePricing = {
  '20l-bottle': { qty: 0, price: 300 },
  '10l-bottle': { qty: 0, price: 200 },
  '5l-bottle': { qty: 0, price: 120 },
  '1l-bottle': { qty: 0, price: 60 },
  '500ml-bottle': { qty: 0, price: 30 },
}

const ADMIN_AUTH_KEY = 'creekFreshAdminAuthV1'

const AdminDashboard = ({ admin, onLogout, onProfileUpdate }) => {
  const [activeView, setActiveView] = useState('dashboard')
  const [orders, setOrders] = useState([])
  const [tanks, setTanks] = useState([])
  const [newTank, setNewTank] = useState({ name: '', liters: '' })
  const [bottles, setBottles] = useState({})
  const [editingBottle, setEditingBottle] = useState(null) // size id being edited
  const [tempBottleQty, setTempBottleQty] = useState('')
  const [editingTankId, setEditingTankId] = useState(null)
  const [tempTank, setTempTank] = useState({ name: '', liters: '' })
  const [productPrices, setProductPrices] = useState({
    '20l': 150, '10l': 80, '5l': 40, '2l': 20, '1.5l': 15, '1l': 10, '500ml': 10
  })
  const [editingProductId, setEditingProductId] = useState(null)
  const [tempProductPrice, setTempProductPrice] = useState('')
  const [editingBottlePriceId, setEditingBottlePriceId] = useState(null)
  const [tempBottlePrice, setTempBottlePrice] = useState('')
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileForm, setProfileForm] = useState({
    username: admin?.username || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [profileMsg, setProfileMsg] = useState('')
  const mainScrollRef = useRef(null)

  const loadOrdersFromStorage = () => {
    try {
      let raw = localStorage.getItem(ORDERS_KEY)
      if (!raw) {
        // Attempt restore from backup
        const backup = localStorage.getItem(ORDERS_BACKUP_KEY)
        if (backup) {
          try {
            const parsedBackup = JSON.parse(backup)
            if (Array.isArray(parsedBackup)) {
              localStorage.setItem(ORDERS_KEY, backup)
              raw = backup
            }
          } catch {
            // ignore
          }
        } else {
          // Attempt restore from session mirror
          const sessionRaw = sessionStorage.getItem(ORDERS_SESSION_KEY)
          if (sessionRaw) {
            try {
              const parsedSession = JSON.parse(sessionRaw)
              if (Array.isArray(parsedSession)) {
                localStorage.setItem(ORDERS_KEY, sessionRaw)
                raw = sessionRaw
              }
            } catch {
              // ignore
            }
          }
        }
        if (!raw) {
          setOrders([])
          return
        }
      }
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) {
        setOrders([])
        return
      }
      setOrders(parsed.map(o => ({ status: 'Pending', ...o })))
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    loadOrdersFromStorage()
  }, [])

  // Inventory load/save
  const loadTanks = () => {
    try {
      const raw = localStorage.getItem(TANKS_KEY)
      if (!raw) return setTanks([])
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return setTanks([])
      setTanks(parsed)
    } catch {}
  }
  const saveTanks = (next) => {
    try { localStorage.setItem(TANKS_KEY, JSON.stringify(next)) } catch {}
  }
  const loadBottles = () => {
    try {
      const raw = localStorage.getItem(BOTTLES_KEY)
      if (!raw) {
        localStorage.setItem(BOTTLES_KEY, JSON.stringify(defaultBottlePricing))
        setBottles(defaultBottlePricing)
        return
      }
      const parsed = JSON.parse(raw)
      if (!parsed || typeof parsed !== 'object') {
        setBottles(defaultBottlePricing)
        return
      }
      setBottles({ ...defaultBottlePricing, ...parsed })
    } catch {}
  }
  const saveBottles = (next) => {
    try { localStorage.setItem(BOTTLES_KEY, JSON.stringify(next)) } catch {}
  }
  const loadProductPrices = () => {
    try {
      const raw = localStorage.getItem(PRODUCTS_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') setProductPrices(p => ({ ...p, ...parsed }))
    } catch {}
  }
  const saveProductPrices = (next) => {
    try { localStorage.setItem(PRODUCTS_KEY, JSON.stringify(next)) } catch {}
  }
  useEffect(() => {
    loadTanks(); loadBottles(); loadProductPrices()
  }, [])

  useEffect(() => {
    setProfileForm(p => ({ ...p, username: admin?.username || '' }))
  }, [admin])

  // Keep section content pinned to top on load and on nav changes
  useEffect(() => {
    const el = mainScrollRef.current
    if (!el) return
    requestAnimationFrame(() => {
      el.scrollTo({ top: 0, behavior: 'auto' })
    })
  }, [])

  useEffect(() => {
    const el = mainScrollRef.current
    if (!el) return
    requestAnimationFrame(() => {
      el.scrollTo({ top: 0, behavior: 'auto' })
    })
  }, [activeView])

  // Date helpers and aggregations for Sales view
  const addDays = (date, days) => {
    const d = new Date(date)
    d.setDate(d.getDate() + days)
    return d
  }

  const getStartOfWeek = (date) => {
    const d = new Date(date)
    d.setHours(0, 0, 0, 0)
    const day = d.getDay() // 0 Sun ... 6 Sat
    const diff = (day === 0 ? -6 : 1 - day) // Monday = start
    d.setDate(d.getDate() + diff)
    return d
  }

  const getMonthRange = (date) => {
    const d = new Date(date)
    const start = new Date(d.getFullYear(), d.getMonth(), 1)
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    start.setHours(0,0,0,0)
    end.setHours(23,59,59,999)
    return { start, end }
  }

  const sumPaidByMethod = (start, end) => {
    const startKey = toLocalDateKey(start)
    const endKey = toLocalDateKey(end)
    const inRangePaid = orders.filter(o => {
      const k = (o.dateKey || toLocalDateKey(o.timestamp))
      if (!k) return false
      if ((o.status || 'Pending') !== 'Paid') return false
      return k >= startKey && k <= endKey
    })
    let cash = 0
    let mpesa = 0
    for (const o of inRangePaid) {
      const amt = Number(o.totalAmount || 0)
      if (String(o.paymentMethod) === 'mpesa') mpesa += amt
      else cash += amt
    }
    return { cash, mpesa, total: cash + mpesa, count: inRangePaid.length }
  }

  const sumPaidForDateKey = (dateKey) => {
    let cash = 0
    let mpesa = 0
    let count = 0
    for (const o of orders) {
      const k = (o.dateKey || toLocalDateKey(o.timestamp))
      if (k !== dateKey) continue
      if ((o.status || 'Pending') !== 'Paid') continue
      const amt = Number(o.totalAmount || 0)
      if (String(o.paymentMethod) === 'mpesa') mpesa += amt
      else cash += amt
      count++
    }
    return { cash, mpesa, total: cash + mpesa, count }
  }

  const getMonthWeeksRangesSimple = (date) => {
    // Week1: days 1-7, Week2: 8-14, Week3: 15-21, Week4: 22-end
    const d = new Date(date)
    const year = d.getFullYear()
    const month = d.getMonth()
    const endDay = new Date(year, month + 1, 0).getDate()
    const mk = (day) => {
      const dt = new Date(year, month, day)
      dt.setHours(0,0,0,0)
      return dt
    }
    return [
      { label: 'Week 1', start: mk(1), end: mk(Math.min(7, endDay)) },
      { label: 'Week 2', start: mk(8), end: mk(Math.min(14, endDay)) },
      { label: 'Week 3', start: mk(15), end: mk(Math.min(21, endDay)) },
      { label: 'Week 4', start: mk(22), end: mk(endDay) },
    ]
  }

  // Live updates across tabs and as a fallback with polling
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === ORDERS_KEY) {
        loadOrdersFromStorage()
      }
      if (e.key === BOTTLES_KEY) {
        loadBottles()
      }
      if (e.key === TANKS_KEY) {
        loadTanks()
      }
    }
    window.addEventListener('storage', onStorage)
    const interval = setInterval(() => {
      loadOrdersFromStorage()
      loadBottles()
      loadTanks()
    }, 2000)
    return () => {
      window.removeEventListener('storage', onStorage)
      clearInterval(interval)
    }
  }, [])

  return (
    <div className="dashboard-container" data-has-sidebar="true">
      <div className="dashboard-header">
        <div className="header-content">
          <div className="header-left">
            <div className="logo-container">
              <img className="header-logo" src={logo} alt="Creek Fresh logo" />
            </div>
            <div className="brand-divider"></div>
            <div className="user-info">
              <div className="user-greeting">Admin Panel</div>
              <h1 className="user-name">@{admin.username}</h1>
            </div>
          </div>
          <div className="header-center-brand">
            <span className="center-brand-typing">CREEK FRESH</span>
          </div>
          <div className="header-right">
            <div className="user-profile">
              <div className="profile-avatar">
                <span>{admin.username.charAt(0).toUpperCase()}</span>
              </div>
              <div className="profile-info">
                <span className="profile-name">{admin.username}</span>
                <span className="profile-role">Administrator</span>
              </div>
            </div>
            <button onClick={onLogout} className="logout-btn">
              <span className="logout-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M10 7V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v14a2 2 0 0 1 2 2h-7a2 2 0 0 1-2-2v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M15 12H3m0 0 3-3m-3 3 3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>
      <div className="dashboard-layout has-sidebar">
        <aside className="dashboard-sidebar">
          <nav className="sidebar-nav">
            <button
              className={`nav-item ${activeView === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveView('dashboard')}
            >
              <span className="nav-icon">🏠</span>
              <span className="nav-text">Dashboard</span>
            </button>
            <button
              className={`nav-item ${activeView === 'all-orders' ? 'active' : ''}`}
              onClick={() => setActiveView('all-orders')}
            >
              <span className="nav-icon">📋</span>
              <span className="nav-text">All Orders</span>
            </button>
            <button
              className={`nav-item ${activeView === 'sales' ? 'active' : ''}`}
              onClick={() => setActiveView('sales')}
            >
              <span className="nav-icon">💹</span>
              <span className="nav-text">Sales</span>
            </button>
            <button
              className={`nav-item ${activeView === 'inventory' ? 'active' : ''}`}
              onClick={() => setActiveView('inventory')}
            >
              <span className="nav-icon">🧰</span>
              <span className="nav-text">Inventory</span>
            </button>
            <button
              className={`nav-item ${activeView === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveView('settings')}
            >
              <span className="nav-icon">⚙️</span>
              <span className="nav-text">Settings</span>
            </button>
            <button
              className={`nav-item ${activeView === 'reports' ? 'active' : ''}`}
              onClick={() => setActiveView('reports')}
            >
              <span className="nav-icon">📑</span>
              <span className="nav-text">Reports</span>
            </button>
            <button
              className={`nav-item ${activeView === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveView('profile')}
            >
              <span className="nav-icon">👤</span>
              <span className="nav-text">Profile</span>
            </button>
          </nav>
        </aside>
        <main className="dashboard-main" ref={mainScrollRef}>
          <div key={activeView} className="view-transition">
            {activeView === 'dashboard' && (
              <div className="view-content weekly-summary-view">
                {(() => {
                  const now = new Date()
                  const todayKey = toLocalDateKey(now)
                  const weekStart = getStartOfWeek(now)
                  const weekEnd = addDays(weekStart, 6)
                  const { start: monthStart, end: monthEnd } = getMonthRange(now)

                  const todaysOrders = orders.filter(o => (o.dateKey || toLocalDateKey(o.timestamp)) === todayKey)
                  const paidToday = todaysOrders.filter(o => (o.status || 'Pending') === 'Paid')
                  const pendingToday = todaysOrders.length - paidToday.length
                  const salesToday = paidToday.reduce((s, o) => s + Number(o.totalAmount || 0), 0)
                  const litersMap = { '20l': 20, '10l': 10, '5l': 5, '2l': 2, '1.5l': 1.5, '1l': 1, '500ml': 0.5 }
                  const litersToday = paidToday.reduce((s, o) => s + (Number(litersMap[o.productId] || 0) * Number(o.quantity || 0)), 0)
                  const bottleCountToday = paidToday.reduce((s, o) => s + Number(o.emptyBottleQty || 0), 0)
                  const bottleAmountToday = paidToday.reduce((s, o) => s + Number(o.emptyBottleAmount || 0), 0)
                  const payToday = sumPaidByMethod(now, now)

                  const weekly = sumPaidByMethod(weekStart, weekEnd)
                  const monthly = sumPaidByMethod(monthStart, monthEnd)
                  const tankLiters = tanks.reduce((s, t) => s + Number(t.liters || 0), 0)
                  const bottleStock = Object.values(bottles || {}).reduce((s, r) => s + Number((r || {}).qty || 0), 0)


                  return (
                    <>
                      <div className="weekly-header">
                        <div>
                          <h2>Admin Dashboard</h2>
                          <p className="weekly-subtitle">Overall live view of sales, inventory and performance</p>
                        </div>
                        <div className="weekly-pill">
                          <span className="pill-label">Today</span>
                          <span className="pill-value">
                            {now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: '2-digit' })}
                          </span>
                        </div>
                      </div>

                      <div className="dashboard-hero-grid">
                        <div className="dashboard-hero-card card-total">
                          <div className="dash-metric-head">
                            <span className="dash-metric-icon">💰</span>
                            <span className="weekly-card-label">Today Sales</span>
                          </div>
                          <div className="weekly-card-value accent">{formatKsh(salesToday)}</div>
                          <div className="weekly-card-hint">Cash {formatKsh(payToday.cash)} • MPESA {formatKsh(payToday.mpesa)}</div>
                        </div>
                        <div className="dashboard-hero-card card-cash">
                          <div className="dash-metric-head">
                            <span className="dash-metric-icon">💧</span>
                            <span className="weekly-card-label">Liters Sold Today</span>
                          </div>
                          <div className="weekly-card-value">{Number(litersToday).toLocaleString()} L</div>
                          <div className="weekly-card-hint">Paid-only orders</div>
                        </div>
                        <div className="dashboard-hero-card card-mpesa">
                          <div className="dash-metric-head">
                            <span className="dash-metric-icon">🧾</span>
                            <span className="weekly-card-label">Orders Today</span>
                          </div>
                          <div className="weekly-card-value">{todaysOrders.length}</div>
                          <div className="weekly-card-hint">{paidToday.length} paid • {pendingToday} pending</div>
                        </div>
                      </div>

                      <div className="weekly-breakdown sales-weekly">
                        <div className="weekly-breakdown-title">Inventory Snapshot</div>
                    <div className="weekly-breakdown-grid report-bottle-grid">
                          <div className="week-day dash-inv-card">
                            <div className="dash-metric-icon inv">🛢️</div>
                            <div className="week-day-label">Water in Tanks</div>
                            <div className="week-day-value">{Number(tankLiters).toLocaleString()} L</div>
                            <div className="week-day-hint">{tanks.length} tank(s)</div>
                          </div>
                          <div className="week-day dash-inv-card">
                            <div className="dash-metric-icon inv">🧴</div>
                            <div className="week-day-label">Empty Bottles in Stock</div>
                            <div className="week-day-value">{bottleStock}</div>
                            <div className="week-day-hint">All bottle sizes</div>
                          </div>
                          <div className="week-day dash-inv-card">
                            <div className="dash-metric-icon inv">📦</div>
                            <div className="week-day-label">Bottles Sold Today</div>
                            <div className="week-day-value">{bottleCountToday}</div>
                            <div className="week-day-hint">Amount {formatKsh(bottleAmountToday)}</div>
                          </div>
                        </div>
                      </div>

                      <div className="orders-summary-bar sales-monthly-total dash-summary" style={{ marginTop: 14 }}>
                        <div className="summary-item">
                          <div className="summary-label">Weekly Sales</div>
                          <div className="summary-value accent">{formatKsh(weekly.total)}</div>
                        </div>
                        <div className="summary-divider" />
                        <div className="summary-item">
                          <div className="summary-label">Monthly Sales</div>
                          <div className="summary-value accent">{formatKsh(monthly.total)}</div>
                        </div>
                      </div>
                    </>
                  )
                })()}
              </div>
            )}
            {activeView === 'all-orders' && (
              <div className="view-content my-orders-view">
                <div className="orders-header">
                  <div>
                    <h2>
                      All Orders (
                      {new Date().toLocaleDateString('en-US', { weekday: 'long' })}
                      )
                    </h2>
                  </div>
                  <div className="orders-meta">
                    <div className="orders-pill">
                      <span className="pill-label">Date</span>
                      <span className="pill-value">
                        {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>

                {(() => {
                  const todayKey = toLocalDateKey(new Date())
                  const todaysOrders = orders
                    .filter(o => (o.dateKey || toLocalDateKey(o.timestamp)) === todayKey)
                    .slice()
                    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))

                  const todaysTotal = todaysOrders.reduce((sum, o) => {
                    if ((o.status || 'Pending') !== 'Paid') return sum
                    return sum + Number(o.totalAmount || 0)
                  }, 0)

                  if (todaysOrders.length === 0) {
                    return (
                      <div className="orders-empty">
                        <div className="empty-title">No orders today yet</div>
                        <div className="empty-subtitle">Orders recorded by users will appear here.</div>
                      </div>
                    )
                  }

                  return (
                    <>
                      <div className="orders-table-wrap">
                        <table className="orders-table">
                          <thead>
                            <tr>
                              <th>Time</th>
                              <th>Product</th>
                              <th className="num">Qty</th>
                              <th className="num">Amount</th>
                              <th>Status</th>
                              <th>Payment</th>
                              <th className="num">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {todaysOrders.map((o, idx) => (
                              <tr key={o.id}>
                                <td className="muted">{o.time}</td>
                                <td>
                                  <div className="prod-cell">
                                    <div className="prod-name">{o.product}</div>
                                    <div className="prod-sub">Order #{String(idx + 1).padStart(3, '0')}</div>
                                  </div>
                                </td>
                                <td className="num">{o.quantity}</td>
                                <td className="num">{formatKsh(o.unitPrice)}</td>
                                <td>
                                  <span className={`status-select status-${String(o.status || 'Pending').toLowerCase()}`} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'default' }}>
                                    {o.status || 'Pending'}
                                  </span>
                                </td>
                                <td>
                                  <span className={`pay-badge ${o.paymentMethod}`}>
                                    <span className="pay-label">{o.paymentMethod?.toUpperCase()}</span>
                                  </span>
                                </td>
                                <td className="num strong">
                                  {(o.status || 'Pending') === 'Paid' ? formatKsh(o.totalAmount) : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="orders-summary-bar">
                        <div className="summary-item">
                          <div className="summary-label">Orders</div>
                          <div className="summary-value">{todaysOrders.length}</div>
                        </div>
                        <div className="summary-divider" />
                        <div className="summary-item">
                          <div className="summary-label">Total</div>
                          <div className="summary-value accent">{formatKsh(todaysTotal)}</div>
                        </div>
                      </div>
                    </>
                  )
                })()}
              </div>
            )}
            {activeView === 'sales' && (
              <div className="view-content weekly-summary-view sales-root">
                {(() => {
                  const now = new Date()
                  // Daily
                  const todayStart = new Date(now); todayStart.setHours(0,0,0,0)
                  const todayEnd = new Date(now); todayEnd.setHours(23,59,59,999)
                  const daily = sumPaidByMethod(todayStart, todayEnd)

                  // Weekly
                  const weekStart = getStartOfWeek(now)
                  const weekEnd = addDays(weekStart, 6)
                  const weekly = sumPaidByMethod(weekStart, weekEnd)
                  const weekDays = []
                  for (let i = 0; i < 7; i++) {
                    const d = addDays(weekStart, i)
                    const k = toLocalDateKey(d)
                    const label = d.toLocaleDateString('en-US', { weekday: 'short' })
                    const sums = sumPaidForDateKey(k)
                    weekDays.push({ label, ...sums })
                  }

                  // Monthly
                  const { start: monthStart, end: monthEnd } = getMonthRange(now)
                  const monthly = sumPaidByMethod(monthStart, monthEnd)
                  const monthWeeks = getMonthWeeksRangesSimple(now).map(w => ({
                    label: w.label,
                    ...sumPaidByMethod(w.start, w.end)
                  }))

                  return (
                    <>
                      <div className="weekly-header">
                        <div>
                          <h2>Sales</h2>
                          <p className="weekly-subtitle">Daily, Weekly and Monthly breakdowns (Paid-only)</p>
                        </div>
                      </div>

                      {/* Daily: Cash vs MPESA */}
                      <div className="weekly-cards sales-daily">
                        <div className="weekly-card card-cash">
                          <div className="weekly-card-label">Daily (Today) - Cash</div>
                          <div className="weekly-card-value accent">{formatKsh(daily.cash)}</div>
                          <div className="weekly-card-hint">Orders: {daily.count}</div>
                        </div>
                        <div className="weekly-card card-mpesa">
                          <div className="weekly-card-label">Daily (Today) - MPESA</div>
                          <div className="weekly-card-value accent">{formatKsh(daily.mpesa)}</div>
                          <div className="weekly-card-hint">Orders: {daily.count}</div>
                        </div>
                        <div className="weekly-card card-total">
                          <div className="weekly-card-label">Daily Total</div>
                          <div className="weekly-card-value accent">{formatKsh(daily.total)}</div>
                          <div className="weekly-card-hint">Paid-only</div>
                        </div>
                      </div>

                      {/* Weekly: Mon–Sun breakdown + total */}
                      <div className="weekly-breakdown sales-weekly" style={{ marginTop: 12 }}>
                        <div className="weekly-breakdown-title">Weekly (Mon–Sun)</div>
                        <div className="weekly-breakdown-grid">
                          {weekDays.map(d => (
                            <div key={d.label} className="week-day">
                              <div className="week-day-label">{d.label}</div>
                              <div className="week-day-value">{formatKsh(d.total)}</div>
                              <div className="week-day-hint">
                                <span className="badge cash">Cash {formatKsh(d.cash)}</span>
                                <span className="badge mpesa">MPESA {formatKsh(d.mpesa)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="orders-summary-bar sales-weekly-total" style={{ marginTop: 12 }}>
                        <div className="summary-item">
                          <div className="summary-label">Weekly Total</div>
                          <div className="summary-value accent">{formatKsh(weekly.total)}</div>
                        </div>
                        <div className="summary-divider" />
                        <div className="summary-item">
                          <div className="summary-label">Cash / MPESA</div>
                          <div className="summary-value">{formatKsh(weekly.cash)} • {formatKsh(weekly.mpesa)}</div>
                        </div>
                      </div>

                      {/* Monthly: Week 1–4 breakdown + total */}
                      <div className="weekly-breakdown sales-monthly" style={{ marginTop: 16 }}>
                        <div className="weekly-breakdown-title">Monthly (Week 1–4)</div>
                        <div className="weekly-breakdown-grid">
                          {monthWeeks.map(w => (
                            <div key={w.label} className="week-day">
                              <div className="week-day-label">{w.label}</div>
                              <div className="week-day-value">{formatKsh(w.total)}</div>
                              <div className="week-day-hint">
                                <span className="badge cash">Cash {formatKsh(w.cash)}</span>
                                <span className="badge mpesa">MPESA {formatKsh(w.mpesa)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="orders-summary-bar sales-monthly-total" style={{ marginTop: 12 }}>
                        <div className="summary-item">
                          <div className="summary-label">Monthly Total</div>
                          <div className="summary-value accent">{formatKsh(monthly.total)}</div>
                        </div>
                        <div className="summary-divider" />
                        <div className="summary-item">
                          <div className="summary-label">Cash / MPESA</div>
                          <div className="summary-value">{formatKsh(monthly.cash)} • {formatKsh(monthly.mpesa)}</div>
                        </div>
                      </div>
                    </>
                  )
                })()}
              </div>
            )}
            {activeView === 'inventory' && (
              <div className="view-content">
                <div className="weekly-header">
                  <div>
                    <h2>Inventory</h2>
                    <p className="weekly-subtitle">Manage water tanks and empty bottle stock</p>
                  </div>
                </div>

                <div className="weekly-breakdown sales-daily" style={{ marginBottom: 16 }}>
                  <div className="weekly-breakdown-title">Water Tanks</div>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      const name = String(newTank.name || '').trim()
                      const litersNum = Number.parseFloat(String(newTank.liters ?? ''))
                      if (!name || !Number.isFinite(litersNum) || litersNum < 0) {
                        return
                      }
                      const tank = { id: Date.now(), name, liters: litersNum, addedAt: new Date().toISOString() }
                      const next = [tank, ...tanks]
                      setTanks(next); saveTanks(next); setNewTank({ name: '', liters: '' })
                    }}
                    className="inv-tank-form"
                  >
                    <input className="form-input" placeholder="Tank name (e.g., Main Tank A)"
                      value={newTank.name}
                      onChange={(e) => setNewTank(v => ({ ...v, name: e.target.value }))}
                    />
                    <input className="form-input" placeholder="Liters" inputMode="decimal"
                      value={newTank.liters}
                      onChange={(e) => setNewTank(v => ({ ...v, liters: e.target.value.replace(/[^\d.]/g, '') }))}
                    />
                    <button
                      type="button"
                      className="submit-btn"
                      onClick={() => {
                        const name = String(newTank.name || '').trim()
                        const litersNum = Number.parseFloat(String(newTank.liters ?? ''))
                        if (!name || !Number.isFinite(litersNum) || litersNum < 0) {
                          return
                        }
                        const tank = { id: Date.now(), name, liters: litersNum, addedAt: new Date().toISOString() }
                        const next = [tank, ...tanks]
                        setTanks(next); saveTanks(next); setNewTank({ name: '', liters: '' })
                      }}
                    >
                      Add Tank
                    </button>
                  </form>
                  <div className="orders-table-wrap">
                    <table className="orders-table">
                      <thead>
                        <tr><th>Name</th><th className="num">Liters</th><th>Added</th><th className="num">Actions</th></tr>
                      </thead>
                      <tbody>
                        {tanks.length === 0 ? (
                          <tr><td colSpan="4" className="muted" style={{ padding: 16 }}>No tanks yet</td></tr>
                        ) : tanks.map(t => (
                          <tr key={t.id}>
                            <td>
                              {editingTankId === t.id ? (
                                <input
                                  className="form-input"
                                  style={{ minHeight: 40, padding: '10px 12px' }}
                                  value={tempTank.name}
                                  onChange={(e) => setTempTank(v => ({ ...v, name: e.target.value }))}
                                  placeholder="Tank name"
                                />
                              ) : t.name}
                            </td>
                            <td className="num">
                              {editingTankId === t.id ? (
                                <input
                                  className="form-input"
                                  style={{ minHeight: 40, padding: '10px 12px', textAlign: 'right' }}
                                  value={tempTank.liters}
                                  onChange={(e) => setTempTank(v => ({ ...v, liters: e.target.value.replace(/[^\d.]/g, '') }))}
                                  inputMode="decimal"
                                  placeholder="Liters"
                                />
                              ) : `${Number(t.liters || 0).toLocaleString()} L`}
                            </td>
                            <td>{new Date(t.addedAt).toLocaleString()}</td>
                            <td className="num">
                              {editingTankId === t.id ? (
                                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                  <button
                                    className="snackbar-btn primary"
                                    onClick={() => {
                                      const name = String(tempTank.name || '').trim()
                                      const liters = Number.parseFloat(String(tempTank.liters || '0'))
                                      if (!name || !Number.isFinite(liters) || liters < 0) return
                                      const next = tanks.map(x => x.id === t.id ? { ...x, name, liters } : x)
                                      setTanks(next); saveTanks(next)
                                      setEditingTankId(null); setTempTank({ name: '', liters: '' })
                                    }}
                                  >Save</button>
                                  <button
                                    className="snackbar-btn ghost"
                                    onClick={() => { setEditingTankId(null); setTempTank({ name: '', liters: '' }) }}
                                  >Cancel</button>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                  <button
                                    className="snackbar-btn primary"
                                    onClick={() => { setEditingTankId(t.id); setTempTank({ name: t.name || '', liters: String(t.liters || '') }) }}
                                  >Edit</button>
                                  <button className="snackbar-btn ghost" onClick={() => {
                                    const next = tanks.filter(x => x.id !== t.id); setTanks(next); saveTanks(next)
                                  }}>Delete</button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="orders-summary-bar">
                    <div className="summary-item">
                      <div className="summary-label">Total liters</div>
                      <div className="summary-value accent">
                        {Number(tanks.reduce((s, t) => s + Number(t.liters || 0), 0)).toLocaleString()} L
                      </div>
                    </div>
                  </div>
                </div>

                <div className="weekly-breakdown sales-monthly">
                  <div className="weekly-breakdown-title">Empty Water Bottles</div>
                  <div className="inv-bottle-grid">
                    {bottleSizes.map(s => {
                      const rec = bottles[s.id] || { qty: 0, price: 0 }
                      const isEditing = editingBottle === s.id
                      return (
                        <div key={s.id} className="inv-bottle-card">
                          <div className="inv-bottle-title">{s.label}</div>
                          <div className="inv-qty-wrap">
                            <label className="inv-qty-label">Quantity</label>
                            <input
                              className="form-input inv-qty-input"
                              inputMode="numeric"
                              disabled={!isEditing}
                              value={isEditing ? tempBottleQty : rec.qty}
                              onChange={(e) => setTempBottleQty(String(e.target.value).replace(/\D/g, ''))}
                              placeholder="Enter quantity"
                            />
                          </div>
                          <div className="inv-bottle-badges">
                            <span className="badge cash">Available {rec.qty}</span>
                          </div>
                          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                            {!isEditing ? (
                              <button
                                type="button"
                                className="snackbar-btn primary"
                                onClick={() => {
                                  setEditingBottle(s.id)
                                  setTempBottleQty(String(rec.qty || 0))
                                }}
                              >
                                Edit
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="snackbar-btn primary"
                                onClick={() => {
                                  const n = Number.parseInt(String(tempBottleQty || '0'), 10) || 0
                                  const next = { ...bottles, [s.id]: { ...rec, qty: Math.max(0, n) } }
                                  setBottles(next); saveBottles(next)
                                  setEditingBottle(null)
                                  setTempBottleQty('')
                                }}
                              >
                                Save
                              </button>
                            )}
                            <button
                              type="button"
                              className="snackbar-btn ghost"
                              onClick={() => {
                                setEditingBottle(null)
                                setTempBottleQty('')
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div className="orders-summary-bar sales-monthly-total" style={{ marginTop: 12 }}>
                    <div className="summary-item">
                      <div className="summary-label">Total bottles</div>
                      <div className="summary-value accent">
                        {Object.values(bottles || {}).reduce((s, r) => s + Number((r||{}).qty || 0), 0)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {activeView === 'settings' && (
              <div className="view-content">
                <div className="weekly-header">
                  <div>
                    <h2>Settings</h2>
                    <p className="weekly-subtitle">Edit prices for water and empty bottles</p>
                  </div>
                </div>
                <div className="weekly-breakdown" style={{ marginBottom: 16 }}>
                  <div className="weekly-breakdown-title">Water Refill Prices (KSh)</div>
                  <div className="inv-bottle-grid">
                    {[
                      { id: '20l', label: '20L Water' },
                      { id: '10l', label: '10L Water' },
                      { id: '5l', label: '5L Water' },
                      { id: '2l', label: '2L Water' },
                      { id: '1.5l', label: '1.5L Water' },
                      { id: '1l', label: '1L Water' },
                      { id: '500ml', label: '500ml Water' },
                    ].map(p => (
                      <div key={p.id} className="inv-bottle-card">
                        <div className="inv-bottle-title">{p.label}</div>
                        <div className="inv-qty-wrap">
                          <label className="inv-qty-label">Price (KSh)</label>
                          <input
                            className="form-input inv-qty-input"
                            inputMode="numeric"
                            disabled={editingProductId !== p.id}
                            value={editingProductId === p.id ? tempProductPrice : (productPrices[p.id] ?? 0)}
                            onChange={(e) => setTempProductPrice(String(e.target.value).replace(/\D/g, ''))}
                          />
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                          {editingProductId === p.id ? (
                            <button
                              type="button"
                              className="snackbar-btn primary"
                              onClick={() => {
                                const n = Number.parseInt(String(tempProductPrice || '0'), 10) || 0
                                const next = { ...productPrices, [p.id]: n }
                                setProductPrices(next); saveProductPrices(next)
                                setEditingProductId(null); setTempProductPrice('')
                              }}
                            >Save</button>
                          ) : (
                            <button
                              type="button"
                              className="snackbar-btn primary"
                              onClick={() => {
                                setEditingProductId(p.id)
                                setTempProductPrice(String(productPrices[p.id] ?? 0))
                              }}
                            >Edit</button>
                          )}
                          <button
                            type="button"
                            className="snackbar-btn ghost"
                            onClick={() => {
                              setEditingProductId(null)
                              setTempProductPrice('')
                            }}
                          >Cancel</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="weekly-breakdown">
                  <div className="weekly-breakdown-title">Empty Bottle Prices (KSh)</div>
                  <div className="inv-bottle-grid">
                    {bottleSizes.map(s => {
                      const rec = bottles[s.id] || { qty: 0, price: 0 }
                      return (
                        <div key={s.id} className="inv-bottle-card">
                          <div className="inv-bottle-title">{s.label}</div>
                          <div className="inv-qty-wrap">
                            <label className="inv-qty-label">Price (KSh)</label>
                            <input
                              className="form-input inv-qty-input"
                              inputMode="numeric"
                              disabled={editingBottlePriceId !== s.id}
                              value={editingBottlePriceId === s.id ? tempBottlePrice : (rec.price || 0)}
                              onChange={(e) => setTempBottlePrice(String(e.target.value).replace(/\D/g, ''))}
                            />
                          </div>
                          <div className="inv-bottle-badges">
                            <span className="badge cash">Available {rec.qty || 0}</span>
                          </div>
                          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                            {editingBottlePriceId === s.id ? (
                              <button
                                type="button"
                                className="snackbar-btn primary"
                                onClick={() => {
                                  const n = Number.parseInt(String(tempBottlePrice || '0'), 10) || 0
                                  const next = { ...bottles, [s.id]: { ...rec, price: n } }
                                  setBottles(next); saveBottles(next)
                                  setEditingBottlePriceId(null); setTempBottlePrice('')
                                }}
                              >Save</button>
                            ) : (
                              <button
                                type="button"
                                className="snackbar-btn primary"
                                onClick={() => {
                                  setEditingBottlePriceId(s.id)
                                  setTempBottlePrice(String(rec.price || 0))
                                }}
                              >Edit</button>
                            )}
                            <button
                              type="button"
                              className="snackbar-btn ghost"
                              onClick={() => { setEditingBottlePriceId(null); setTempBottlePrice('') }}
                            >Cancel</button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
            {activeView === 'reports' && (
              <div className="view-content weekly-summary-view">
                {(() => {
                  const now = new Date()
                  // helpers to aggregate empty bottle sales
                  const aggregateBottles = (start, end) => {
                    const startKey = toLocalDateKey(start)
                    const endKey = toLocalDateKey(end)
                    const bySize = new Map()
                    let totalRevenue = 0
                    let count = 0
                    for (const o of orders) {
                      const k = (o.dateKey || toLocalDateKey(o.timestamp))
                      if (!k || k < startKey || k > endKey) continue
                      if ((o.status || 'Pending') !== 'Paid') continue
                      const qty = Number(o.emptyBottleQty || 0)
                      if (!o.emptyBottleSize || qty <= 0) continue
                      const size = o.emptyBottleSize
                      const prev = bySize.get(size) || { qty: 0, amount: 0 }
                      const amt = Number(o.emptyBottleAmount || 0)
                      bySize.set(size, { qty: prev.qty + qty, amount: prev.amount + amt })
                      totalRevenue += amt; count += qty
                    }
                    return { bySize, totalRevenue, count }
                  }
                  const sumPaidByMethodTotal = (start, end) => {
                    const r = sumPaidByMethod(start, end)
                    return r
                  }
                  const litersSold = (start, end) => {
                    const startKey = toLocalDateKey(start)
                    const endKey = toLocalDateKey(end)
                    const litersMap = { '20l': 20, '10l': 10, '5l': 5, '2l': 2, '1.5l': 1.5, '1l': 1, '500ml': 0.5 }
                    let liters = 0
                    for (const o of orders) {
                      const k = (o.dateKey || toLocalDateKey(o.timestamp))
                      if (!k || k < startKey || k > endKey) continue
                      if ((o.status || 'Pending') !== 'Paid') continue
                      const perUnit = Number(litersMap[o.productId] || 0)
                      const qty = Number(o.quantity || 0)
                      liters += perUnit * qty
                    }
                    return liters
                  }
                  // Daily
                  const todayStart = new Date(now); todayStart.setHours(0,0,0,0)
                  const todayEnd = new Date(now); todayEnd.setHours(23,59,59,999)
                  const dailyPay = sumPaidByMethodTotal(todayStart, todayEnd)
                  const dailyBottles = aggregateBottles(todayStart, todayEnd)
                  const dailyLiters = litersSold(todayStart, todayEnd)
                  // Weekly
                  const weekStart = getStartOfWeek(now)
                  const weekEnd = addDays(weekStart, 6)
                  const weeklyPay = sumPaidByMethodTotal(weekStart, weekEnd)
                  const weeklyBottles = aggregateBottles(weekStart, weekEnd)
                  const weeklyLiters = litersSold(weekStart, weekEnd)
                  // Monthly
                  const { start: monthStart, end: monthEnd } = getMonthRange(now)
                  const monthlyPay = sumPaidByMethodTotal(monthStart, monthEnd)
                  const monthlyBottles = aggregateBottles(monthStart, monthEnd)
                  const monthlyLiters = litersSold(monthStart, monthEnd)

                  const bottleLabel = (id) => {
                    const m = {
                      '20l-bottle': '20L bottle',
                      '10l-bottle': '10L bottle',
                      '5l-bottle': '5L bottle',
                      '1l-bottle': '1L bottle',
                      '500ml-bottle': '500ml bottle',
                    }
                    return m[id] || id
                  }

                  const renderBottleGrid = (bySize) => (
                    <div className="weekly-breakdown-grid report-bottle-grid">
                      {Array.from(bySize.entries()).map(([id, v]) => (
                        <div key={id} className="week-day">
                          <div className="week-day-label">{bottleLabel(id)}</div>
                          <div className="week-day-value">{v.qty} pcs</div>
                          <div className="week-day-hint">Amount {formatKsh(v.amount)}</div>
                        </div>
                      ))}
                      {bySize.size === 0 ? (
                        <div className="week-day" style={{ gridColumn: '1 / -1' }}>
                          <div className="week-day-label">No empty bottle sales</div>
                          <div className="week-day-hint">No data for this period</div>
                        </div>
                      ) : null}
                    </div>
                  )

                  return (
                    <>
                      <div className="weekly-header">
                        <div>
                          <h2>Reports</h2>
                          <p className="weekly-subtitle">Daily, Weekly, Monthly: empty bottles sold and sales totals</p>
                        </div>
                      </div>

                      {/* Daily report */}
                      <div className="weekly-cards">
                        <div className="weekly-card">
                          <div className="weekly-card-label">Daily Sales Total</div>
                          <div className="weekly-card-value accent">{formatKsh(dailyPay.total)}</div>
                          <div className="weekly-card-hint">Cash {formatKsh(dailyPay.cash)} • MPESA {formatKsh(dailyPay.mpesa)}</div>
                        </div>
                        <div className="weekly-card">
                          <div className="weekly-card-label">Liters Sold (Today)</div>
                          <div className="weekly-card-value">{Number(dailyLiters).toLocaleString()} L</div>
                          <div className="weekly-card-hint">Paid orders only</div>
                        </div>
                        <div className="weekly-card">
                          <div className="weekly-card-label">Empty Bottles Sold (Today)</div>
                          <div className="weekly-card-value">{dailyBottles.count}</div>
                          <div className="weekly-card-hint">Amount {formatKsh(dailyBottles.totalRevenue)}</div>
                        </div>
                      </div>
                      <div className="weekly-breakdown">
                        <div className="weekly-breakdown-title">By Bottle Size (Today)</div>
                        {renderBottleGrid(dailyBottles.bySize)}
                      </div>

                      {/* Weekly report */}
                      <div className="weekly-cards" style={{ marginTop: 16 }}>
                        <div className="weekly-card">
                          <div className="weekly-card-label">Weekly Sales Total</div>
                          <div className="weekly-card-value accent">{formatKsh(weeklyPay.total)}</div>
                          <div className="weekly-card-hint">Cash {formatKsh(weeklyPay.cash)} • MPESA {formatKsh(weeklyPay.mpesa)}</div>
                        </div>
                        <div className="weekly-card">
                          <div className="weekly-card-label">Liters Sold (Week)</div>
                          <div className="weekly-card-value">{Number(weeklyLiters).toLocaleString()} L</div>
                          <div className="weekly-card-hint">Paid orders only</div>
                        </div>
                        <div className="weekly-card">
                          <div className="weekly-card-label">Empty Bottles Sold (Week)</div>
                          <div className="weekly-card-value">{weeklyBottles.count}</div>
                          <div className="weekly-card-hint">Amount {formatKsh(weeklyBottles.totalRevenue)}</div>
                        </div>
                      </div>
                      <div className="weekly-breakdown">
                        <div className="weekly-breakdown-title">By Bottle Size (Week)</div>
                        {renderBottleGrid(weeklyBottles.bySize)}
                      </div>

                      {/* Monthly report */}
                      <div className="weekly-cards" style={{ marginTop: 16 }}>
                        <div className="weekly-card">
                          <div className="weekly-card-label">Monthly Sales Total</div>
                          <div className="weekly-card-value accent">{formatKsh(monthlyPay.total)}</div>
                          <div className="weekly-card-hint">Cash {formatKsh(monthlyPay.cash)} • MPESA {formatKsh(monthlyPay.mpesa)}</div>
                        </div>
                        <div className="weekly-card">
                          <div className="weekly-card-label">Liters Sold (Month)</div>
                          <div className="weekly-card-value">{Number(monthlyLiters).toLocaleString()} L</div>
                          <div className="weekly-card-hint">Paid orders only</div>
                        </div>
                        <div className="weekly-card">
                          <div className="weekly-card-label">Empty Bottles Sold (Month)</div>
                          <div className="weekly-card-value">{monthlyBottles.count}</div>
                          <div className="weekly-card-hint">Amount {formatKsh(monthlyBottles.totalRevenue)}</div>
                        </div>
                      </div>
                      <div className="weekly-breakdown">
                        <div className="weekly-breakdown-title">By Bottle Size (Month)</div>
                        {renderBottleGrid(monthlyBottles.bySize)}
                      </div>
                    </>
                  )
                })()}
              </div>
            )}
            {activeView === 'profile' && (
              <div className="view-content">
                <div className="weekly-header">
                  <div>
                    <h2>Admin Profile</h2>
                    <p className="weekly-subtitle">Update username and password</p>
                  </div>
                </div>

                <form
                  className="refill-form"
                  onSubmit={(e) => {
                    e.preventDefault()
                    setProfileMsg('')
                    const nextUsername = String(profileForm.username || '').trim()
                    if (!nextUsername) {
                      setProfileMsg('Username is required.')
                      return
                    }
                    try {
                      const raw = localStorage.getItem(ADMIN_AUTH_KEY)
                      const desiredPassword = String(profileForm.newPassword || '')
                      if (raw) {
                        const saved = JSON.parse(raw)
                        if (saved && typeof saved === 'object') {
                          const currentPass = String(saved.password || '')
                          const updated = {
                            username: nextUsername,
                            password: desiredPassword || currentPass,
                          }
                          localStorage.setItem(ADMIN_AUTH_KEY, JSON.stringify(updated))
                        } else {
                          localStorage.setItem(ADMIN_AUTH_KEY, JSON.stringify({
                            username: nextUsername,
                            password: desiredPassword || String(profileForm.currentPassword || ''),
                          }))
                        }
                      } else {
                        // First-time setup if no admin credentials exist yet
                        localStorage.setItem(ADMIN_AUTH_KEY, JSON.stringify({
                          username: nextUsername,
                          password: desiredPassword || String(profileForm.currentPassword || ''),
                        }))
                      }
                      onProfileUpdate?.({ username: nextUsername })
                      setProfileForm(p => ({ ...p, currentPassword: '', newPassword: '', confirmPassword: '' }))
                      setProfileMsg('Profile updated successfully.')
                    } catch {
                      setProfileMsg('Failed to update profile.')
                    }
                  }}
                >
                  <div className="form-row">
                    <div className="form-group">
                      <label>Username</label>
                      <input
                        className="form-input"
                        disabled={!editingProfile}
                        value={profileForm.username}
                        onChange={(e) => setProfileForm(p => ({ ...p, username: e.target.value }))}
                        placeholder="Admin username"
                      />
                    </div>
                    <div className="form-group">
                      <label>Current Password</label>
                      <input
                        type="password"
                        className="form-input"
                        disabled={!editingProfile}
                        value={profileForm.currentPassword}
                        onChange={(e) => setProfileForm(p => ({ ...p, currentPassword: e.target.value }))}
                        placeholder="Enter current password"
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>New Password</label>
                      <input
                        type="password"
                        className="form-input"
                        disabled={!editingProfile}
                        value={profileForm.newPassword}
                        onChange={(e) => setProfileForm(p => ({ ...p, newPassword: e.target.value }))}
                        placeholder="Leave blank to keep current"
                      />
                    </div>
                    <div className="form-group">
                      <label>Confirm New Password</label>
                      <input
                        type="password"
                        className="form-input"
                        disabled={!editingProfile}
                        value={profileForm.confirmPassword}
                        onChange={(e) => setProfileForm(p => ({ ...p, confirmPassword: e.target.value }))}
                        placeholder="Repeat new password"
                      />
                    </div>
                  </div>
                  {profileMsg ? (
                    <div className="orders-subtitle" style={{ marginTop: -6 }}>{profileMsg}</div>
                  ) : null}
                  <div style={{ display: 'flex', gap: 10 }}>
                    {!editingProfile ? (
                      <button
                        type="button"
                        className="submit-btn"
                        onClick={() => {
                          setEditingProfile(true)
                          setProfileMsg('')
                        }}
                      >
                        Edit
                      </button>
                    ) : (
                      <button type="submit" className="submit-btn">Save Profile</button>
                    )}
                    <button
                      type="button"
                      className="snackbar-btn ghost"
                      onClick={() => {
                        setProfileForm({
                          username: admin?.username || '',
                          currentPassword: '',
                          newPassword: '',
                          confirmPassword: '',
                        })
                        setEditingProfile(false)
                        setProfileMsg('')
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

export default AdminDashboard
