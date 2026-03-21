import React, { useEffect, useRef, useState } from 'react'
import logo from '@src/assets/logo.png'
import mpesaIcon from '@src/assets/mpesa.png'
import cashIcon from '@src/assets/cash.png'
import './Dashboard.css'
import { CLOUD_KEYS, loadCloudState, saveCloudState, subscribeToAppStateChanges } from '@src/lib/cloudStore'

const ORDERS_KEY = 'creekFreshOrdersV1'
const ORDERS_BACKUP_KEY = 'creekFreshOrdersBackupV1'
const ORDERS_SESSION_KEY = 'creekFreshOrdersSessionV1'
const ARCHIVE_KEY = 'creekFreshOrderArchiveV1' // optional: used if present in localStorage (even if archiving is disabled)
const TANKS_KEY = 'creekFreshInvTanksV1'
const BOTTLES_KEY = 'creekFreshInvBottlesV1'

const UserDashboard = ({ user, onLogout }) => {
  const [activeView, setActiveView] = useState('new-refill')
  const [darkMode, setDarkMode] = useState(() => {
    try {
      return localStorage.getItem('creekFreshDarkMode') === 'true'
    } catch {
      return false
    }
  })
  const [formData, setFormData] = useState({
    product: '',
    quantity: '',
    paymentMethod: '',
    emptyBottleSize: '',
    emptyBottleQty: ''
  })
  const [orders, setOrders] = useState([])
  const [pendingOrder, setPendingOrder] = useState(null)
  const snackbarTimerRef = useRef(null)
  const ordersLoadedRef = useRef(false)
  const initialCloudSyncDoneRef = useRef(false)
  const mainScrollRef = useRef(null)
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    variant: 'info', // info | success | warning | error
  })

  const products = [
    { id: '20l', name: '20L Water', price: 150 },
    { id: '10l', name: '10L Water', price: 80 },
    { id: '5l', name: '5L Water', price: 40 },
    { id: '2l', name: '2L Water', price: 20 },
    { id: '1.5l', name: '1.5L Water', price: 15 },
    { id: '1l', name: '1L Water', price: 10 },
    { id: '500ml', name: '500ml Water', price: 10 }
  ]

  const [productPrices, setProductPrices] = useState(null) // admin overrides

  const bottleSizes = [
    { id: '20l-bottle', name: '20L Empty Bottle' },
    { id: '10l-bottle', name: '10L Empty Bottle' },
    { id: '5l-bottle', name: '5L Empty Bottle' },
    { id: '1l-bottle', name: '1L Empty Bottle' },
    { id: '500ml-bottle', name: '500ml Empty Bottle' },
  ]

  const [bottlePricing, setBottlePricing] = useState({})
  const defaultBottlePricing = {
    '20l-bottle': { qty: 0, price: 300 },
    '10l-bottle': { qty: 0, price: 200 },
    '5l-bottle': { qty: 0, price: 120 },
    '1l-bottle': { qty: 0, price: 60 },
    '500ml-bottle': { qty: 0, price: 30 },
  }

  const formatKsh = (amount) => `KSh ${Number(amount || 0).toLocaleString()}`

  const parseStoredOrders = (raw) => {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : null
    } catch {
      return null
    }
  }

  const loadBestLocalOrdersSnapshot = () => {
    try {
      const primary = parseStoredOrders(localStorage.getItem(ORDERS_KEY) || 'null') || []
      const backup = parseStoredOrders(localStorage.getItem(ORDERS_BACKUP_KEY) || 'null') || []
      const session = parseStoredOrders(sessionStorage.getItem(ORDERS_SESSION_KEY) || 'null') || []
      const candidates = [primary, backup, session]
      const best = candidates.reduce((acc, cur) => (cur.length > acc.length ? cur : acc), [])
      return best
    } catch {
      return []
    }
  }

  const toLocalDateKey = (d) => {
    // YYYY-MM-DD in the user's local timezone
    return new Date(d).toLocaleDateString('en-CA')
  }

  const getOrderDateKey = (order) => {
    if (!order || typeof order !== 'object') return null
    if (typeof order.dateKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(order.dateKey)) {
      return order.dateKey
    }
    if (order.timestamp) {
      const k = toLocalDateKey(order.timestamp)
      if (k && k !== 'Invalid Date') return k
    }
    if (order.date) {
      const k = toLocalDateKey(order.date)
      if (k && k !== 'Invalid Date') return k
    }
    if (order.dateTime) {
      const k = toLocalDateKey(order.dateTime)
      if (k && k !== 'Invalid Date') return k
    }
    return null
  }

  const getOrderTimeValue = (order) => {
    const candidates = [order?.timestamp, order?.dateTime, order?.date]
    for (const value of candidates) {
      if (!value) continue
      const t = new Date(value).getTime()
      if (Number.isFinite(t)) return t
    }
    return 0
  }

  const getOrderUsername = (order) => {
    const raw = order?.username ?? order?.customerName ?? order?.customer ?? ''
    return String(raw).trim().toLowerCase()
  }

  const currentUsername = String(user?.name || '').trim().toLowerCase()
  const isOrderForCurrentUser = (order) => {
    if (!currentUsername) return true
    return getOrderUsername(order) === currentUsername
  }

  const getStartOfWeek = (date) => {
    // Monday-start week
    const d = new Date(date)
    d.setHours(0, 0, 0, 0)
    const day = d.getDay() // 0=Sun..6=Sat
    const diff = (day === 0 ? -6 : 1 - day)
    d.setDate(d.getDate() + diff)
    return d
  }

  const addDays = (date, days) => {
    const d = new Date(date)
    d.setDate(d.getDate() + days)
    return d
  }

  const loadArchivedOrdersFlat = () => {
    try {
      const raw = localStorage.getItem(ARCHIVE_KEY)
      if (!raw) return []
      const parsed = JSON.parse(raw)
      if (!parsed || typeof parsed !== 'object') return []
      const out = []
      for (const v of Object.values(parsed)) {
        if (Array.isArray(v)) out.push(...v)
      }
      return out
    } catch {
      return []
    }
  }

  const toSafeInt = (value) => {
    const n = Number.parseInt(String(value ?? ''), 10)
    if (!Number.isFinite(n)) return 0
    return Math.max(0, n)
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: name === 'quantity' ? value.replace(/[^\d]/g, '') : value
    }))
  }

  const effectiveProducts = (productPrices
    ? products.map(p => ({ ...p, price: Number(productPrices[p.id] ?? p.price) }))
    : products
  )

  const selectedProduct = effectiveProducts.find(p => p.id === formData.product) || null
  const quantityInt = toSafeInt(formData.quantity)
  const emptyBottleQtyInt = toSafeInt(formData.emptyBottleQty)
  const emptyBottleRec = bottlePricing[formData.emptyBottleSize] || { price: 0 }
  const refillAmount = selectedProduct && quantityInt > 0 ? selectedProduct.price * quantityInt : 0
  const emptyBottleAmount = formData.emptyBottleSize && emptyBottleQtyInt > 0 ? (Number(emptyBottleRec.price || 0) * emptyBottleQtyInt) : 0
  const totalAmount = refillAmount + emptyBottleAmount

  useEffect(() => {
    try {
      localStorage.setItem('creekFreshDarkMode', String(darkMode))
    } catch {
      // ignore
    }
  }, [darkMode])

  // Load dynamic water prices from admin settings
  useEffect(() => {
    try {
      const raw = localStorage.getItem('creekFreshProductPricesV1')
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') setProductPrices(parsed)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    let alive = true
    const syncCloud = async () => {
      const localBest = loadBestLocalOrdersSnapshot()
      const [cloudOrders, cloudBottles, cloudPrices] = await Promise.all([
        loadCloudState(CLOUD_KEYS.orders),
        loadCloudState(CLOUD_KEYS.bottles),
        loadCloudState(CLOUD_KEYS.productPrices),
      ])
      if (!alive) return
      if (Array.isArray(cloudOrders) && cloudOrders.length > 0) {
        setOrders(cloudOrders.map(o => ({ status: 'Pending', ...o })))
        try {
          const payload = JSON.stringify(cloudOrders)
          localStorage.setItem(ORDERS_KEY, payload)
          localStorage.setItem(ORDERS_BACKUP_KEY, payload)
          sessionStorage.setItem(ORDERS_SESSION_KEY, payload)
        } catch {
          // ignore
        }
        ordersLoadedRef.current = true
      } else if (Array.isArray(localBest) && localBest.length > 0) {
        // Cloud is empty but we still have local backup/session orders: restore cloud from local best snapshot.
        setOrders(localBest.map(o => ({ status: 'Pending', ...o })))
        try {
          const payload = JSON.stringify(localBest)
          localStorage.setItem(ORDERS_KEY, payload)
          localStorage.setItem(ORDERS_BACKUP_KEY, payload)
          sessionStorage.setItem(ORDERS_SESSION_KEY, payload)
        } catch {
          // ignore
        }
        saveCloudState(CLOUD_KEYS.orders, localBest).catch(() => {})
        ordersLoadedRef.current = true
      }
      if (cloudBottles && typeof cloudBottles === 'object') {
        const next = { ...defaultBottlePricing, ...cloudBottles }
        setBottlePricing(next)
        try { localStorage.setItem(BOTTLES_KEY, JSON.stringify(next)) } catch {}
      }
      if (cloudPrices && typeof cloudPrices === 'object') {
        setProductPrices(cloudPrices)
        try { localStorage.setItem('creekFreshProductPricesV1', JSON.stringify(cloudPrices)) } catch {}
      }

      // If cloud had no orders and local also didn't load valid orders,
      // allow future writes now (prevents startup empty-overwrite race).
      initialCloudSyncDoneRef.current = true
      if (!ordersLoadedRef.current) {
        ordersLoadedRef.current = true
      }
    }
    syncCloud().catch(() => {})
    return () => { alive = false }
  }, [])

  // Realtime: keep local UI in sync with cloud changes from other devices/admin.
  useEffect(() => {
    const unsubscribe = subscribeToAppStateChanges((p) => {
      const row = p?.new
      const key = row?.key
      if (!key) return

      if (key === CLOUD_KEYS.orders) {
        const nextOrders = Array.isArray(row.payload) ? row.payload : null
        if (!nextOrders) return

        const next = nextOrders.map(o => ({ status: 'Pending', ...o }))
        setOrders(next)
        try {
          const payload = JSON.stringify(nextOrders)
          localStorage.setItem(ORDERS_KEY, payload)
          localStorage.setItem(ORDERS_BACKUP_KEY, payload)
          sessionStorage.setItem(ORDERS_SESSION_KEY, payload)
        } catch {}
      }

      if (key === CLOUD_KEYS.bottles) {
        const nextBottles = row.payload && typeof row.payload === 'object' ? row.payload : null
        if (!nextBottles) return
        const next = { ...defaultBottlePricing, ...nextBottles }
        setBottlePricing(next)
        try { localStorage.setItem(BOTTLES_KEY, JSON.stringify(next)) } catch {}
      }

      if (key === CLOUD_KEYS.productPrices) {
        const nextPrices = row.payload && typeof row.payload === 'object' ? row.payload : null
        if (!nextPrices) return
        setProductPrices(nextPrices)
        try { localStorage.setItem('creekFreshProductPricesV1', JSON.stringify(nextPrices)) } catch {}
      }
    })

    return () => { unsubscribe?.() }
  }, [])
  useEffect(() => {
    try {
      const raw = localStorage.getItem(BOTTLES_KEY)
      if (!raw) {
        // seed defaults (no quantities yet)
        localStorage.setItem(BOTTLES_KEY, JSON.stringify(defaultBottlePricing))
        setBottlePricing(defaultBottlePricing)
        return
      }
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        setBottlePricing({ ...defaultBottlePricing, ...parsed })
      }
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    try {
      const parsed = loadBestLocalOrdersSnapshot()
      if (!Array.isArray(parsed) || parsed.length === 0) return
      // Backfill status for older saved orders
      setOrders(parsed.map(o => ({
        status: 'Pending',
        ...o,
      })))
      const payload = JSON.stringify(parsed)
      localStorage.setItem(ORDERS_KEY, payload)
      localStorage.setItem(ORDERS_BACKUP_KEY, payload)
      sessionStorage.setItem(ORDERS_SESSION_KEY, payload)
      ordersLoadedRef.current = true
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    if (!ordersLoadedRef.current || !initialCloudSyncDoneRef.current) return
    try {
      const next = JSON.stringify(orders)
      const current = localStorage.getItem(ORDERS_KEY)
      if (current !== next) {
        localStorage.setItem(ORDERS_KEY, next)
        // keep a mirror backup and a session mirror
        localStorage.setItem(ORDERS_BACKUP_KEY, next)
        sessionStorage.setItem(ORDERS_SESSION_KEY, next)
        saveCloudState(CLOUD_KEYS.orders, orders).catch(() => {})
      }
    } catch {
      // ignore
    }
  }, [orders])

  const showSnackbar = (message, variant = 'info', autoCloseMs = 3200) => {
    if (snackbarTimerRef.current) clearTimeout(snackbarTimerRef.current)
    setSnackbar({ open: true, message, variant })
    if (autoCloseMs && autoCloseMs > 0) {
      snackbarTimerRef.current = setTimeout(() => {
        setSnackbar(s => ({ ...s, open: false }))
      }, autoCloseMs)
    }
  }

  useEffect(() => {
    return () => {
      if (snackbarTimerRef.current) clearTimeout(snackbarTimerRef.current)
    }
  }, [])

  // Keep section content pinned to top on load and on tab/view changes
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

  const handleClickCapture = (e) => {
    const t = e.target
    if (!(t instanceof Element)) return
    if (!t.closest('button, a, [role="button"]')) return
    const el = mainScrollRef.current
    if (!el) return
    requestAnimationFrame(() => {
      el.scrollTo({ top: 0, behavior: 'auto' })
    })
  }

  const handleSubmit = (e) => {
    e.preventDefault()

    if (!selectedProduct) {
      showSnackbar('Please select a product.', 'warning')
      return
    }

    if (quantityInt <= 0) {
      showSnackbar('Please enter a valid quantity (at least 1).', 'warning')
      return
    }
    
    // Get current date and time
    const now = new Date()
    const date = now.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
    const time = now.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    })
    const dateTime = `${date} at ${time}`
    
    // Create sale record with all information
    const saleRecord = {
      id: Date.now(), // Unique ID based on timestamp
      product: selectedProduct.name,
      productId: formData.product,
      quantity: quantityInt,
      unitPrice: selectedProduct.price,
      totalAmount: totalAmount,
      paymentMethod: formData.paymentMethod,
      status: 'Pending',
      date: date,
      time: time,
      dateTime: dateTime,
      timestamp: now.toISOString(),
      dateKey: now.toLocaleDateString('en-CA'),
      // Username/name of the customer who made the order (used by admin views).
      username: user.name,
      // Backward compatibility for already saved orders in localStorage/Supabase.
      customerName: user.name,
      emptyBottleSize: formData.emptyBottleSize || '',
      emptyBottleQty: emptyBottleQtyInt,
      emptyBottleAmount: emptyBottleAmount
    }

    // Ask for confirmation via snackbar before recording
    setPendingOrder(saleRecord)
    showSnackbar(
      `Proceed to record: ${saleRecord.product} × ${saleRecord.quantity} • ${formatKsh(saleRecord.totalAmount)} • ${saleRecord.paymentMethod.toUpperCase()}`,
      'info',
      0,
    )
  }

  const proceedRecordPendingOrder = () => {
    if (!pendingOrder) return
    // Persist immediately to avoid data loss on quick refresh/logout
    // Also decrement inventories: water liters and empty bottle stock
    try {
      const litersMap = { '20l': 20, '10l': 10, '5l': 5, '2l': 2, '1.5l': 1.5, '1l': 1, '500ml': 0.5 }
      const need = Number(litersMap[pendingOrder.productId] || 0) * Number(pendingOrder.quantity || 0)
      if (need > 0) {
        const rawT = localStorage.getItem(TANKS_KEY)
        if (rawT) {
          const arr = JSON.parse(rawT)
          if (Array.isArray(arr)) {
            let remaining = need
            const nextT = arr.map(t => ({ ...t }))
            for (const t of nextT) {
              if (remaining <= 0) break
              const take = Math.min(Number(t.liters || 0), remaining)
              t.liters = Math.max(0, Number(t.liters || 0) - take)
              remaining -= take
            }
            localStorage.setItem(TANKS_KEY, JSON.stringify(nextT))
            saveCloudState(CLOUD_KEYS.tanks, nextT).catch(() => {})
          }
        }
      }
      if (pendingOrder.emptyBottleSize && Number(pendingOrder.emptyBottleQty || 0) > 0) {
        const rawB = localStorage.getItem(BOTTLES_KEY)
        const obj = rawB ? JSON.parse(rawB) : {}
        const rec = obj[pendingOrder.emptyBottleSize] || { qty: 0, price: 0 }
        rec.qty = Math.max(0, Number(rec.qty || 0) - Number(pendingOrder.emptyBottleQty || 0))
        obj[pendingOrder.emptyBottleSize] = rec
        localStorage.setItem(BOTTLES_KEY, JSON.stringify(obj))
        saveCloudState(CLOUD_KEYS.bottles, obj).catch(() => {})
      }
    } catch {}

    setOrders(prev => {
      const next = [pendingOrder, ...prev]
      try {
        const payload = JSON.stringify(next)
        localStorage.setItem(ORDERS_KEY, payload)
        localStorage.setItem(ORDERS_BACKUP_KEY, payload)
        sessionStorage.setItem(ORDERS_SESSION_KEY, payload)
        saveCloudState(CLOUD_KEYS.orders, next).catch(() => {})
      } catch {
        // ignore
      }
      return next
    })
    setPendingOrder(null)
    setSnackbar(s => ({ ...s, open: false }))

    // Reset form after recording
    setFormData({
      product: '',
      quantity: '',
      paymentMethod: ''
    })

    showSnackbar('Order recorded in My Orders.', 'success', 2400)
  }

  const cancelPendingOrder = () => {
    setPendingOrder(null)
    setSnackbar(s => ({ ...s, open: false }))
    showSnackbar('Order cancelled.', 'warning', 2000)
  }

  const setOrderStatus = (orderId, status) => {
    const next = status === 'Paid' ? 'Paid' : 'Pending'
    setOrders(prev => {
      const updated = prev.map(o => (o.id === orderId ? { ...o, status: next } : o))
      try {
        const payload = JSON.stringify(updated)
        localStorage.setItem(ORDERS_KEY, payload)
        localStorage.setItem(ORDERS_BACKUP_KEY, payload)
        sessionStorage.setItem(ORDERS_SESSION_KEY, payload)
        saveCloudState(CLOUD_KEYS.orders, updated).catch(() => {})
      } catch {
        // ignore
      }
      return updated
    })
  }

  const deleteOrder = (order) => {
    if (!order) return
    const ok = window.confirm('Delete this order? Inventory will be restored.')
    if (!ok) return

    // Restore inventory (tanks liters + empty bottle stock) based on the order.
    try {
      const litersMap = { '20l': 20, '10l': 10, '5l': 5, '2l': 2, '1.5l': 1.5, '1l': 1, '500ml': 0.5 }
      const qty = Number(order.quantity || 0)
      const perUnitLiters = Number(litersMap[order.productId] || 0)
      const litersToAdd = perUnitLiters * qty

      if (litersToAdd > 0) {
        const rawT = localStorage.getItem(TANKS_KEY)
        if (rawT) {
          const arr = JSON.parse(rawT)
          if (Array.isArray(arr) && arr.length > 0) {
            const nextT = arr.map(t => ({ ...t }))
            // Without knowing which tank chunks were consumed originally, we add back to the first tank.
            nextT[0].liters = Number(nextT[0].liters || 0) + litersToAdd
            localStorage.setItem(TANKS_KEY, JSON.stringify(nextT))
            saveCloudState(CLOUD_KEYS.tanks, nextT).catch(() => {})
          }
        }
      }

      if (order.emptyBottleSize && Number(order.emptyBottleQty || 0) > 0) {
        const rawB = localStorage.getItem(BOTTLES_KEY)
        const obj = rawB ? JSON.parse(rawB) : {}
        const rec = obj[order.emptyBottleSize] || { qty: 0, price: Number(order.emptyBottleAmount || 0) / Math.max(1, Number(order.emptyBottleQty || 0)) }
        rec.qty = Math.max(0, Number(rec.qty || 0) + Number(order.emptyBottleQty || 0))
        obj[order.emptyBottleSize] = rec
        localStorage.setItem(BOTTLES_KEY, JSON.stringify(obj))
        saveCloudState(CLOUD_KEYS.bottles, obj).catch(() => {})
      }
    } catch {
      // ignore restore errors to avoid blocking order deletion
    }

    setOrders(prev => {
      const updated = prev.filter(o => o.id !== order.id)
      try {
        const payload = JSON.stringify(updated)
        localStorage.setItem(ORDERS_KEY, payload)
        localStorage.setItem(ORDERS_BACKUP_KEY, payload)
        sessionStorage.setItem(ORDERS_SESSION_KEY, payload)
        saveCloudState(CLOUD_KEYS.orders, updated).catch(() => {})
      } catch {
        // ignore
      }
      return updated
    })
  }

  return (
    <div
      className="dashboard-container"
      data-theme={darkMode ? 'dark' : 'light'}
      data-has-sidebar="true"
      onClickCapture={handleClickCapture}
    >
      <div className="dashboard-header">
        <div className="header-content">
          <div className="header-left">
            <div className="logo-container">
              <img className="header-logo" src={logo} alt="Creek Fresh logo" />
            </div>
            <div className="brand-divider"></div>
            <div className="user-info">
              <div className="user-greeting">Welcome back,</div>
              <h1 className="user-name">{user.name}</h1>
            </div>
          </div>
          <div className="header-center-brand">
            <span className="center-brand-typing">CREEK FRESH</span>
          </div>
          <div className="header-right">
            <div className="user-profile">
              <div className="profile-avatar">
                <span>{user.name.charAt(0).toUpperCase()}</span>
              </div>
              <div className="profile-info">
                <span className="profile-name">{user.name}</span>
                <span className="profile-role">User</span>
              </div>
            </div>
            <button onClick={onLogout} className="logout-btn">
              <span className="logout-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M10 7V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
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
              className={`nav-item ${activeView === 'new-refill' ? 'active' : ''}`}
              onClick={() => setActiveView('new-refill')}
            >
              <span className="nav-icon">💧</span>
              <span className="nav-text">New Refill Sale</span>
            </button>
            <button
              className={`nav-item ${activeView === 'my-orders' ? 'active' : ''}`}
              onClick={() => setActiveView('my-orders')}
            >
              <span className="nav-icon">📋</span>
              <span className="nav-text">My Orders</span>
            </button>
            <button
              className={`nav-item ${activeView === 'daily-summary' ? 'active' : ''}`}
              onClick={() => setActiveView('daily-summary')}
            >
              <span className="nav-icon">📈</span>
              <span className="nav-text">Daily Summary</span>
            </button>
            <button
              className={`nav-item ${activeView === 'weekly-summary' ? 'active' : ''}`}
              onClick={() => setActiveView('weekly-summary')}
            >
              <span className="nav-icon">📅</span>
              <span className="nav-text">Weekly Summary</span>
            </button>

            <button
              type="button"
              className="nav-item"
              onClick={() => setDarkMode(v => !v)}
              aria-pressed={darkMode}
            >
              <span className="nav-icon">{darkMode ? '🌙' : '☀️'}</span>
              <span className="nav-text">Dark mode</span>
            </button>
          </nav>
        </aside>

        <main className="dashboard-main" ref={mainScrollRef}>
          <div key={activeView} className="view-transition">
          {activeView === 'new-refill' && (
            <div className="view-content refill-form-container">
              <div className="form-header">
                <h2>New Refill Sale</h2>
                <p className="form-subtitle">Fill in the details to create a new refill sale</p>
              </div>

              <form onSubmit={handleSubmit} className="refill-form">
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="product">
                      Product <span className="required">*</span>
                    </label>
                    <select
                      id="product"
                      name="product"
                      value={formData.product}
                      onChange={handleInputChange}
                      className="form-select"
                      required
                    >
                      <option value="">Select a product</option>
                      {effectiveProducts.map(product => (
                        <option key={product.id} value={product.id}>
                          {product.name} - {formatKsh(product.price)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="quantity">
                      Quantity <span className="required">*</span>
                    </label>
                    <input
                      type="number"
                      id="quantity"
                      name="quantity"
                      value={formData.quantity}
                      onChange={handleInputChange}
                      className="form-input"
                      placeholder="Enter quantity"
                      min="1"
                      step="1"
                      inputMode="numeric"
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>
                    Payment Method <span className="required">*</span>
                  </label>
                  <div className="payment-options">
                    <label className="payment-option cash">
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="cash"
                        checked={formData.paymentMethod === 'cash'}
                        onChange={handleInputChange}
                        required
                      />
                      <span className="payment-label">
                        <span className="payment-icon cash-icon">
                          <img src={cashIcon} alt="Cash" />
                        </span>
                        <span>Cash</span>
                      </span>
                    </label>
                    <label className="payment-option mpesa">
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="mpesa"
                        checked={formData.paymentMethod === 'mpesa'}
                        onChange={handleInputChange}
                        required
                      />
                      <span className="payment-label">
                        <span className="payment-icon mpesa-icon">
                          <img src={mpesaIcon} alt="MPESA" />
                        </span>
                        <span>MPESA</span>
                      </span>
                    </label>
                  </div>
                </div>

                <div className="form-group">
                  <label>Empty Bottle (optional)</label>
                  <div className="form-row empty-bottle-row">
                    <select
                      className="form-select"
                      name="emptyBottleSize"
                      value={formData.emptyBottleSize}
                      onChange={handleInputChange}
                    >
                      <option value="">Select empty bottle size</option>
                      {bottleSizes.map(b => (
                        <option key={b.id} value={b.id}>
                          {b.name} {bottlePricing[b.id]?.price ? `- ${formatKsh(bottlePricing[b.id].price)}` : ''}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      className="form-input"
                      name="emptyBottleQty"
                      value={formData.emptyBottleQty}
                      onChange={handleInputChange}
                      placeholder="Qty"
                      min="0"
                      step="1"
                      inputMode="numeric"
                    />
                  </div>
                </div>

                {selectedProduct && formData.quantity && (
                  <div className="order-summary">
                    <div className="summary-row">
                      <span>Product:</span>
                      <span>{selectedProduct.name}</span>
                    </div>
                    <div className="summary-row">
                      <span>Unit Price:</span>
                      <span>{formatKsh(selectedProduct.price)}</span>
                    </div>
                    <div className="summary-row">
                      <span>Quantity:</span>
                      <span>{formData.quantity}</span>
                    </div>
                    {formData.emptyBottleSize && emptyBottleQtyInt > 0 ? (
                      <div className="summary-row">
                        <span>Empty bottle:</span>
                        <span>
                          {bottleSizes.find(b => b.id === formData.emptyBottleSize)?.name} × {emptyBottleQtyInt} @ {formatKsh(Number((bottlePricing[formData.emptyBottleSize]||{}).price || 0))}
                        </span>
                      </div>
                    ) : null}
                    <div className="summary-row total">
                      <span>Total Amount:</span>
                      <span>{formatKsh(totalAmount)}</span>
                    </div>
                  </div>
                )}

                <button 
                  type="submit" 
                  className="submit-btn"
                  disabled={!formData.product || !formData.quantity || !formData.paymentMethod}
                >
                  <span>Make Order</span>
                  <span className="btn-arrow">→</span>
                </button>
              </form>
            </div>
          )}
          
          {activeView === 'my-orders' && (
            <div className="view-content my-orders-view">
              <div className="orders-header">
                <div>
                  <h2>
                    My Orders (
                    {new Date().toLocaleDateString('en-US', { weekday: 'long' })}
                    )
                  </h2>
                </div>
                <div className="orders-meta">
                  <div className="orders-pill">
                    <span className="pill-label">Date</span>
                    <span className="pill-value">{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' })}</span>
                  </div>
                </div>
              </div>

              {(() => {
                const todayKey = toLocalDateKey(new Date())
                const todaysOrders = orders
                  .filter(o => isOrderForCurrentUser(o))
                  .filter(o => getOrderDateKey(o) === todayKey)
                  .slice()
                  .sort((a, b) => getOrderTimeValue(a) - getOrderTimeValue(b))
                const todaysTotal = todaysOrders.reduce((sum, o) => {
                  if ((o.status || 'Pending') !== 'Paid') return sum
                  return sum + Number(o.totalAmount || 0)
                }, 0)

                if (todaysOrders.length === 0) {
                  return (
                    <div className="orders-empty">
                      <div className="empty-title">No orders today yet</div>
                      <div className="empty-subtitle">Go to “New Refill Sale” to make your first order.</div>
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
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {todaysOrders.map((o, idx) => (
                            <tr key={o.id} data-order={`Order ${String(idx + 1).padStart(3, '0')}`}>
                              <td className="muted" data-label="Time">{o.time}</td>
                              <td data-label="Product">
                                <div className="prod-cell">
                                  <div className="prod-name">{o.product}</div>
                                  <div className="prod-sub">Order #{String(idx + 1).padStart(3, '0')}</div>
                                  {o.emptyBottleSize && Number(o.emptyBottleQty || 0) > 0 ? (
                                    <div className="prod-sub">
                                      Empty bottle: {bottleSizes.find(b => b.id === o.emptyBottleSize)?.name} × {o.emptyBottleQty} ({formatKsh(Number(o.emptyBottleAmount || 0))})
                                    </div>
                                  ) : null}
                                </div>
                              </td>
                              <td className="num" data-label="Quantity">{o.quantity}</td>
                              <td className="num" data-label="Amount">{formatKsh(o.unitPrice)}</td>
                              <td data-label="Status">
                                <select
                                  className={`status-select status-${String(o.status || 'Pending').toLowerCase()}`}
                                  value={o.status || 'Pending'}
                                  onChange={(e) => setOrderStatus(o.id, e.target.value)}
                                >
                                  <option value="Pending">Pending</option>
                                  <option value="Paid">Paid</option>
                                </select>
                              </td>
                              <td data-label="Payment">
                                <span className={`pay-badge ${o.paymentMethod}`}>
                                  {o.paymentMethod === 'mpesa' ? (
                                    <img src={mpesaIcon} alt="MPESA" />
                                  ) : (
                                    <img src={cashIcon} alt="Cash" />
                                  )}
                                  <span>{o.paymentMethod.toUpperCase()}</span>
                                </span>
                              </td>
                              <td className="num strong" data-label="Total">
                                {(o.status || 'Pending') === 'Paid' ? formatKsh(o.totalAmount) : '—'}
                              </td>
                              <td data-label="Actions">
                                <button
                                  type="button"
                                  className="snackbar-btn ghost"
                                  style={{ padding: '8px 12px', borderRadius: 12 }}
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    deleteOrder(o)
                                  }}
                                >
                                  Delete
                                </button>
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

          {activeView === 'daily-summary' && (
            <div className="view-content daily-summary-view">
              {(() => {
                const todayKey = toLocalDateKey(new Date())
                const todaysOrders = orders
                  .filter(o => isOrderForCurrentUser(o))
                  .filter(o => getOrderDateKey(o) === todayKey)
                  .slice()
                  .sort((a, b) => getOrderTimeValue(a) - getOrderTimeValue(b))

                const orderCount = todaysOrders.length
                const totalSales = todaysOrders.reduce((sum, o) => {
                  return sum + Number(o.totalAmount || 0)
                }, 0)
                const cashTotal = todaysOrders.reduce((sum, o) => {
                  if (String(o.paymentMethod) !== 'cash') return sum
                  return sum + Number(o.totalAmount || 0)
                }, 0)
                const mpesaTotal = todaysOrders.reduce((sum, o) => {
                  if (String(o.paymentMethod) !== 'mpesa') return sum
                  return sum + Number(o.totalAmount || 0)
                }, 0)

                const productQtyMap = new Map()
                for (const o of todaysOrders) {
                  const name = o.product || 'Unknown'
                  const qty = Number(o.quantity || 0)
                  productQtyMap.set(name, (productQtyMap.get(name) || 0) + qty)
                }
                let topProduct = null
                for (const [name, qty] of productQtyMap.entries()) {
                  if (!topProduct || qty > topProduct.qty) topProduct = { name, qty }
                }

                return (
                  <>
                    <div className="daily-header">
                      <div>
                        <h2>Daily Summary</h2>
                        <p className="daily-subtitle">
                          {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: '2-digit' })}
                        </p>
                      </div>
                    </div>

                    <div className="daily-cards">
                      <div className="daily-card">
                        <div className="daily-card-label">Today’s Sales Total</div>
                        <div className="daily-card-value accent">{formatKsh(totalSales)}</div>
                        <div className="daily-card-hint">All recorded orders today</div>
                      </div>
                      <div className="daily-card">
                        <div className="daily-card-label">Cash Amount</div>
                        <div className="daily-card-value">{formatKsh(cashTotal)}</div>
                        <div className="daily-card-hint">All cash orders today</div>
                      </div>
                      <div className="daily-card">
                        <div className="daily-card-label">MPESA Amount</div>
                        <div className="daily-card-value">{formatKsh(mpesaTotal)}</div>
                        <div className="daily-card-hint">All MPESA orders today</div>
                      </div>
                      <div className="daily-card">
                        <div className="daily-card-label">Number of Orders</div>
                        <div className="daily-card-value">{orderCount}</div>
                        <div className="daily-card-hint">All orders created today</div>
                      </div>
                      <div className="daily-card">
                        <div className="daily-card-label">Most Ordered Product</div>
                        <div className="daily-card-value">
                          {topProduct ? topProduct.name : '—'}
                        </div>
                        <div className="daily-card-hint">
                          {topProduct ? `${topProduct.qty} item(s) today` : 'No orders yet today'}
                        </div>
                      </div>
                    </div>

                    <div className="daily-mini">
                      <div className="daily-mini-title">Today’s activity</div>
                      <div className="daily-mini-row">
                        <span>Paid orders</span>
                        <span>
                          {todaysOrders.filter(o => (o.status || 'Pending') === 'Paid').length}
                        </span>
                      </div>
                      <div className="daily-mini-row">
                        <span>Pending orders</span>
                        <span>
                          {todaysOrders.filter(o => (o.status || 'Pending') !== 'Paid').length}
                        </span>
                      </div>
                    </div>
                  </>
                )
              })()}
            </div>
          )}

          {activeView === 'weekly-summary' && (
            <div className="view-content weekly-summary-view">
              {(() => {
                const now = new Date()
                const weekStart = getStartOfWeek(now)
                const weekEnd = addDays(weekStart, 6)
                const startKey = toLocalDateKey(weekStart)
                const endKey = toLocalDateKey(weekEnd)

                const weekOrders = orders
                  .filter(o => isOrderForCurrentUser(o))
                  .filter(o => {
                    const k = getOrderDateKey(o)
                    if (!k) return false
                    return k >= startKey && k <= endKey
                  })
                  .slice()
                  .sort((a, b) => getOrderTimeValue(a) - getOrderTimeValue(b))

                const weekTotal = weekOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0)
                const weekCashTotal = weekOrders.reduce((sum, o) => {
                  if (String(o.paymentMethod) !== 'cash') return sum
                  return sum + Number(o.totalAmount || 0)
                }, 0)
                const weekMpesaTotal = weekOrders.reduce((sum, o) => {
                  if (String(o.paymentMethod) !== 'mpesa') return sum
                  return sum + Number(o.totalAmount || 0)
                }, 0)

                const paidWeekOrders = weekOrders.filter(o => (o.status || 'Pending') === 'Paid')
                const paidCount = paidWeekOrders.length
                const pendingCount = weekOrders.length - paidCount

                const productQtyMap = new Map()
                for (const o of weekOrders) {
                  const name = o.product || 'Unknown'
                  const qty = Number(o.quantity || 0)
                  productQtyMap.set(name, (productQtyMap.get(name) || 0) + qty)
                }
                let topProduct = null
                for (const [name, qty] of productQtyMap.entries()) {
                  if (!topProduct || qty > topProduct.qty) topProduct = { name, qty }
                }

                const dayTotals = []
                for (let i = 0; i < 7; i++) {
                  const d = addDays(weekStart, i)
                  const k = toLocalDateKey(d)
                  const label = d.toLocaleDateString('en-US', { weekday: 'short' })
                  const total = weekOrders.reduce((sum, o) => {
                    if (getOrderDateKey(o) !== k) return sum
                    return sum + Number(o.totalAmount || 0)
                  }, 0)
                  dayTotals.push({ k, label, total })
                }

                return (
                  <>
                    <div className="weekly-header">
                      <div>
                        <h2>Weekly Summary</h2>
                        <p className="weekly-subtitle">
                          {weekStart.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })}
                          {' — '}
                          {weekEnd.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}
                        </p>
                      </div>
                      <div className="weekly-pill">
                        <span className="pill-label">Week</span>
                        <span className="pill-value">{startKey} → {endKey}</span>
                      </div>
                    </div>

                    <div className="weekly-cards">
                      <div className="weekly-card">
                        <div className="weekly-card-label">Week Sales Total</div>
                        <div className="weekly-card-value accent">{formatKsh(weekTotal)}</div>
                        <div className="weekly-card-hint">All orders in this week</div>
                      </div>
                      <div className="weekly-card">
                        <div className="weekly-card-label">Cash Amount</div>
                        <div className="weekly-card-value">{formatKsh(weekCashTotal)}</div>
                        <div className="weekly-card-hint">All cash orders in this week</div>
                      </div>
                      <div className="weekly-card">
                        <div className="weekly-card-label">MPESA Amount</div>
                        <div className="weekly-card-value">{formatKsh(weekMpesaTotal)}</div>
                        <div className="weekly-card-hint">All MPESA orders in this week</div>
                      </div>
                      <div className="weekly-card">
                        <div className="weekly-card-label">Paid Orders</div>
                        <div className="weekly-card-value">{paidCount}</div>
                        <div className="weekly-card-hint">{pendingCount} pending (not counted in totals)</div>
                      </div>
                      <div className="weekly-card">
                        <div className="weekly-card-label">Top Product</div>
                        <div className="weekly-card-value">{topProduct ? topProduct.name : '—'}</div>
                        <div className="weekly-card-hint">{topProduct ? `${topProduct.qty} item(s) this week` : 'No orders this week'}</div>
                      </div>
                    </div>

                    <div className="weekly-breakdown">
                      <div className="weekly-breakdown-title">Sales totals by day</div>
                      <div className="weekly-breakdown-grid">
                        {dayTotals.map(d => (
                          <div key={d.k} className="week-day">
                            <div className="week-day-label">{d.label}</div>
                            <div className="week-day-value">{formatKsh(d.total)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )
              })()}
            </div>
          )}

          </div>
        </main>
      </div>

      <div
        className={`snackbar ${snackbar.open ? 'open' : ''} ${snackbar.variant}`}
        role="status"
        aria-live="polite"
      >
        <div className="snackbar-inner">
          <div className="snackbar-dot" aria-hidden="true" />
          <div className="snackbar-message">{snackbar.message}</div>
          {pendingOrder ? (
            <div className="snackbar-actions">
              <button type="button" className="snackbar-btn ghost" onClick={cancelPendingOrder}>
                Cancel
              </button>
              <button type="button" className="snackbar-btn primary" onClick={proceedRecordPendingOrder}>
                Proceed
              </button>
            </div>
          ) : null}
          <button
            type="button"
            className="snackbar-close"
            onClick={() => setSnackbar(s => ({ ...s, open: false }))}
            aria-label="Close notification"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}

export default UserDashboard
