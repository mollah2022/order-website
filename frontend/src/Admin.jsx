import { useEffect, useState, useCallback } from 'react'
import './admin.css'
import useTheme from './useTheme'

const STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled']
const money = (n) => `৳${Number(n).toLocaleString('en-US')}`
const formatOrderTime = (value) =>
  new Intl.DateTimeFormat('en-BD', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Dhaka',
  }).format(new Date(value))

async function api(path, token, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { ...(options.headers || {}), Authorization: 'Bearer ' + token },
  })
  if (res.status === 401) throw new Error('UNAUTH')
  const data = await res.json()
  if (!res.ok) {
    throw new Error(
      typeof data.detail === 'string' ? data.detail : 'Request failed'
    )
  }
  return data
}

export default function Admin() {
  const { isDark, toggleTheme } = useTheme()
  const [token, setToken] = useState(localStorage.getItem('admin_token') || '')

  const logout = () => {
    localStorage.removeItem('admin_token')
    setToken('')
  }

  if (!token) {
    return (
      <Login
        isDark={isDark}
        toggleTheme={toggleTheme}
        onLogin={(t) => {
          localStorage.setItem('admin_token', t)
          setToken(t)
        }}
      />
    )
  }
  return <Dashboard token={token} logout={logout} isDark={isDark} toggleTheme={toggleTheme} />
}

function Login({ onLogin, isDark, toggleTheme }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ username, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Login failed')
      onLogin(data.access_token)
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  return (
    <div className="adm-login">
      <form className="adm-box" onSubmit={submit}>
        <h2>Admin Login</h2>
        <button type="button" className="adm-theme-toggle" onClick={toggleTheme} aria-pressed={isDark}>
          {isDark ? '☀️ Switch to light mode' : '🌙 Switch to dark mode'}
        </button>
        <label htmlFor="admin-username">Username</label>
        <input
          id="admin-username"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <label htmlFor="admin-password">Password</label>
        <input
          id="admin-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p className="adm-error">{error}</p>}
        <button className="adm-btn" disabled={loading}>
          {loading ? 'Logging in...' : 'LOGIN'}
        </button>
      </form>
    </div>
  )
}

function Dashboard({ token, logout, isDark, toggleTheme }) {
  const [tab, setTab] = useState('orders')

  return (
    <div>
      <header className="adm-top">
        <b>Gramer Bazar Admin</b>
        <nav aria-label="Admin sections">
          <button className={tab === 'orders' ? 'on' : ''} onClick={() => setTab('orders')}>Orders</button>
          <button className={tab === 'products' ? 'on' : ''} onClick={() => setTab('products')}>Products</button>
          <button className={tab === 'delivery' ? 'on' : ''} onClick={() => setTab('delivery')}>Delivery Fee</button>
        </nav>
        <button type="button" className="adm-theme-toggle" onClick={toggleTheme} aria-pressed={isDark}>
          {isDark ? '☀️ Light' : '🌙 Dark'}
        </button>
        <button className="adm-out" onClick={logout}>Logout</button>
      </header>
      <main className="adm-main">
        {tab === 'orders' ? (
          <Orders token={token} logout={logout} />
        ) : tab === 'products' ? (
          <Products token={token} logout={logout} />
        ) : (
          <DeliverySettings token={token} logout={logout} />
        )}
      </main>
    </div>
  )
}

function DeliverySettings({ token, logout }) {
  const [areas, setAreas] = useState([])
  const [newArea, setNewArea] = useState({ name: '', fee: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    try {
      setAreas(await api('/api/admin/delivery-areas', token))
      setError('')
    } catch (e) {
      if (e.message === 'UNAUTH') {
        logout()
      } else {
        setError(e.message)
      }
    } finally {
      setLoading(false)
    }
  }, [token, logout])

  useEffect(() => { load() }, [load])

  const addArea = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setSaving(true)
    try {
      await api('/api/admin/delivery-areas', token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newArea.name, fee: Number(newArea.fee) }),
      })
      setNewArea({ name: '', fee: '' })
      setMessage('Delivery area added successfully.')
      await load()
    } catch (e) {
      if (e.message === 'UNAUTH') {
        logout()
      } else {
        setError(e.message)
      }
    } finally {
      setSaving(false)
    }
  }

  const saveArea = async (area) => {
    setError('')
    setMessage('')
    try {
      await api(`/api/admin/delivery-areas/${area.id}`, token, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: area.name, fee: Number(area.fee) }),
      })
      setMessage('Delivery area updated successfully.')
      await load()
    } catch (e) {
      if (e.message === 'UNAUTH') {
        logout()
      } else {
        setError(e.message)
      }
    }
  }

  const toggleArea = async (area) => {
    setError('')
    setMessage('')
    try {
      await api(`/api/admin/delivery-areas/${area.id}/active?active=${!area.is_active}`, token, {
        method: 'PATCH',
      })
      setMessage(`Delivery area ${area.is_active ? 'disabled' : 'enabled'}.`)
      await load()
    } catch (e) {
      if (e.message === 'UNAUTH') {
        logout()
      } else {
        setError(e.message)
      }
    }
  }

  if (loading) return <p>Loading delivery areas...</p>

  return (
    <>
      <form className="adm-box" onSubmit={addArea}>
        <h3>Add Delivery Area</h3>
        <p className="adm-muted">Checkout will show all active delivery areas and their fees.</p>
        <div className="adm-grid">
          <div>
            <label htmlFor="new-area-name">Area name</label>
            <input
              id="new-area-name"
              required
              minLength="2"
              maxLength="100"
              value={newArea.name}
              onChange={(e) => setNewArea({ ...newArea, name: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="new-area-fee">Delivery fee (৳)</label>
            <input
              id="new-area-fee"
              required
              type="number"
              min="0"
              step="any"
              value={newArea.fee}
              onChange={(e) => setNewArea({ ...newArea, fee: e.target.value })}
            />
          </div>
        </div>
        {error && <p className="adm-error">{error}</p>}
        {message && <p className="adm-ok">{message}</p>}
        <button className="adm-btn" disabled={saving}>
          {saving ? 'ADDING...' : 'ADD DELIVERY AREA'}
        </button>
      </form>

      <h3>Delivery Areas ({areas.length})</h3>
      {areas.length === 0 ? (
        <p className="adm-muted">No delivery areas configured.</p>
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr><th>Area name</th><th>Fee (৳)</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {areas.map((area) => (
                <tr key={area.id}>
                  <td>
                    <input
                      aria-label={`Area name ${area.id}`}
                      minLength="2"
                      maxLength="100"
                      value={area.name}
                      onChange={(e) => setAreas((current) => current.map((item) =>
                        item.id === area.id ? { ...item, name: e.target.value } : item
                      ))}
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`Delivery fee ${area.id}`}
                      type="number"
                      min="0"
                      step="any"
                      value={area.fee}
                      onChange={(e) => setAreas((current) => current.map((item) =>
                        item.id === area.id ? { ...item, fee: e.target.value } : item
                      ))}
                    />
                  </td>
                  <td>{area.is_active ? 'Active' : 'Disabled'}</td>
                  <td className="adm-actions">
                    <button type="button" onClick={() => saveArea(area)}>Save</button>
                    <button type="button" onClick={() => toggleArea(area)}>
                      {area.is_active ? 'Disable' : 'Enable'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

function Orders({ token, logout }) {
  const [orders, setOrders] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [statusError, setStatusError] = useState('')

  const load = useCallback(async () => {
    try {
      const data = await api('/api/admin/orders', token)
      setOrders(data)
    } catch (e) {
      if (e.message === 'UNAUTH') logout()
    }
    setLoading(false)
  }, [token, logout])

  useEffect(() => {
    load()
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [load])

  const changeStatus = async (id, status) => {
    setStatusError('')
    try {
      await api(`/api/admin/orders/${id}`, token, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      await load()
    } catch (e) {
      if (e.message === 'UNAUTH') logout()
      else setStatusError(e.message)
    }
  }

  const count = (s) => orders.filter((o) => o.status === s).length
  const shown = filter === 'all' ? orders : orders.filter((o) => o.status === filter)
  const revenue = orders
    .filter((o) => o.status === 'delivered')
    .reduce((s, o) => s + Number(o.total), 0)

  return (
    <>
      <div className="adm-stats">
        <div className="adm-stat"><small>Total Orders</small><b>{orders.length}</b></div>
        <div className="adm-stat warn"><small>Pending</small><b>{count('pending')}</b></div>
        <div className="adm-stat"><small>Shipped</small><b>{count('shipped')}</b></div>
        <div className="adm-stat ok"><small>Delivered Revenue</small><b>{money(revenue)}</b></div>
      </div>

      <div className="adm-filters">
        {['all', ...STATUSES].map((s) => (
          <button key={s} className={filter === s ? 'on' : ''} onClick={() => setFilter(s)}>
            {s} {s !== 'all' && `(${count(s)})`}
          </button>
        ))}
        <button className="refresh" onClick={load}>↻ Refresh</button>
      </div>

      {statusError && <p className="adm-error">{statusError}</p>}
      {loading && <p>Loading...</p>}
      {!loading && shown.length === 0 && <p className="adm-muted">No orders found.</p>}

      {shown.map((o) => (
        <div className="adm-order" key={o.id}>
          <div className="adm-order-head">
            <div>
              <b>Order #{o.id}</b>
              <span className="adm-date" title="Bangladesh time">
                {formatOrderTime(o.created_at)} (BD)
              </span>
            </div>
            <span className={`adm-badge ${o.status}`}>{o.status}</span>
          </div>

          <div className="adm-order-body">
            <div>
              <p><b>{o.customer_name}</b></p>
              <p>📞 <a href={`tel:${o.phone}`}>{o.phone}</a></p>
              <p>📍 {o.address}</p>
              <p className="adm-muted">
                Area: {o.area_name || ({ dhaka: 'Inside Dhaka', outside: 'Outside Dhaka' }[o.area] || o.area)}
              </p>
              {o.note && <p className="adm-note">Note: {o.note}</p>}
            </div>
            <div>
              {o.items.map((it) => (
                <div className="adm-line" key={it.id}>
                  <span>{it.product_name} × {it.quantity}</span>
                  <span>{money(it.price * it.quantity)}</span>
                </div>
              ))}
              <div className="adm-line"><span>Delivery</span><span>{money(o.delivery_charge)}</span></div>
              <div className="adm-line adm-total"><span>Total (COD)</span><span>{money(o.total)}</span></div>
            </div>
          </div>

          <div className="adm-order-foot">
            <label>Change status:</label>
            <select value={o.status} onChange={(e) => changeStatus(o.id, e.target.value)}>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      ))}
    </>
  )
}

const EMPTY = { name: '', description: '', price: '', image_url: '', stock: 100, is_active: true }

async function uploadProductImage(file, token) {
  const body = new FormData()
  body.append('file', file)
  const res = await fetch('/api/admin/products/upload', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token },
    body,
  })
  const data = await res.json()
  if (res.status === 401) throw new Error('UNAUTH')
  if (!res.ok) throw new Error(data.detail || 'Image upload failed')
  return data.url
}

function Products({ token, logout }) {
  const [products, setProducts] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const [msg, setMsg] = useState('')
  const [migratingImages, setMigratingImages] = useState(false)

    const copyLink = (p) => {
    const link = `${window.location.origin}/p/${p.id}`
    navigator.clipboard.writeText(link)
    setMsg(`Link copied: ${link}`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const load = useCallback(async () => {
    try {
      setProducts(await api('/api/admin/products', token))
    } catch (e) {
      if (e.message === 'UNAUTH') logout()
    }
  }, [token, logout])

  useEffect(() => {
    load()
    const refreshTimer = window.setInterval(load, 5000)
    window.addEventListener('focus', load)

    return () => {
      window.clearInterval(refreshTimer)
      window.removeEventListener('focus', load)
    }
  }, [load])

  const set = (k) => (e) =>
    setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  const migrateImages = async () => {
    setMigratingImages(true)
    setMsg('')
    try {
      const result = await api('/api/admin/products/migrate-images', token, {
        method: 'POST',
      })
      setMsg(
        result.failed.length
          ? `Migrated ${result.migrated}; ${result.failed.length} image(s) need attention.`
          : `Migrated ${result.migrated} existing image(s) to Cloudinary.`
      )
      await load()
    } catch (e) {
      if (e.message === 'UNAUTH') logout()
      else setMsg(e.message)
    } finally {
      setMigratingImages(false)
    }
  }

  const save = async (e) => {
    e.preventDefault()
    try {
      const uploadedUrl = imageFile ? await uploadProductImage(imageFile, token) : (form.image_url || null)
      const body = {
        ...form,
        price: Number(form.price),
        stock: Number(form.stock),
        image_url: uploadedUrl,
      }
      await api(editId ? `/api/admin/products/${editId}` : '/api/admin/products', token, {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      setMsg(editId ? 'Product updated ✓' : 'Product added ✓')
      setForm(EMPTY)
      setImageFile(null)
      setImagePreview('')
      setEditId(null)
      load()
    } catch (e) {
      if (e.message === 'UNAUTH') logout()
      else setMsg(e.message)
    }
  }

  const edit = (p) => {
    setEditId(p.id)
    setForm({
      name: p.name,
      description: p.description || '',
      price: p.price,
      image_url: p.image_url || '',
      stock: p.stock,
      is_active: p.is_active,
    })
    setImageFile(null)
    setImagePreview(p.image_url || '')
    setMsg('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const toggle = async (p) => {
    try {
      await api(`/api/admin/products/${p.id}`, token, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...p, is_active: !p.is_active }),
      })
      load()
    } catch (e) {
      if (e.message === 'UNAUTH') logout()
    }
  }

  return (
    <>
      <form className="adm-box" onSubmit={save}>
        <h3>{editId ? `Edit Product #${editId}` : 'Add New Product'}</h3>
        <div className="adm-grid">
          <div>
            <label htmlFor="product-name">Name *</label>
            <input id="product-name" required value={form.name} onChange={set('name')} />
          </div>
          <div>
            <label htmlFor="product-price">Price (৳) *</label>
            <input id="product-price" required type="number" min="0" value={form.price} onChange={set('price')} />
          </div>
          <div>
            <label htmlFor="product-stock">Stock</label>
            <input id="product-stock" type="number" min="0" value={form.stock} onChange={set('stock')} />
          </div>
          <div>
            <label htmlFor="product-image">Product Image</label>
            <input
              id="product-image"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(e) => {
                const file = e.target.files?.[0] || null
                setImageFile(file)
                setImagePreview(file ? URL.createObjectURL(file) : (form.image_url || ''))
              }}
            />
            {imagePreview && (
              <img
                src={imagePreview}
                alt="Product preview"
                style={{ width: 120, height: 120, objectFit: 'cover', marginTop: 8, borderRadius: 4 }}
              />
            )}
          </div>
        </div>
        <label htmlFor="product-description">Description</label>
        <textarea id="product-description" rows="2" value={form.description} onChange={set('description')} />
        <label className="adm-check">
          <input type="checkbox" checked={form.is_active} onChange={set('is_active')} />
          Visible on website
        </label>
        {msg && <p className="adm-ok">{msg}</p>}
        <button className="adm-btn">{editId ? 'UPDATE PRODUCT' : 'ADD PRODUCT'}</button>
        {editId && (
          <button type="button" className="adm-btn gray" onClick={() => { setEditId(null); setForm(EMPTY); setImageFile(null); setImagePreview('') }}>
            CANCEL
          </button>
        )}
      </form>

      <div className="adm-filters">
        <h3>All Products ({products.length})</h3>
        <button
          className="refresh"
          type="button"
          onClick={migrateImages}
          disabled={migratingImages}
        >
          {migratingImages ? 'Migrating images...' : 'Move old images to Cloudinary'}
        </button>
        <button className="refresh" type="button" onClick={load}>↻ Refresh stock</button>
      </div>
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr><th>ID</th><th>Name</th><th>Price</th><th>Stock left</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td>{p.id}</td>
                <td>{p.name}</td>
                <td>{money(p.price)}</td>
                <td>{p.stock}</td>
                <td>
                  <span className={`adm-badge ${p.is_active ? 'delivered' : 'cancelled'}`}>
                    {p.is_active ? 'visible' : 'hidden'}
                  </span>
                </td>
                <td className="adm-actions">
                  <button onClick={() => edit(p)}>Edit</button>
                  <button onClick={() => copyLink(p)}>Copy Link</button>
                  <button onClick={() => toggle(p)}>{p.is_active ? 'Hide' : 'Show'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
