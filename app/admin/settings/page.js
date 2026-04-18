'use client'

import { useState, useEffect } from 'react'

export default function SettingsPage() {
  const [settings, setSettings] = useState({ allow_duplicate_bookings: null })
  const [loading, setLoading]   = useState(true)
  const [saved, setSaved]       = useState(false)

  useEffect(() => {
    fetch('/api/settings', { credentials: 'same-origin' })
      .then(r => r.json()).then(d => setSettings(s => ({ ...s, ...d })))
      .finally(() => setLoading(false))
  }, [])

  async function save() {
    await fetch('/api/settings', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const allowDupes = settings.allow_duplicate_bookings === 'true'

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Settings</h1>
      <p className="text-sm text-gray-400 mb-6">Global booking behaviour.</p>

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : (
        <div className="card max-w-lg space-y-6">

          {/* Duplicate bookings toggle */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-semibold text-gray-900 text-sm">Allow repeat bookings</p>
              <p className="text-xs text-gray-400 mt-0.5">
                When OFF, a person can only book one slot. Identified by email <em>or</em> name —
                if either matches an existing confirmed booking, they'll see a warning.
              </p>
            </div>
            <button
              onClick={() => setSettings(s => ({
                ...s,
                allow_duplicate_bookings: allowDupes ? 'false' : 'true'
              }))}
              className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none
                ${allowDupes ? 'bg-coral-500' : 'bg-sage-200'}`}>
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200
                ${allowDupes ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          <div className="pt-2 border-t border-sage-100">
            <button onClick={save} className="btn-primary btn-sm">
              {saved ? '✓ Saved' : 'Save settings'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
