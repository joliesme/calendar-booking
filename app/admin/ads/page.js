'use client'

import { useState, useEffect } from 'react'

const POSITIONS = { top: 'Top banner', sidebar: 'Sidebar', bottom: 'Bottom' }

export default function AdsAdmin() {
  const [ads, setAds]         = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [feedback, setFeedback] = useState('')

  const empty = { title: '', description: '', image_url: '', link_url: '', position: 'sidebar', active: true, order_num: 0, label: 'Sponsored' }
  const [form, setForm] = useState(empty)

  function load() {
    setLoading(true)
    fetch('/api/ads?all=true', { credentials: 'same-origin' })
      .then(r => r.json()).then(d => setAds(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  function startNew()  { setEditing('new');  setForm(empty) }
  function startEdit(a){ setEditing(a.id);   setForm({ ...a }) }
  function cancel()    { setEditing(null) }

  async function save(e) {
    e.preventDefault()
    try {
      let res
      if (editing === 'new') {
        res = await fetch('/api/ads', {
          method: 'POST', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
      } else {
        res = await fetch('/api/ads', {
          method: 'PUT', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editing, ...form }),
        })
      }
      if (!res.ok) throw new Error((await res.json()).error)
      setFeedback('Saved!')
      setEditing(null)
      load()
    } catch (err) { setFeedback(`Error: ${err.message}`) }
  }

  async function deleteAd(id) {
    if (!confirm('Delete this ad?')) return
    await fetch(`/api/ads?id=${id}`, { method: 'DELETE', credentials: 'same-origin' })
    load()
  }

  async function toggleActive(a) {
    await fetch('/api/ads', {
      method: 'PUT', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: a.id, active: !a.active }),
    })
    load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ads</h1>
          <p className="text-sm text-gray-500 mt-0.5">Small promotional banners shown on the booking page.</p>
        </div>
        {!editing && (
          <button onClick={startNew} className="btn-primary btn-sm">+ Add ad</button>
        )}
      </div>

      {feedback && (
        <div className={`text-sm px-4 py-2.5 rounded-xl mb-4 font-medium border ${feedback.startsWith('Error') ? 'bg-coral-50 text-coral-700 border-coral-100' : 'bg-lime-100 text-lime-700 border-lime-200'}`}>
          {feedback}
          <button onClick={() => setFeedback('')} className="ml-2 opacity-60">✕</button>
        </div>
      )}

      {/* Form */}
      {editing && (
        <form onSubmit={save} className="card mb-6 space-y-4">
          <h2 className="font-semibold">{editing === 'new' ? 'New ad' : 'Edit ad'}</h2>

          <div>
            <label className="label">Title <span className="text-coral-500">*</span></label>
            <input className="input" required value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Short headline" />
          </div>

          <div>
            <label className="label">Ad label</label>
            <div className="flex gap-2">
              <input className="input" value={form.label}
                onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                placeholder="e.g. Sponsored" />
              <div className="flex gap-1 flex-shrink-0">
                {['Sponsored', 'You may also like', 'Advertisement', 'Partner'].map(p => (
                  <button key={p} type="button"
                    onClick={() => setForm(f => ({ ...f, label: p }))}
                    className={`px-2 py-1 rounded-lg text-xs font-semibold border transition-all whitespace-nowrap
                      ${form.label === p ? 'bg-coral-500 text-white border-coral-500' : 'bg-white text-gray-500 border-sage-200 hover:border-coral-400'}`}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="label">Description</label>
            <input className="input" value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Optional short description" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Image URL</label>
              <input className="input" type="url" value={form.image_url}
                onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))}
                placeholder="https://…" />
            </div>
            <div>
              <label className="label">Link URL</label>
              <input className="input" type="url" value={form.link_url}
                onChange={e => setForm(f => ({ ...f, link_url: e.target.value }))}
                placeholder="https://…" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Position</label>
              <select className="input" value={form.position}
                onChange={e => setForm(f => ({ ...f, position: e.target.value }))}>
                {Object.entries(POSITIONS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Order</label>
              <input className="input" type="number" value={form.order_num}
                onChange={e => setForm(f => ({ ...f, order_num: parseInt(e.target.value) }))} />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.active}
              onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} />
            Active (visible on site)
          </label>

          {/* Preview */}
          {(form.title || form.image_url) && (
            <div className="border border-dashed border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-2">Preview:</p>
              <div className="flex items-start gap-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl">
                {form.image_url && <img src={form.image_url} alt="" className="w-12 h-12 object-cover rounded-lg flex-shrink-0" />}
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-blue-400 font-semibold">{form.label || 'Sponsored'}</p>
                  <p className="font-semibold text-sm text-gray-800">{form.title}</p>
                  {form.description && <p className="text-xs text-gray-500 mt-0.5">{form.description}</p>}
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button type="submit" className="btn-primary">Save</button>
            <button type="button" onClick={cancel} className="btn-secondary">Cancel</button>
          </div>
        </form>
      )}

      {/* List */}
      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : ads.length === 0 ? (
        <div className="card text-center py-8 text-gray-400 text-sm">
          No ads yet. Click "Add ad" to create one.
        </div>
      ) : (
        <div className="space-y-2">
          {ads.map(a => (
            <div key={a.id} className={`card flex items-start justify-between gap-4 py-4 ${!a.active ? 'opacity-50' : ''}`}>
              <div className="flex items-start gap-3 min-w-0">
                {a.image_url && (
                  <img src={a.image_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">{a.title}</p>
                  {a.description && <p className="text-xs text-gray-500 truncate">{a.description}</p>}
                  <div className="flex gap-2 mt-1">
                    <span className="badge bg-gray-100 text-gray-600">{POSITIONS[a.position] || a.position}</span>
                    {!a.active && <span className="badge-red">Hidden</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => toggleActive(a)}
                  className="text-xs text-gray-500 hover:text-gray-700 font-medium">
                  {a.active ? 'Hide' : 'Show'}
                </button>
                <button onClick={() => startEdit(a)}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium">Edit</button>
                <button onClick={() => deleteAd(a.id)}
                  className="text-xs text-red-500 hover:text-red-700 font-medium">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
