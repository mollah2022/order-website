import { useEffect, useState } from 'react'

const money = (n) => `৳${Number(n).toLocaleString('en-US')}`

export default function App() {
  const [products, setProducts] = useState([])
  const [charges, setCharges] = useState({ dhaka: 60, outside: 120 })
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
    fetch('/api/products')
      .then((r) => r.json())
      .then(setProducts)
    fetch('/api/delivery-charges').then((r) => r.json()).then(setCharges)
  }, [])

  const change = (id, d) =>
    setQty((q) => {
      const p = products.find((x) => x.id === id)
      const next = Math.max(0, (q[id] || 0) + d)
      return { ...q, [id]: Math.min(next, p ? p.stock : next) }
    })

  const selected = products.filter((p) => (qty[p.id] || 0) > 0)
  const itemCount = selected.reduce((s, p) => s + qty[p.id], 0)
  const subtotal = selected.reduce((s, p) => s + p.price * qty[p.id], 0)
  const delivery = selected.length ? charges[form.area] : 0
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
      const res = await fetch('/api/orders', {
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

  const Header = () => (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="logo">MyShop</div>
        <input
          className="search"
          placeholder="Search in MyShop"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button type="button" className="cart-btn" onClick={goCheckout}>
          🛒 <span className="badge">{itemCount}</span>
        </button>
      </div>
    </header>
  )

  if (done) {
    return (
      <>
        <Header />
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
      <Header />

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
                                {p.stock > 0 && p.stock <= 5 && (
                  <div className="lowstock">Only {p.stock} left!</div>
                )}
                {p.stock <= 0 ? (
                  <button type="button" className="add soldout" disabled>
                    Out of Stock
                  </button>
                ) : (qty[p.id] || 0) === 0 ? (
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
              <select value={form.area} onChange={setField('area')}>
                <option value="dhaka">Inside Dhaka ({money(charges.dhaka)})</option>
                <option value="outside">Outside Dhaka ({money(charges.outside)})</option>
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