'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/admin',            label: 'Dashboard' },
  { href: '/admin/events',     label: 'Events' },
  { href: '/admin/slots',      label: 'Slots' },
  { href: '/admin/questions',  label: 'Questions' },
  { href: '/admin/ads',        label: 'Ads' },
  { href: '/admin/settings',   label: 'Settings' },
]

export default function AdminLayout({ children }) {
  const pathname  = usePathname()
  const [authed, setAuthed]     = useState(false)
  const [checking, setChecking] = useState(true)
  const [password, setPassword] = useState('')
  const [loginErr, setLoginErr] = useState('')

  useEffect(() => {
    fetch('/api/bookings', { credentials: 'same-origin' })
      .then(r => { if (r.status !== 401) setAuthed(true) })
      .finally(() => setChecking(false))
  }, [])

  async function login(e) {
    e.preventDefault()
    setLoginErr('')
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (res.ok) setAuthed(true)
    else setLoginErr('Incorrect password')
  }

  async function logout() {
    await fetch('/api/admin/login', { method: 'DELETE' })
    setAuthed(false)
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-sage-100 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-sage-300 border-t-coral-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-sage-100 flex items-center justify-center p-4">
        <div className="card w-full max-w-sm">
          <div className="w-10 h-10 bg-coral-500 rounded-xl flex items-center justify-center mb-5">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-1">Admin</h1>
          <p className="text-sm text-gray-400 mb-6">Enter your password to continue.</p>
          <form onSubmit={login} className="space-y-4">
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" value={password} autoFocus
                onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
            {loginErr && <p className="text-sm text-coral-500">{loginErr}</p>}
            <button type="submit" className="btn-primary w-full">Sign in</button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-sage-100 flex flex-col">
      {/* Top bar */}
      <header className="bg-white border-b border-sage-200 flex-shrink-0">
        <div className="max-w-7xl mx-auto px-4 h-13 flex items-center justify-between" style={{height: '3.25rem'}}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-coral-500 rounded-lg flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="font-bold text-gray-900 text-sm">Admin Panel</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="/" target="_blank"
              className="text-[11px] font-bold uppercase tracking-wider text-sage-500 hover:text-sage-700">
              View site ↗
            </a>
            <button onClick={logout}
              className="text-[11px] font-bold uppercase tracking-wider text-coral-500 hover:text-coral-700">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden max-w-7xl mx-auto w-full px-4 py-6 gap-5">
        {/* Sidebar */}
        <nav className="w-40 flex-shrink-0">
          <ul className="space-y-0.5">
            {NAV.map(({ href, label }) => {
              const active = pathname === href
              return (
                <li key={href}>
                  <a href={href}
                    className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all
                      ${active
                        ? 'bg-coral-500 text-white shadow-sm'
                        : 'text-gray-500 hover:bg-white hover:text-gray-900 hover:shadow-card'
                      }`}>
                    {label}
                  </a>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Content */}
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  )
}
