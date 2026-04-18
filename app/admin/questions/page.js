'use client'

import { useState, useEffect, useRef } from 'react'

const TYPE_LABELS = { text: 'Short text', textarea: 'Long text', select: 'Dropdown', radio: 'Radio', checkbox: 'Checkboxes' }

export default function QuestionsAdmin() {
  const [questions, setQuestions] = useState([])
  const [loading, setLoading]     = useState(true)
  const [editing, setEditing]     = useState(null)
  const [feedback, setFeedback]   = useState('')
  const [events, setEvents]       = useState([])

  // Drag-and-drop state
  const dragIdx = useRef(null)
  const [dragging, setDragging] = useState(null)

  const empty = { label: '', type: 'text', options: [], required: true, active: true, event_id: '' }
  const [form, setForm]             = useState(empty)
  const [optionInput, setOptionInput] = useState('')

  function load() {
    setLoading(true)
    Promise.all([
      fetch('/api/questions?all=true', { credentials: 'same-origin' }).then(r => r.json()),
      fetch('/api/events?all=true', { credentials: 'same-origin' }).then(r => r.json()),
    ]).then(([q, e]) => {
      setQuestions(Array.isArray(q) ? q : [])
      setEvents(Array.isArray(e) ? e : [])
    }).finally(() => setLoading(false))
  }
  useEffect(load, [])

  function startEdit(q) {
    setEditing(q.id)
    setForm({ ...q, options: Array.isArray(q.options) ? q.options : [], event_id: q.event_id || '' })
    setOptionInput('')
  }
  function startNew()  { setEditing('new'); setForm(empty); setOptionInput('') }
  function cancel()    { setEditing(null) }

  async function save(e) {
    e.preventDefault()
    try {
      let res
      const payload = { ...form, event_id: form.event_id || null }
      if (editing === 'new') {
        res = await fetch('/api/questions', {
          method: 'POST', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        res = await fetch('/api/questions', {
          method: 'PUT', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editing, ...payload }),
        })
      }
      if (!res.ok) throw new Error((await res.json()).error)
      setFeedback('Saved!')
      setEditing(null)
      load()
    } catch (err) { setFeedback(`Error: ${err.message}`) }
  }

  async function deleteQ(id) {
    if (!confirm('Delete this question?')) return
    await fetch(`/api/questions?id=${id}`, { method: 'DELETE', credentials: 'same-origin' })
    load()
  }

  async function toggleActive(q) {
    await fetch('/api/questions', {
      method: 'PUT', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: q.id, active: !q.active }),
    })
    load()
  }

  // ── Drag-and-drop handlers ────────────────────────────

  function onDragStart(e, i) {
    dragIdx.current = i
    setDragging(i)
    e.dataTransfer.effectAllowed = 'move'
  }

  function onDragOver(e, i) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragIdx.current === null || dragIdx.current === i) return
    setQuestions(prev => {
      const next = [...prev]
      const [moved] = next.splice(dragIdx.current, 1)
      next.splice(i, 0, moved)
      dragIdx.current = i
      return next
    })
  }

  async function onDrop() {
    setDragging(null)
    dragIdx.current = null
    await fetch('/api/questions/reorder', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: questions.map(q => q.id) }),
    })
  }

  function onDragEnd() { setDragging(null); dragIdx.current = null }

  const hasOptions = ['select', 'radio', 'checkbox'].includes(form.type)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Custom Questions</h1>
          <p className="text-sm text-gray-500 mt-0.5">Questions shown on the booking form. Drag rows to reorder.</p>
        </div>
        {!editing && (
          <button onClick={startNew} className="btn-primary btn-sm">+ Add question</button>
        )}
      </div>

      {feedback && (
        <div className={`text-sm px-4 py-2.5 rounded-xl mb-4 font-medium border ${feedback.startsWith('Error') ? 'bg-coral-50 text-coral-700 border-coral-100' : 'bg-lime-100 text-lime-700 border-lime-200'}`}>
          {feedback}
          <button onClick={() => setFeedback('')} className="ml-2 opacity-60">✕</button>
        </div>
      )}

      {/* ── Edit / New form ── */}
      {editing && (
        <form onSubmit={save} className="card mb-6 space-y-4">
          <h2 className="font-semibold">{editing === 'new' ? 'New question' : 'Edit question'}</h2>

          <div>
            <label className="label">
              Question label <span className="text-coral-500 normal-case tracking-normal font-normal">*</span>
            </label>
            <input className="input" required value={form.label}
              onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              placeholder="e.g. What is your main goal?" />
          </div>

          <div>
            <label className="label">Type</label>
            <select className="input" value={form.type}
              onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              {Object.entries(TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.required}
                onChange={e => setForm(f => ({ ...f, required: e.target.checked }))} />
              Required
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.active}
                onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} />
              Active (shown on form)
            </label>
          </div>

          {events.length > 0 && (
            <div>
              <label className="label">Show for event <span className="text-sage-400 font-normal normal-case tracking-normal">leave blank to show for all events</span></label>
              <select className="input" value={form.event_id || ''}
                onChange={e => setForm(f => ({ ...f, event_id: e.target.value }))}>
                <option value="">— All events —</option>
                {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
              </select>
            </div>
          )}

          {hasOptions && (
            <div>
              <label className="label">Options</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {form.options.map((o, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-3 py-1 bg-sage-100 rounded-full text-sm">
                    {o}
                    <button type="button"
                      onClick={() => setForm(f => ({ ...f, options: f.options.filter((_, j) => j !== i) }))}
                      className="text-sage-400 hover:text-coral-500 ml-1">✕</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input className="input" value={optionInput}
                  onChange={e => setOptionInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      if (optionInput.trim()) {
                        setForm(f => ({ ...f, options: [...f.options, optionInput.trim()] }))
                        setOptionInput('')
                      }
                    }
                  }}
                  placeholder="Type an option and press Enter" />
                <button type="button" className="btn-secondary btn-sm whitespace-nowrap"
                  onClick={() => {
                    if (optionInput.trim()) {
                      setForm(f => ({ ...f, options: [...f.options, optionInput.trim()] }))
                      setOptionInput('')
                    }
                  }}>Add</button>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="submit" className="btn-primary">Save</button>
            <button type="button" onClick={cancel} className="btn-secondary">Cancel</button>
          </div>
        </form>
      )}

      {/* ── Draggable question list ── */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <div className="w-4 h-4 border-2 border-sage-200 border-t-coral-400 rounded-full animate-spin" />
          Loading…
        </div>
      ) : questions.length === 0 ? (
        <div className="card text-center py-8 text-gray-400 text-sm">
          No questions yet. Click "Add question" to get started.
        </div>
      ) : (
        <div className="space-y-2">
          {questions.map((q, i) => (
            <div
              key={q.id}
              draggable
              onDragStart={e => onDragStart(e, i)}
              onDragOver={e => onDragOver(e, i)}
              onDrop={onDrop}
              onDragEnd={onDragEnd}
              className={`card flex items-center gap-3 py-3.5 select-none
                cursor-grab active:cursor-grabbing transition-all duration-100
                ${dragging === i ? 'opacity-40 ring-2 ring-coral-300' : 'hover:shadow-card-hover'}
                ${!q.active ? 'opacity-50' : ''}`}>

              {/* Drag handle — three horizontal lines */}
              <div className="flex flex-col gap-[3px] flex-shrink-0 pl-1 text-sage-300 hover:text-sage-500">
                {[0,1,2].map(n => (
                  <span key={n} className="block w-4 h-0.5 bg-current rounded-full" />
                ))}
              </div>

              {/* Position number */}
              <span className="w-5 h-5 flex-shrink-0 flex items-center justify-center rounded-full
                               bg-sage-100 text-sage-600 text-[10px] font-bold leading-none">
                {i + 1}
              </span>

              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-900 text-sm truncate">{q.label}</p>
                <div className="flex gap-1.5 mt-0.5 flex-wrap">
                  <span className="badge bg-sage-100 text-sage-700">{TYPE_LABELS[q.type] || q.type}</span>
                  {q.required && <span className="badge bg-amber-100 text-amber-700">Required</span>}
                  {!q.active  && <span className="badge-red">Hidden</span>}
                  {q.event_id && (
                    <span className="badge bg-indigo-50 text-indigo-600">
                      {events.find(e => e.id === q.event_id)?.name ?? 'Event'}
                    </span>
                  )}
                  {q.options?.length > 0 && (
                    <span className="text-[10px] text-gray-400 self-center">{q.options.length} options</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2.5 flex-shrink-0">
                <button onClick={() => toggleActive(q)}
                  className="text-xs text-gray-400 hover:text-gray-700 font-semibold">
                  {q.active ? 'Hide' : 'Show'}
                </button>
                <button onClick={() => startEdit(q)}
                  className="text-xs text-coral-500 hover:text-coral-700 font-semibold">Edit</button>
                <button onClick={() => deleteQ(q.id)}
                  className="text-xs text-gray-300 hover:text-coral-500 font-semibold transition-colors">✕</button>
              </div>
            </div>
          ))}

          <p className="text-[10px] text-sage-400 text-center pt-1">
            ⠿ Drag rows to reorder · changes save automatically
          </p>
        </div>
      )}
    </div>
  )
}
