'use client'

import { useState, useEffect } from 'react'
import { format, parseISO } from 'date-fns'

function fmt(iso) {
  try { return format(parseISO(iso), 'dd MMM yyyy, h:mm a') } catch { return iso }
}

function parseAnswers(raw) {
  if (!raw) return {}
  if (typeof raw === 'object') return raw
  try { return JSON.parse(raw) } catch { return {} }
}

function exportPDF(bookings, questions, eventName) {
  const confirmed = bookings.filter(b => b.status === 'confirmed')

  // Group by slot time
  const slotMap = {}
  for (const b of confirmed) {
    const key = b.start_time
    if (!slotMap[key]) slotMap[key] = { start: b.start_time, end: b.end_time, attendees: [] }
    slotMap[key].attendees.push(b)
  }
  const slots = Object.values(slotMap).sort((a, b) => a.start.localeCompare(b.start))

  const qCols = questions.filter(q => q.label)

  const slotRows = slots.map(slot => {
    const timeLabel = fmt(slot.start)
    const rows = slot.attendees.map((b, i) => {
      const ans = parseAnswers(b.answers)
      const extraCols = qCols.map(q => {
        const val = ans[q.id]
        return `<td>${Array.isArray(val) ? val.join(', ') : (val ?? '—')}</td>`
      }).join('')
      return `<tr class="${i % 2 === 1 ? 'alt' : ''}">
        <td>${b.name}</td>
        <td>${b.email}</td>
        <td>${b.phone || '—'}</td>
        ${extraCols}
      </tr>`
    }).join('')

    const extraHeaders = qCols.map(q => `<th>${q.label}</th>`).join('')

    return `
      <div class="slot-block">
        <div class="slot-header">${timeLabel}</div>
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Phone</th>${extraHeaders}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`
  }).join('')

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${eventName || 'Bookings'}</title>
<style>
  @page { size: A4; margin: 18mm 14mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 9pt; color: #1a1a1a; }
  h1 { font-size: 15pt; font-weight: 700; margin-bottom: 2mm; }
  .meta { font-size: 8pt; color: #666; margin-bottom: 8mm; }
  .slot-block { break-inside: avoid; margin-bottom: 6mm; }
  .slot-header {
    font-size: 10pt; font-weight: 700;
    background: #1a1a1a; color: #fff;
    padding: 2.5mm 3mm; border-radius: 2mm 2mm 0 0;
  }
  table { width: 100%; border-collapse: collapse; }
  th {
    font-size: 7.5pt; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.03em; color: #555;
    padding: 2mm 3mm; border-bottom: 0.3mm solid #ddd;
    text-align: left; background: #f5f5f5;
  }
  td { padding: 1.8mm 3mm; font-size: 8.5pt; border-bottom: 0.2mm solid #eee; }
  tr.alt td { background: #fafafa; }
  .footer { margin-top: 8mm; font-size: 7.5pt; color: #aaa; text-align: right; }
</style>
</head>
<body>
<h1>${eventName || 'Bookings'}</h1>
<p class="meta">Exported on ${format(new Date(), 'dd MMM yyyy, h:mm a')} &nbsp;·&nbsp; ${confirmed.length} confirmed attendee${confirmed.length !== 1 ? 's' : ''}</p>
${slotRows || '<p style="color:#999">No confirmed bookings.</p>'}
<div class="footer">Printed from the booking dashboard</div>
</body>
</html>`

  const w = window.open('', '_blank', 'width=794,height=1123')
  w.document.write(html)
  w.document.close()
  w.onload = () => { w.focus(); w.print() }
}

function exportCSV(bookings, questions, eventName) {
  const qCols = questions.filter(q => q.label)
  const headers = ['Name', 'Email', 'Phone', 'Slot', 'Status', 'Booking ID', 'Booked on',
    ...qCols.map(q => q.label)]
  const rows = bookings.map(b => {
    const ans = parseAnswers(b.answers)
    const ansArr = Array.isArray(ans[qCols[0]?.id]) // checkbox
      ? qCols.map(q => Array.isArray(ans[q.id]) ? ans[q.id].join('; ') : (ans[q.id] ?? ''))
      : qCols.map(q => Array.isArray(ans[q.id]) ? ans[q.id].join('; ') : (ans[q.id] ?? ''))
    return [
      b.name, b.email, b.phone || '', fmt(b.start_time), b.status, b.id, fmt(b.created_at),
      ...ansArr,
    ]
  })
  const csv = [headers, ...rows]
    .map(row => row.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `${(eventName || 'bookings').toLowerCase().replace(/\s+/g, '-')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function AdminDashboard() {
  const [bookings,  setBookings]  = useState([])
  const [events,    setEvents]    = useState([])
  const [questions, setQuestions] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [activeTab, setActiveTab] = useState('__all__')

  useEffect(() => {
    Promise.all([
      fetch('/api/bookings', { credentials: 'same-origin' }).then(r => r.json()),
      fetch('/api/events?all=true', { credentials: 'same-origin' }).then(r => r.json()),
      fetch('/api/questions?all=true', { credentials: 'same-origin' }).then(r => r.json()),
    ]).then(([b, e, q]) => {
      setBookings(Array.isArray(b) ? b : [])
      setEvents(Array.isArray(e) ? e : [])
      setQuestions(Array.isArray(q) ? q : [])
    }).finally(() => setLoading(false))
  }, [])

  // ── Derived data ────────────────────────────────────────
  function bookingsForTab(tabKey) {
    if (tabKey === '__all__')   return bookings
    if (tabKey === '__none__')  return bookings.filter(b => !b.slot_event_id)
    return bookings.filter(b => b.slot_event_id === tabKey)
  }

  function questionsForTab(tabKey) {
    if (tabKey === '__all__' || tabKey === '__none__') return questions
    return questions.filter(q => !q.event_id || q.event_id === tabKey)
  }

  const tabs = [
    { key: '__all__', label: 'All', color: null },
    ...events.map(ev => ({ key: ev.id, label: ev.name, color: ev.color })),
    ...(bookings.some(b => !b.slot_event_id) ? [{ key: '__none__', label: 'Unassigned', color: null }] : []),
  ]

  const visibleBookings  = bookingsForTab(activeTab)
  const visibleQuestions = questionsForTab(activeTab)
  const confirmed = visibleBookings.filter(b => b.status === 'confirmed')
  const cancelled = visibleBookings.filter(b => b.status === 'cancelled')

  const activeEvent = events.find(e => e.id === activeTab)

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
      </div>
      <p className="text-sm text-gray-400 mb-6">Bookings overview by event.</p>

      {/* Event tabs */}
      {(events.length > 0 || tabs.length > 1) && (
        <div className="flex flex-wrap gap-1.5 mb-6">
          {tabs.map(({ key, label, color }) => (
            <button key={key} onClick={() => setActiveTab(key)}
              style={activeTab === key && color ? { background: color, borderColor: color, color: '#fff' } : {}}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border-2 transition-all
                ${activeTab === key && !color
                  ? 'bg-gray-900 text-white border-gray-900'
                  : activeTab !== key
                    ? 'bg-white text-gray-500 border-sage-200 hover:border-gray-400'
                    : ''
                }`}>
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="card py-5">
          <p className="text-4xl font-bold leading-none mb-1.5"
            style={{ color: activeEvent?.color || '#e85c45' }}>
            {confirmed.length}
          </p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Confirmed</p>
        </div>
        <div className="card py-5">
          <p className="text-4xl font-bold text-gray-300 leading-none mb-1.5">{cancelled.length}</p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Cancelled</p>
        </div>
        <div className="card py-5">
          <p className="text-4xl font-bold text-sage-500 leading-none mb-1.5">{visibleBookings.length}</p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Total</p>
        </div>
      </div>

      {/* Table header + export */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-gray-700">
          {activeEvent ? activeEvent.name : activeTab === '__none__' ? 'Unassigned' : 'All bookings'}
          <span className="ml-2 text-gray-400 font-normal">{confirmed.length} confirmed</span>
        </h2>
        {visibleBookings.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportPDF(
                visibleBookings,
                visibleQuestions,
                activeEvent?.name || (activeTab === '__none__' ? 'Unassigned' : 'All Bookings')
              )}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 border-sage-200
                         hover:border-coral-400 text-xs font-semibold text-gray-600 hover:text-coral-600 transition-all">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print / PDF
            </button>
            <button
              onClick={() => exportCSV(
                visibleBookings.filter(b => b.status === 'confirmed'),
                visibleQuestions,
                activeEvent?.name || (activeTab === '__none__' ? 'unassigned' : 'all')
              )}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 border-sage-200
                         hover:border-coral-400 text-xs font-semibold text-gray-600 hover:text-coral-600 transition-all">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export CSV
            </button>
          </div>
        )}
      </div>

      {/* Bookings table */}
      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-400">
            <div className="w-4 h-4 border-2 border-sage-200 border-t-coral-400 rounded-full animate-spin" />
            Loading…
          </div>
        ) : visibleBookings.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm font-semibold text-gray-500">No bookings yet</p>
            <p className="text-xs text-gray-400 mt-1">They'll appear here once users start booking.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-sage-50 border-b border-sage-100">
                  {['Name', 'Email', 'Phone', 'Slot', 'Status', 'Booked on',
                    ...visibleQuestions.map(q => q.label)
                  ].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-sage-500 whitespace-nowrap">{h}</th>
                  ))}
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-sage-50">
                {visibleBookings.map(b => {
                  const ans = parseAnswers(b.answers)
                  return (
                    <tr key={b.id} className="hover:bg-sage-50/60 transition-colors">
                      <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">{b.name}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{b.email}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{b.phone || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmt(b.start_time)}</td>
                      <td className="px-4 py-3">
                        <span className={b.status === 'confirmed' ? 'badge-green' : 'badge-red'}>
                          {b.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{fmt(b.created_at)}</td>
                      {visibleQuestions.map(q => {
                        const val = ans[q.id]
                        const display = Array.isArray(val) ? val.join(', ') : (val ?? '—')
                        return (
                          <td key={q.id} className="px-4 py-3 text-gray-600 text-xs max-w-[180px] truncate" title={display}>
                            {display}
                          </td>
                        )
                      })}
                      <td className="px-4 py-3 text-right">
                        <a href={`/manage/${b.id}`} target="_blank"
                          className="text-xs text-coral-500 hover:text-coral-700 font-semibold">
                          View →
                        </a>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
