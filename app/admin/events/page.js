'use client'

import { useState, useEffect } from 'react'

const PRESET_COLORS = ['#e85c45', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

export default function EventsAdmin() {
  const [events, setEvents]   = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [feedback, setFeedback] = useState('')

  const empty = { name: '', description: '', color: '#e85c45', active: true }
  const [form, setForm] = useState(empty)

  function load() {
    setLoading(true)
    fetch('/api/events?all=true', { credentials: 'same-origin' })
      .then(r => r.json()).then(d => setEvents(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  function startNew()   { setEditing('new'); setForm(empty) }
  function startEdit(e) { setEditing(e.id);  setForm({ ...e }) }
  function cancel()     { setEditing(null) }

  async function save(ev) {
    ev.preventDefault()
    try {
      let res
      if (editing === 'new') {
        res = await fetch('/api/events', {
          method: 'POST', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
      } else {
        res = await fetch(`/api/events/${editing}`, {
          method: 'PATCH', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
      }
      if (!res.ok) throw new Error((await res.json()).error)
      setFeedback('Saved!')
      setEditing(null)
      load()
    } catch (err) { setFeedback(`Error: ${err.message}`) }
  }

  async function deleteEvent(id) {
    if (!confirm('Delete this event? Slots assigned to it will become unassigned.')) return
    await fetch(`/api/events/${id}`, { method: 'DELETE', credentials: 'same-origin' })
    load()
  }

  async function toggleActive(e) {
    await fetch(`/api/events/${e.id}`, {
      method: 'PATCH', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !e.active }),
    })
    load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Events</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Create separate booking calendars (e.g. "Consultation", "Workshop"). Slots and questions can be assigned to a specific event.
          </p>
        </div>
        {!editing && (
          <button onClick={startNew} className="btn-primary btn-sm">+ Add event</button>
        )}
      </div>

      {feedback && (
        <div className={`text-sm px-4 py-2.5 rounded-xl mb-4 font-medium border ${feedback.startsWith('Error') ? 'bg-coral-50 text-coral-700 border-coral-100' : 'bg-lime-100 text-lime-700 border-lime-200'}`}>
          {feedback}
          <button onClick={() => setFeedback('')} className="ml-2 opacity-60">✕</button>
        </div>
      )}

      {/* Edit / New form */}
      {editing && (
        <form onSubmit={save} className="card mb-6 space-y-4">
          <h2 className="font-semibold">{editing === 'new' ? 'New event' : 'Edit event'}</h2>

          <div>
            <label className="label">
              Event name <span className="text-coral-500 normal-case tracking-normal font-normal">*</span>
            </label>
            <input className="input" required value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Free Consultation" />
          </div>

          <div>
            <label className="label">Description <span className="text-gray-300 font-normal normal-case tracking-normal">optional</span></label>
            <input className="input" value={form.description || ''}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Short description shown on the booking page" />
          </div>

          <div>
            <label className="label">Colour</label>
            <div className="flex items-center gap-2 flex-wrap">
              {PRESET_COLORS.map(c => (
                <button key={c} type="button"
                  onClick={() => setForm(f => ({ ...f, color: c }))}
                  style={{ background: c }}
                  className={`w-7 h-7 rounded-full border-2 transition-all
                    ${form.color === c ? 'border-gray-900 scale-110' : 'border-transparent hover:scale-105'}`} />
              ))}
              <input type="color" value={form.color}
                onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                className="w-7 h-7 rounded-full cursor-pointer border border-sage-200" />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.active}
              onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} />
            Active (visible on booking page)
          </label>

          <div className="flex gap-3 pt-2">
            <button type="submit" className="btn-primary">Save</button>
            <button type="button" onClick={cancel} className="btn-secondary">Cancel</button>
          </div>
        </form>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <div className="w-4 h-4 border-2 border-sage-200 border-t-coral-400 rounded-full animate-spin" />
          Loading…
        </div>
      ) : events.length === 0 ? (
        <div className="card text-center py-10 text-gray-400 text-sm">
          <p className="font-semibold text-gray-500 mb-1">No events yet</p>
          <p>Create an event to organise your slots and questions by category.</p>
          <p className="mt-2 text-xs">Without events, all slots appear together on the booking page.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {events.map(e => (
            <div key={e.id}
              className={`card flex items-center gap-4 py-3.5 ${!e.active ? 'opacity-50' : ''}`}>
              <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: e.color }} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-900 text-sm">{e.name}</p>
                {e.description && (
                  <p className="text-xs text-gray-400 truncate mt-0.5">{e.description}</p>
                )}
                {!e.active && (
                  <span className="badge-red mt-0.5">Hidden</span>
                )}
              </div>
              <div className="flex items-center gap-2.5 flex-shrink-0">
                <button onClick={() => toggleActive(e)}
                  className="text-xs text-gray-400 hover:text-gray-700 font-semibold">
                  {e.active ? 'Hide' : 'Show'}
                </button>
                <button onClick={() => startEdit(e)}
                  className="text-xs text-coral-500 hover:text-coral-700 font-semibold">Edit</button>
                <button onClick={() => deleteEvent(e.id)}
                  className="text-xs text-gray-300 hover:text-coral-500 font-semibold transition-colors">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
