'use client'

import { useState, useEffect } from 'react'
import { format, parseISO } from 'date-fns'

function fmt(iso) {
  try { return format(parseISO(iso), 'EEEE, d MMMM yyyy · h:mm a') } catch { return iso }
}
function fmtShort(iso) {
  try { return format(parseISO(iso), 'EEE d MMM · h:mm a') } catch { return iso }
}

function toICSFloating(iso) {
  if (!iso) return ''
  return iso.replace(' ', 'T').replace(/[-:]/g, '').replace(/\.\d+/, '').slice(0, 15)
}
function toICSUtc(iso) {
  if (!iso) return ''
  return iso.replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z').slice(0, 16)
}
function googleCalUrl({ summary, start, end, description }) {
  const params = new URLSearchParams({
    action: 'TEMPLATE', text: summary,
    dates: `${toICSFloating(start)}/${toICSFloating(end)}`,
    details: description || '',
  })
  return `https://calendar.google.com/calendar/render?${params}`
}
function downloadICS({ uid, summary, start, end, description }) {
  const content = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//BookingApp//EN',
    'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    `UID:${uid}`, `DTSTAMP:${toICSUtc(new Date().toISOString())}`,
    `DTSTART:${toICSFloating(start)}`, `DTEND:${toICSFloating(end)}`,
    `SUMMARY:${summary}`, description ? `DESCRIPTION:${description}` : '',
    'END:VEVENT', 'END:VCALENDAR',
  ].filter(Boolean).join('\r\n')
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = 'booking.ics'; a.click()
  URL.revokeObjectURL(url)
}

export default function ManageBookingPage({ params }) {
  const { id } = params

  const [booking, setBooking]       = useState(null)
  const [slots, setSlots]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [action, setAction]         = useState(null)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone]             = useState(null)
  const [error, setError]           = useState('')

  useEffect(() => {
    Promise.all([
      fetch(`/api/bookings/${id}`).then(r => r.ok ? r.json() : null),
      fetch('/api/slots?available=true').then(r => r.json()),
    ]).then(([b, s]) => {
      setBooking(b)
      setSlots(Array.isArray(s) ? s : [])
    }).finally(() => setLoading(false))
  }, [id])

  async function handleAction() {
    setError('')
    setSubmitting(true)
    try {
      const body = { action }
      if (action === 'reschedule' && selectedSlot) body.slot_id = selectedSlot
      const res = await fetch(`/api/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setDone(action)
      setBooking(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-sage-100 flex items-center justify-center">
        <svg className="w-5 h-5 animate-spin text-sage-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
      </div>
    )
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-sage-100 flex items-center justify-center p-4">
        <div className="card text-center max-w-sm w-full">
          <div className="w-12 h-12 bg-sage-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-sage-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="font-bold text-gray-800 mb-1">Booking not found</p>
          <p className="text-sm text-gray-400 mb-5">Check your booking ID and try again.</p>
          <a href="/" className="btn-primary w-full">Book a new slot</a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-sage-100">
      <header className="bg-white/80 backdrop-blur-sm border-b border-sage-200">
        <div className="max-w-lg mx-auto px-4 py-3.5 flex items-center gap-3">
          <a href="/" className="text-sm font-semibold text-sage-600 hover:text-sage-800">←</a>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-coral-500 rounded-lg flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="font-bold text-gray-900 text-sm">Manage Booking</span>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="card">

          {/* Booking info */}
          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-sage-500 mb-0.5">Booking for</p>
              <p className="font-bold text-lg text-gray-900 leading-tight">{booking.name}</p>
              <p className="text-sm text-gray-400">{booking.email}</p>
            </div>
            <span className={booking.status === 'confirmed' ? 'badge-green' : 'badge-red'}>
              {booking.status}
            </span>
          </div>

          {/* Time */}
          <div className="bg-sage-50 border border-sage-200 rounded-2xl p-4 mb-6">
            <p className="text-[10px] font-bold uppercase tracking-widest text-sage-500 mb-1">Scheduled time</p>
            <p className="font-semibold text-gray-800 text-sm">{fmt(booking.start_time)}</p>
          </div>

          {/* ── Success states ── */}
          {done === 'cancel' && (
            <div className="text-center py-4">
              <div className="w-12 h-12 bg-coral-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-coral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <p className="font-bold text-gray-800 mb-1">Booking cancelled</p>
              <p className="text-sm text-gray-400 mb-5">Your slot has been released.</p>
              <a href="/" className="btn-primary w-full">Book a new slot</a>
            </div>
          )}

          {done === 'reschedule' && (
            <div className="py-2">
              <div className="text-center mb-5">
                <div className="w-12 h-12 bg-lime-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-lime-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="font-bold text-gray-800 mb-1">Rescheduled!</p>
                <p className="text-sm text-gray-400">New time: {fmt(booking.start_time)}</p>
              </div>
              <div className="bg-sage-50 border border-sage-200 rounded-2xl p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-sage-500 mb-3">
                  Update your calendar
                </p>
                <div className="flex gap-2 flex-wrap">
                  <a
                    href={googleCalUrl({
                      summary: 'My Booking',
                      start: booking.start_time,
                      end: booking.end_time,
                      description: `Booking ID: ${booking.id}`,
                    })}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-sage-200
                               hover:border-coral-400 rounded-xl text-sm font-semibold text-gray-700
                               hover:text-coral-600 transition-all">
                    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Google Calendar
                  </a>
                  <button
                    onClick={() => downloadICS({
                      uid: booking.id,
                      summary: 'My Booking',
                      start: booking.start_time,
                      end: booking.end_time,
                      description: `Booking ID: ${booking.id}`,
                    })}
                    className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-sage-200
                               hover:border-coral-400 rounded-xl text-sm font-semibold text-gray-700
                               hover:text-coral-600 transition-all">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Apple / Outlook (.ics)
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Action buttons ── */}
          {booking.status === 'confirmed' && !done && !action && (
            <div className="flex gap-2.5">
              <button onClick={() => setAction('reschedule')} className="btn-secondary flex-1">
                <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Reschedule
              </button>
              <button onClick={() => setAction('cancel')} className="btn-danger flex-1">
                Cancel booking
              </button>
            </div>
          )}

          {/* ── Cancel confirm ── */}
          {action === 'cancel' && !done && (
            <div>
              <div className="bg-coral-50 border border-coral-100 rounded-xl p-4 mb-4">
                <p className="text-sm font-semibold text-coral-700 mb-1">Cancel this booking?</p>
                <p className="text-xs text-coral-500">This will free up your slot. This cannot be undone.</p>
              </div>
              {error && <p className="text-sm text-coral-600 mb-3">{error}</p>}
              <div className="flex gap-2.5">
                <button onClick={() => setAction(null)} className="btn-secondary flex-1">Keep it</button>
                <button onClick={handleAction} disabled={submitting}
                  className="btn-danger flex-1 disabled:opacity-60">
                  {submitting ? 'Cancelling…' : 'Yes, cancel'}
                </button>
              </div>
            </div>
          )}

          {/* ── Reschedule ── */}
          {action === 'reschedule' && !done && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-3">Select a new time</p>
              <p className="text-xs text-gray-400 mb-3">
                Choose "Next available" to auto-pick, or select a specific slot.
              </p>

              {slots.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center bg-sage-50 rounded-xl">
                  No other slots available.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-64 overflow-y-auto mb-4 pr-0.5">
                  {/* Auto */}
                  <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all
                    ${selectedSlot === null ? 'border-coral-400 bg-coral-50' : 'border-sage-200 hover:border-sage-300 bg-white'}`}>
                    <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0
                      ${selectedSlot === null ? 'border-coral-500 bg-coral-500' : 'border-sage-300'}`}>
                      {selectedSlot === null && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </span>
                    <input type="radio" name="slot" value="" checked={selectedSlot === null}
                      onChange={() => setSelectedSlot(null)} className="sr-only" />
                    <span className="text-sm font-semibold text-coral-600">Next available (auto)</span>
                  </label>

                  {slots.filter(s => s.id !== booking.slot_id).map(s => (
                    <label key={s.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all
                        ${selectedSlot === s.id ? 'border-coral-400 bg-coral-50' : 'border-sage-200 hover:border-sage-300 bg-white'}`}>
                      <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0
                        ${selectedSlot === s.id ? 'border-coral-500 bg-coral-500' : 'border-sage-300'}`}>
                        {selectedSlot === s.id && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </span>
                      <input type="radio" name="slot" value={s.id} checked={selectedSlot === s.id}
                        onChange={() => setSelectedSlot(s.id)} className="sr-only" />
                      <span className="text-sm text-gray-700">{fmtShort(s.start_time)}</span>
                    </label>
                  ))}
                </div>
              )}

              {error && <p className="text-sm text-coral-600 mb-3">{error}</p>}

              <div className="flex gap-2.5">
                <button onClick={() => { setAction(null); setSelectedSlot(null) }}
                  className="btn-secondary flex-1">Back</button>
                <button onClick={handleAction} disabled={submitting}
                  className="btn-primary flex-1 disabled:opacity-60">
                  {submitting ? 'Moving…' : 'Confirm'}
                </button>
              </div>
            </div>
          )}

          {booking.status === 'cancelled' && !done && (
            <div className="text-center py-2">
              <p className="text-sm text-gray-400 mb-4">This booking was cancelled.</p>
              <a href="/" className="btn-primary w-full">Book a new slot</a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
