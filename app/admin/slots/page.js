'use client'

import { useState, useEffect } from 'react'
import { format, parseISO } from 'date-fns'

function fmt(iso) {
  try { return format(parseISO(iso), 'EEE d MMM yyyy, h:mm a') } catch { return iso }
}

function dateRange(from, to) {
  const dates = []
  let d = new Date(from)
  const end = new Date(to)
  while (d <= end) {
    dates.push(d.toISOString().slice(0, 10))
    d = new Date(d.getTime() + 86400000)
  }
  return dates
}

export default function SlotsAdmin() {
  const [slots, setSlots]     = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab]         = useState('list')
  const [events, setEvents]   = useState([])

  // Event filter on list tab
  const [eventFilter, setEventFilter] = useState('__all__')

  // Multi-select
  const [selected, setSelected]   = useState(new Set())
  const [bulkEvent, setBulkEvent] = useState('')
  const [bulkMax, setBulkMax]     = useState('')
  const [applying, setApplying]   = useState(false)

  // Inline row editing
  const [editingRow, setEditingRow]   = useState(null) // slot id being edited inline
  const [rowEdit, setRowEdit]         = useState({})

  // Single slot form
  const [single, setSingle] = useState({ start_time: '', end_time: '', max_bookings: 1, event_id: '' })

  // Bulk form
  const [bulk, setBulk] = useState({
    dateFrom: '', dateTo: '', startHour: 9, endHour: 17,
    duration: 30, buffer: 0, max_bookings: 1, event_id: '',
    days: [1, 2, 3, 4, 5],
  })

  const [saving, setSaving]     = useState(false)
  const [feedback, setFeedback] = useState('')

  function load() {
    setLoading(true)
    setSelected(new Set())
    Promise.all([
      fetch('/api/slots?all=true', { credentials: 'same-origin' }).then(r => r.json()),
      fetch('/api/events?all=true', { credentials: 'same-origin' }).then(r => r.json()),
    ]).then(([s, e]) => {
      setSlots(Array.isArray(s) ? s : [])
      setEvents(Array.isArray(e) ? e : [])
    }).finally(() => setLoading(false))
  }
  useEffect(load, [])

  // ── Filtering ──────────────────────────────────────────
  const visibleSlots = slots.filter(s => {
    if (eventFilter === '__all__')        return true
    if (eventFilter === '__none__')       return !s.event_id
    return s.event_id === eventFilter
  })

  // ── Selection helpers ──────────────────────────────────
  function toggleOne(id) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  function toggleAll() {
    setSelected(prev =>
      prev.size === visibleSlots.length ? new Set() : new Set(visibleSlots.map(s => s.id))
    )
  }

  // ── Inline edit ───────────────────────────────────────
  function startRowEdit(s) {
    setEditingRow(s.id)
    const validEventId = events.some(e => e.id === s.event_id) ? s.event_id : ''
    setRowEdit({ max_bookings: s.max_bookings, event_id: validEventId })
  }
  async function saveRowEdit(id) {
    try {
      const res = await fetch(`/api/slots/${id}`, {
        method: 'PATCH', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...rowEdit, event_id: rowEdit.event_id || null }),
      })
      if (!res.ok) { let m = 'Request failed'; try { const d = await res.json(); m = d.error || m } catch {} throw new Error(m) }
      setEditingRow(null)
      load()
    } catch (err) { setFeedback(`Error: ${err.message}`) }
  }

  // ── Bulk actions ──────────────────────────────────────
  async function bulkDelete() {
    if (!confirm(`Delete ${selected.size} slot${selected.size !== 1 ? 's' : ''}? Any bookings for these slots will be cancelled.`)) return
    setApplying(true)
    try {
      const res = await fetch('/api/slots/bulk', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', ids: [...selected] }),
      })
      if (!res.ok) { let m = 'Request failed'; try { const d = await res.json(); m = d.error || m } catch {} throw new Error(m) }
      setFeedback(`Deleted ${selected.size} slots.`)
      load()
    } catch (err) {
      setFeedback(`Error: ${err.message}`)
    } finally { setApplying(false) }
  }

  async function bulkApply() {
    const fields = {}
    if (bulkEvent === '__none__') fields.event_id = null
    else if (bulkEvent)           fields.event_id = bulkEvent
    if (bulkMax !== '')           fields.max_bookings = parseInt(bulkMax)
    if (!Object.keys(fields).length) return
    setApplying(true)
    try {
      const res = await fetch('/api/slots/bulk', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', ids: [...selected], ...fields }),
      })
      if (!res.ok) { let m = 'Request failed'; try { const d = await res.json(); m = d.error || m } catch {} throw new Error(m) }
      setFeedback(`Updated ${selected.size} slots.`)
      setBulkEvent('')
      setBulkMax('')
      load()
    } catch (err) {
      setFeedback(`Error: ${err.message}`)
    } finally { setApplying(false) }
  }

  // ── Create handlers ───────────────────────────────────
  async function addSingle(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/slots', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...single, event_id: single.event_id || null }),
      })
      if (!res.ok) { let m = 'Request failed'; try { const d = await res.json(); m = d.error || m } catch {} throw new Error(m) }
      setFeedback('Slot added!')
      setSingle({ start_time: '', end_time: '', max_bookings: 1, event_id: '' })
      load()
    } catch (err) { setFeedback(`Error: ${err.message}`) }
    finally { setSaving(false) }
  }

  async function addBulk(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const dates = dateRange(bulk.dateFrom, bulk.dateTo)
        .filter(d => bulk.days.includes(new Date(d + 'T12:00:00').getDay()))
      if (!dates.length) { setFeedback('No dates match the selected days.'); setSaving(false); return }
      const res = await fetch('/api/slots', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bulk: true, dates, ...bulk, event_id: bulk.event_id || null }),
      })
      const data = await res.json()
      setFeedback(`Created ${data.created} slots.`)
      load()
    } catch (err) { setFeedback(`Error: ${err.message}`) }
    finally { setSaving(false) }
  }

  async function deleteSlot(id) {
    if (!confirm('Delete this slot? Any bookings for it will be cancelled.')) return
    try {
      const res = await fetch(`/api/slots/${id}`, { method: 'DELETE', credentials: 'same-origin' })
      if (!res.ok) { let m = 'Delete failed'; try { const d = await res.json(); m = d.error || m } catch {} throw new Error(m) }
      load()
    } catch (err) { setFeedback(`Error: ${err.message}`) }
  }

  const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const allSelected = visibleSlots.length > 0 && selected.size === visibleSlots.length
  const someSelected = selected.size > 0

  // Event filter tabs
  const filterTabs = [
    { key: '__all__',  label: `All (${slots.length})` },
    ...events.map(ev => ({ key: ev.id, label: `${ev.name} (${slots.filter(s => s.event_id === ev.id).length})`, color: ev.color })),
    { key: '__none__', label: `Unassigned (${slots.filter(s => !s.event_id).length})` },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Manage Slots</h1>
      <p className="text-sm text-gray-500 mb-6">Create available time slots that users can book.</p>

      {feedback && (
        <div className={`text-sm px-4 py-2.5 rounded-xl mb-4 font-medium ${feedback.startsWith('Error') ? 'bg-coral-50 text-coral-700 border border-coral-100' : 'bg-lime-100 text-lime-700 border border-lime-200'}`}>
          {feedback}
          <button onClick={() => setFeedback('')} className="ml-2 opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* View tabs */}
      <div className="flex gap-1 mb-6 bg-sage-100 rounded-xl p-1 w-fit">
        {[['list', 'All Slots'], ['add', 'Add Single'], ['bulk', 'Bulk Generate']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all
              ${tab === key ? 'bg-white shadow-card text-gray-900' : 'text-gray-400 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── All slots ── */}
      {tab === 'list' && (
        <>
          {/* Event filter pills */}
          {events.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {filterTabs.map(({ key, label, color }) => (
                <button key={key}
                  onClick={() => { setEventFilter(key); setSelected(new Set()) }}
                  style={eventFilter === key && color ? { background: color, borderColor: color, color: '#fff' } : {}}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border-2 transition-all
                    ${eventFilter === key && !color
                      ? 'bg-gray-900 text-white border-gray-900'
                      : eventFilter !== key
                        ? 'bg-white text-gray-500 border-sage-200 hover:border-gray-400'
                        : ''
                    }`}>
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* Bulk action bar */}
          {someSelected && (
            <div className="bg-coral-50 border border-coral-200 rounded-xl px-4 py-3 mb-4 flex items-center gap-3 flex-wrap">
              <span className="text-sm font-bold text-coral-700">{selected.size} selected</span>
              <div className="flex items-center gap-2 flex-wrap flex-1">
                {events.length > 0 && (
                  <select value={bulkEvent} onChange={e => setBulkEvent(e.target.value)}
                    className="input py-1.5 text-xs h-auto" style={{width:'auto'}}>
                    <option value="">Assign event…</option>
                    <option value="__none__">— Remove event —</option>
                    {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
                  </select>
                )}
                <input type="number" min="1" placeholder="Set max bookings"
                  value={bulkMax} onChange={e => setBulkMax(e.target.value)}
                  className="input py-1.5 text-xs h-auto w-36" />
                <button onClick={bulkApply} disabled={applying || (!bulkEvent && bulkMax === '')}
                  className="btn-secondary btn-sm disabled:opacity-40">
                  {applying ? 'Applying…' : 'Apply changes'}
                </button>
                <button onClick={bulkDelete} disabled={applying}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-coral-600 hover:bg-coral-100 border border-coral-200 transition-all disabled:opacity-40">
                  Delete {selected.size}
                </button>
              </div>
              <button onClick={() => setSelected(new Set())}
                className="text-xs text-gray-400 hover:text-gray-600 font-medium ml-auto">Clear</button>
            </div>
          )}

          <div className="card overflow-hidden p-0">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-400">
                <div className="w-4 h-4 border-2 border-sage-200 border-t-coral-400 rounded-full animate-spin" />
                Loading…
              </div>
            ) : visibleSlots.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm font-semibold text-gray-500">No slots</p>
                <p className="text-xs text-gray-400 mt-1">Use "Add Single" or "Bulk Generate" to create slots.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-sage-50 border-b border-sage-100">
                      <th className="px-4 py-3 w-8">
                        <input type="checkbox" checked={allSelected} onChange={toggleAll}
                          className="w-3.5 h-3.5 rounded accent-coral-500 cursor-pointer" />
                      </th>
                      {['Start', 'End', 'Max', 'Booked', 'Event', ''].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-sage-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sage-50">
                    {visibleSlots.map(s => {
                      const isSelected = selected.has(s.id)
                      const isEditing  = editingRow === s.id
                      return (
                        <tr key={s.id}
                          onClick={() => { if (!isEditing) toggleOne(s.id) }}
                          className={`cursor-pointer transition-colors
                            ${isSelected ? 'bg-coral-50' : 'hover:bg-sage-50/60'}
                            ${isEditing  ? '!bg-lime-50 cursor-default' : ''}`}>

                          <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                            <input type="checkbox" checked={isSelected} onChange={() => toggleOne(s.id)}
                              className="w-3.5 h-3.5 rounded accent-coral-500 cursor-pointer" />
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-800">{fmt(s.start_time)}</td>
                          <td className="px-4 py-3 text-gray-400 text-xs">{fmt(s.end_time)}</td>

                          {/* Max bookings — editable inline */}
                          <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                            {isEditing ? (
                              <input type="number" min="1" value={rowEdit.max_bookings}
                                onChange={e => setRowEdit(r => ({ ...r, max_bookings: parseInt(e.target.value) }))}
                                className="input py-0.5 text-xs w-16 h-auto" />
                            ) : (
                              <span className="text-gray-600">{s.max_bookings}</span>
                            )}
                          </td>

                          <td className="px-4 py-3">
                            <span className={s.booking_count > 0 ? 'badge-yellow' : 'badge-green'}>
                              {s.booking_count}/{s.max_bookings}
                            </span>
                          </td>

                          {/* Event — editable inline */}
                          <td className="px-4 py-3 text-xs" onClick={e => e.stopPropagation()}>
                            {isEditing ? (
                              <select value={rowEdit.event_id}
                                onChange={e => setRowEdit(r => ({ ...r, event_id: e.target.value }))}
                                className="input py-0.5 text-xs h-auto" style={{width:'auto'}}>
                                <option value="">— None —</option>
                                {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
                              </select>
                            ) : (
                              <span className="text-gray-400">
                                {s.event_id ? (events.find(e => e.id === s.event_id)?.name ?? '—') : '—'}
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-2 text-right" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-2">
                              {isEditing ? (
                                <>
                                  <button onClick={() => saveRowEdit(s.id)}
                                    className="text-xs text-lime-600 hover:text-lime-800 font-semibold">Save</button>
                                  <button onClick={() => setEditingRow(null)}
                                    className="text-xs text-gray-400 hover:text-gray-600 font-semibold">Cancel</button>
                                </>
                              ) : (
                                <>
                                  <button onClick={() => startRowEdit(s)}
                                    className="text-xs text-coral-500 hover:text-coral-700 font-semibold">Edit</button>
                                  <button onClick={() => deleteSlot(s.id)}
                                    className="text-xs text-gray-300 hover:text-coral-500 font-semibold transition-colors">✕</button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <p className="text-[10px] text-sage-400 text-center py-2">
                  Click a row to select · {visibleSlots.length} slot{visibleSlots.length !== 1 ? 's' : ''}
                  {eventFilter !== '__all__' ? ` (filtered)` : ` total`}
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Add single ── */}
      {tab === 'add' && (
        <form onSubmit={addSingle} className="card max-w-md space-y-4">
          <h2 className="font-semibold text-gray-800 mb-2">Add a single slot</h2>
          <div>
            <label className="label">Start time</label>
            <input className="input" type="datetime-local" required value={single.start_time}
              onChange={e => setSingle(f => ({ ...f, start_time: e.target.value }))} />
          </div>
          <div>
            <label className="label">End time</label>
            <input className="input" type="datetime-local" required value={single.end_time}
              onChange={e => setSingle(f => ({ ...f, end_time: e.target.value }))} />
          </div>
          <div>
            <label className="label">Max bookings per slot</label>
            <input className="input" type="number" min="1" value={single.max_bookings}
              onChange={e => setSingle(f => ({ ...f, max_bookings: parseInt(e.target.value) }))} />
          </div>
          {events.length > 0 && (
            <div>
              <label className="label">Event <span className="text-sage-400 font-normal normal-case tracking-normal">optional</span></label>
              <select className="input" value={single.event_id}
                onChange={e => setSingle(f => ({ ...f, event_id: e.target.value }))}>
                <option value="">— All events / no event —</option>
                {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
              </select>
            </div>
          )}
          <button type="submit" disabled={saving} className="btn-primary disabled:opacity-60">
            {saving ? 'Adding…' : 'Add slot'}
          </button>
        </form>
      )}

      {/* ── Bulk generate ── */}
      {tab === 'bulk' && (
        <form onSubmit={addBulk} className="card max-w-lg space-y-4">
          <h2 className="font-semibold text-gray-800 mb-2">Bulk generate slots</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">From date</label>
              <input className="input" type="date" required value={bulk.dateFrom}
                onChange={e => setBulk(f => ({ ...f, dateFrom: e.target.value }))} />
            </div>
            <div>
              <label className="label">To date</label>
              <input className="input" type="date" required value={bulk.dateTo}
                onChange={e => setBulk(f => ({ ...f, dateTo: e.target.value }))} />
            </div>
            <div>
              <label className="label">Start hour (0–23)</label>
              <input className="input" type="number" min="0" max="23" value={bulk.startHour}
                onChange={e => setBulk(f => ({ ...f, startHour: parseInt(e.target.value) }))} />
            </div>
            <div>
              <label className="label">End hour (0–23)</label>
              <input className="input" type="number" min="1" max="24" value={bulk.endHour}
                onChange={e => setBulk(f => ({ ...f, endHour: parseInt(e.target.value) }))} />
            </div>
            <div>
              <label className="label">Slot duration (min)</label>
              <input className="input" type="number" min="5" step="5" value={bulk.duration}
                onChange={e => setBulk(f => ({ ...f, duration: parseInt(e.target.value) }))} />
            </div>
            <div>
              <label className="label">Buffer after slot (min)
                <span className="ml-1 text-sage-400 normal-case font-normal tracking-normal">gap</span>
              </label>
              <input className="input" type="number" min="0" step="5" value={bulk.buffer}
                onChange={e => setBulk(f => ({ ...f, buffer: parseInt(e.target.value) || 0 }))} />
            </div>
            <div>
              <label className="label">Max bookings / slot</label>
              <input className="input" type="number" min="1" value={bulk.max_bookings}
                onChange={e => setBulk(f => ({ ...f, max_bookings: parseInt(e.target.value) }))} />
            </div>
          </div>
          <div>
            <label className="label">Days of week</label>
            <div className="flex flex-wrap gap-2">
              {DAY_LABELS.map((d, i) => {
                const on = bulk.days.includes(i)
                return (
                  <button type="button" key={d}
                    onClick={() => setBulk(f => ({ ...f, days: on ? f.days.filter(x => x !== i) : [...f.days, i] }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all
                      ${on ? 'bg-coral-500 text-white border-coral-500' : 'bg-white text-gray-600 border-sage-200 hover:border-coral-400'}`}>
                    {d}
                  </button>
                )
              })}
            </div>
          </div>
          {events.length > 0 && (
            <div>
              <label className="label">Event <span className="text-sage-400 font-normal normal-case tracking-normal">optional</span></label>
              <select className="input" value={bulk.event_id}
                onChange={e => setBulk(f => ({ ...f, event_id: e.target.value }))}>
                <option value="">— All events / no event —</option>
                {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
              </select>
            </div>
          )}
          <button type="submit" disabled={saving} className="btn-primary disabled:opacity-60">
            {saving ? 'Generating…' : 'Generate slots'}
          </button>
        </form>
      )}
    </div>
  )
}
