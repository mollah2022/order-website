import { useEffect, useState, useCallback } from 'react'
import './admin.css'

const STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled']
const money = (n) => `৳${Number(n).toLocaleString('en-US')}`

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
  const [token, setToken] = useState(localStorage.getItem('admin_token') || '')

  const logout = () => {
    localStorage.removeItem('admin_token')
    setToken('')
  }

  if (!token) {
    return (
      <Login
        onLogin={(t) => {
          localStorage.setItem('admin_token', t)
          setToken(t)
        }}
      />
    )
  }
  return <Dashboard token={token} logout={logout} />
}

function Login({ onLogin }) {
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
        <label>Username</label>
        <input value={username} onChange={(e) => setUsername(e.target.value)} required />
        <label>Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p className="adm-error">{error}</p>}
        <button className="adm-btn" disabled={loading}>
          {loading ? 'Logging in...' : 'LOGIN'}
        </button>
      </form>
    </div>
  )
}

function Dashboard({ token, logout }) {
  const [tab, setTab] = useState('orders')

  return (
    <div>
      <header className="adm-top">
        <b>MyShop Admin</b>
        <nav>
          <button className={tab === 'orders' ? 'on' : ''} onClick={() => setTab('orders')}>Orders</button>
          <button className={tab === 'products' ? 'on' : ''} onClick={() => setTab('products')}>Products</button>
          <button className={tab === 'delivery' ? 'on' : ''} onClick={() => setTab('delivery')}>Delivery Fee</button>
        </nav>
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
  const [charges, setCharges] = useState({ dhaka: '', outside: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    try {
      const data = await api('/api/admin/delivery-charges', token)
      setCharges({ dhaka: String(data.dhaka), outside: String(data.outside) })
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

  const save = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setSaving(true)
    try {
      const data = await api('/api/admin/delivery-charges', token, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dhaka: Number(charges.dhaka),
          outside: Number(charges.outside),
        }),
      })
      setCharges({ dhaka: String(data.dhaka), outside: String(data.outside) })
      setMessage('Delivery fees updated successfully.')
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

  if (loading) return <p>Loading delivery fees...</p>

  return (
    <form className="adm-box" onSubmit={save}>
      <h3>Delivery Fees</h3>
      <p className="adm-muted">Set the delivery fee customers will pay at checkout.</p>
      <div className="adm-grid">
        <div>
          <label htmlFor="delivery-dhaka">Inside Dhaka (৳)</label>
          <input
            id="delivery-dhaka"
            type="number"
            min="0"
            step="any"
            required
            value={charges.dhaka}
            onChange={(e) => setCharges({ ...charges, dhaka: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor="delivery-outside">Outside Dhaka (৳)</label>
          <input
            id="delivery-outside"
            type="number"
            min="0"
            step="any"
            required
            value={charges.outside}
            onChange={(e) => setCharges({ ...charges, outside: e.target.value })}
          />
        </div>
      </div>
      {error && <p className="adm-error">{error}</p>}
      {message && <p className="adm-ok">{message}</p>}
      <button className="adm-btn" disabled={saving}>
        {saving ? 'SAVING...' : 'SAVE DELIVERY FEES'}
      </button>
    </form>
  )
}

function Orders({ token, logout }) {
  const [orders, setOrders] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)

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
    try {
      await api(`/api/admin/orders/${id}`, token, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      load()
    } catch (e) {
      if (e.message === 'UNAUTH') logout()
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

      {loading && <p>Loading...</p>}
      {!loading && shown.length === 0 && <p className="adm-muted">No orders found.</p>}

      {shown.map((o) => (
        <div className="adm-order" key={o.id}>
          <div className="adm-order-head">
            <div>
              <b>Order #{o.id}</b>
              <span className="adm-date">{new Date(o.created_at).toLocaleString()}</span>
            </div>
            <span className={`adm-badge ${o.status}`}>{o.status}</span>
          </div>

          <div className="adm-order-body">
            <div>
              <p><b>{o.customer_name}</b></p>
              <p>📞 <a href={`tel:${o.phone}`}>{o.phone}</a></p>
              <p>📍 {o.address}</p>
              <p className="adm-muted">
                Area: {o.area === 'dhaka' ? 'Inside Dhaka' : 'Outside Dhaka'}
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

function Products({ token, logout }) {
  const [products, setProducts] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [msg, setMsg] = useState('')

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

  const save = async (e) => {
    e.preventDefault()
    const body = {
      ...form,
      price: Number(form.price),
      stock: Number(form.stock),
      image_url: form.image_url || null,
    }
    try {
      await api(editId ? `/api/admin/products/${editId}` : '/api/admin/products', token, {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      setMsg(editId ? 'Product updated ✓' : 'Product added ✓')
      setForm(EMPTY)
      setEditId(null)
      load()
    } catch (e) {
      if (e.message === 'UNAUTH') logout()
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
            <label>Name *</label>
            <input required value={form.name} onChange={set('name')} />
          </div>
          <div>
            <label>Price (৳) *</label>
            <input required type="number" min="0" value={form.price} onChange={set('price')} />
          </div>
          <div>
            <label>Stock</label>
            <input type="number" min="0" value={form.stock} onChange={set('stock')} />
          </div>
          <div>
            <label>Image URL</label>
            <input placeholder="https://..." value={form.image_url} onChange={set('image_url')} />
          </div>
        </div>
        <label>Description</label>
        <textarea rows="2" value={form.description} onChange={set('description')} />
        <label className="adm-check">
          <input type="checkbox" checked={form.is_active} onChange={set('is_active')} />
          Visible on website
        </label>
        {msg && <p className="adm-ok">{msg}</p>}
        <button className="adm-btn">{editId ? 'UPDATE PRODUCT' : 'ADD PRODUCT'}</button>
        {editId && (
          <button type="button" className="adm-btn gray" onClick={() => { setEditId(null); setForm(EMPTY) }}>
            CANCEL
          </button>
        )}
      </form>

      <div className="adm-filters">
        <h3>All Products ({products.length})</h3>
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
