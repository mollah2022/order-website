import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app.jsx'
import Admin from './Admin.jsx'
import './style.css'

const isAdmin = window.location.pathname.startsWith('/admin')

ReactDOM.createRoot(document.getElementById('root')).render(
  isAdmin ? <Admin /> : <App />
)