import { useEffect, useState } from 'react'
import useTheme from './useTheme'
import { apiUrl } from './api'

const money = (n) => `৳${Number(n).toLocaleString('en-US')}`

function ThemeToggle({ isDark, onToggle, className = '' }) {
  return (
    <button
      type="button"
      className={`theme-toggle ${className}`}
      onClick={onToggle}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      aria-pressed={isDark}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      <span aria-hidden="true">{isDark ? '☀️' : '🌙'}</span>
      <span>{isDark ? 'Light' : 'Dark'}</span>
    </button>
  )
}

function Header({ search, itemCount, onSearch, onCart, isDark, onToggleTheme }) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="logo">Gramer Bazar</div>
        <input
          className="search"
          placeholder="Search in Gramer Bazar"
          value={search}
          onChange={onSearch}
        />
        <ThemeToggle isDark={isDark} onToggle={onToggleTheme} />
        <button type="button" className="cart-btn" onClick={onCart}>
          🛒 <span className="badge">{itemCount}</span>
        </button>
      </div>
    </header>
  )
}

export default function App() {
  const { isDark, toggleTheme } = useTheme()
  const [products, setProducts] = useState([])
  const [deliveryAreas, setDeliveryAreas] = useState([])
  const [areasLoading, setAreasLoading] = useState(true)
  const [qty, setQty] = useState({})
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({
    customer_name: '',
    phone: '',
    address: '',
    area: 'dhaka',
    note: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(null)

  useEffect(() => {
    fetch(apiUrl('/api/products'))
      .then((r) => r.json())
      .then(setProducts)
    fetch(apiUrl('/api/delivery-areas'))
      .then((r) => {
        if (!r.ok) throw new Error('Could not load delivery areas.')
        return r.json()
      })
      .then((areas) => {
        setDeliveryAreas(areas)
        setForm((current) => ({
          ...current,
          area: areas.some((area) => String(area.id) === current.area)
            ? current.area
            : String(areas[0]?.id || ''),
        }))
      })
      .catch((err) => setError(err.message))
      .finally(() => setAreasLoading(false))
  }, [])

  const change = (id, d) =>
    setQty((q) => ({ ...q, [id]: Math.min(100, Math.max(0, (q[id] || 0) + d)) }))

  const selected = products.filter((p) => (qty[p.id] || 0) > 0)
  const itemCount = selected.reduce((s, p) => s + qty[p.id], 0)
  const subtotal = selected.reduce((s, p) => s + p.price * qty[p.id], 0)
  const selectedArea = deliveryAreas.find((area) => String(area.id) === form.area)
  const delivery = selected.length ? Number(selectedArea?.fee || 0) : 0
  const total = subtotal + delivery

  const visible = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  const setField = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const goCheckout = () =>
    document.getElementById('checkout').scrollIntoView({ behavior: 'smooth' })

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!selected.length) {
      setError('Please add at least one product to your cart.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(apiUrl('/api/orders'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          items: selected.map((p) => ({
            product_id: p.id,
            quantity: qty[p.id],
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(
          typeof data.detail === 'string'
            ? data.detail
            : 'Please check your information (phone number must be 11 digits).'
        )
      }
      setDone(data)
      window.scrollTo(0, 0)
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  if (done) {
    return (
      <>
        <Header
          search={search}
          itemCount={itemCount}
          onSearch={(e) => setSearch(e.target.value)}
          onCart={goCheckout}
          isDark={isDark}
          onToggleTheme={toggleTheme}
        />
        <div className="container">
          <div className="box success">
            <div className="tick">✓</div>
            <h2>Order placed successfully!</h2>
            <p>Your order number is <b>#{done.order_id}</b></p>
            <p>
              Total to pay: <b className="orange">{money(done.total)}</b>{' '}
              (Cash on Delivery)
            </p>
            <p>Our team will call you shortly to confirm your order.</p>
            <button className="btn" onClick={() => window.location.reload()}>
              CONTINUE SHOPPING
            </button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Header
        search={search}
        itemCount={itemCount}
        onSearch={(e) => setSearch(e.target.value)}
        onCart={goCheckout}
        isDark={isDark}
        onToggleTheme={toggleTheme}
      />

      <div className="strip">
        <span>💵 Cash on Delivery</span>
        <span>🚚 Fast Delivery</span>
        <span>✅ Easy Ordering</span>
      </div>

      <div className="container">
        <h2 className="section-title">Just For You</h2>
        <div className="grid">
          {visible.map((p) => (
            <div className="pcard" key={p.id}>
              <div className="pimg">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} />
                ) : (
                  <div className="noimg">{p.name.charAt(0)}</div>
                )}
              </div>
              <div className="pbody">
                <div className="pname">{p.name}</div>
                <div className="pdesc">{p.description}</div>
                <div className="pprice">{money(p.price)}</div>
                {(qty[p.id] || 0) === 0 ? (
                  <button
                    type="button"
                    className="add"
                    onClick={() => change(p.id, 1)}
                  >
                    Add to Cart
                  </button>
                ) : (
                  <div className="stepper">
                    <button type="button" onClick={() => change(p.id, -1)}>−</button>
                    <span>{qty[p.id]}</span>
                    <button type="button" onClick={() => change(p.id, 1)}>+</button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {visible.length === 0 && <p>No products found.</p>}
        </div>

        <form id="checkout" onSubmit={submit} className="checkout">
          <div className="left">
            <div className="box">
              <h3>Delivery Information</h3>

              <label>Full Name *</label>
              <input
                required
                placeholder="Enter your full name"
                value={form.customer_name}
                onChange={setField('customer_name')}
              />

              <label>Phone Number *</label>
              <input
                required
                type="tel"
                placeholder="01XXXXXXXXX"
                pattern="01[3-9][0-9]{8}"
                title="Enter a valid 11-digit Bangladeshi mobile number"
                value={form.phone}
                onChange={setField('phone')}
              />

              <label>Delivery Area *</label>
              <select
                required
                value={form.area}
                onChange={setField('area')}
                disabled={areasLoading || deliveryAreas.length === 0}
              >
                {areasLoading && <option value="">Loading areas...</option>}
                {!areasLoading && deliveryAreas.length === 0 && (
                  <option value="">No delivery areas available</option>
                )}
                {deliveryAreas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name} ({money(area.fee)})
                  </option>
                ))}
              </select>

              <label>Full Address *</label>
              <textarea
                required
                rows="3"
                placeholder="House, road, area, district"
                value={form.address}
                onChange={setField('address')}
              />

              <label>Note (optional)</label>
              <textarea
                rows="2"
                placeholder="Any special instruction?"
                value={form.note}
                onChange={setField('note')}
              />
            </div>
          </div>

          <div className="right">
            <div className="box summary">
              <h3>Order Summary</h3>
              {selected.length === 0 && (
                <p className="muted">Your cart is empty. Add products above.</p>
              )}
              {selected.map((p) => (
                <div className="row" key={p.id}>
                  <span>{p.name} × {qty[p.id]}</span>
                  <span>{money(p.price * qty[p.id])}</span>
                </div>
              ))}
              <hr />
              <div className="row">
                <span>Subtotal ({itemCount} items)</span>
                <span>{money(subtotal)}</span>
              </div>
              <div className="row">
                <span>Delivery Fee</span>
                <span>{money(delivery)}</span>
              </div>
              <div className="row total">
                <span>Total</span>
                <span className="orange">{money(total)}</span>
              </div>
              <div className="cod">💵 Payment Method: Cash on Delivery</div>

              {error && <p className="error">{error}</p>}
              <button className="btn" disabled={loading}>
                {loading ? 'PLACING ORDER...' : 'PLACE ORDER'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {itemCount > 0 && (
        <div className="mobile-bar">
          <div>
            <small>{itemCount} items</small>
            <b>{money(total)}</b>
          </div>
          <button type="button" onClick={goCheckout}>Checkout</button>
        </div>
      )}
    </>
  )
}