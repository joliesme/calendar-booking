'use client'

import { useState, useEffect } from 'react'
import { format, parseISO } from 'date-fns'

// ── Helpers ──────────────────────────────────────────────

function fmt(iso) {
  try { return format(parseISO(iso), 'EEE d MMM, h:mm a') } catch { return iso }
}
function fmtDate(iso) {
  try { return format(parseISO(iso), 'EEEE, d MMMM yyyy') } catch { return iso }
}
function fmtTime(iso) {
  try { return format(parseISO(iso), 'h:mm a') } catch { return iso }
}

// ── Calendar helpers ─────────────────────────────────────

/** Floating local time for DTSTART/DTEND — no Z suffix so calendar apps use local timezone */
function toICSFloating(iso) {
  if (!iso) return ''
  return iso.replace(' ', 'T').replace(/[-:]/g, '').replace(/\.\d+/, '').slice(0, 15)
}

/** UTC time for DTSTAMP — always Z suffix */
function toICSUtc(iso) {
  if (!iso) return ''
  return iso.replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z').slice(0, 16)
}

/** Download a .ics file so the user can add the event to any calendar app */
function downloadICS({ summary, start, end, description, uid }) {
  const content = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BookingApp//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${toICSUtc(new Date().toISOString())}`,
    `DTSTART:${toICSFloating(start)}`,
    `DTEND:${toICSFloating(end)}`,
    `SUMMARY:${summary}`,
    description ? `DESCRIPTION:${description}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n')

  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = 'booking.ics'
  a.click()
  URL.revokeObjectURL(url)
}

/** Build a Google Calendar "add event" URL — floating local time, no Z */
function googleCalUrl({ summary, start, end, description }) {
  const params = new URLSearchParams({
    action:  'TEMPLATE',
    text:    summary,
    dates:   `${toICSFloating(start)}/${toICSFloating(end)}`,
    details: description || '',
  })
  return `https://calendar.google.com/calendar/render?${params}`
}

function groupByDate(slots) {
  const groups = {}
  for (const s of slots) {
    const day = s.start_time.slice(0, 10)
    if (!groups[day]) groups[day] = []
    groups[day].push(s)
  }
  return groups
}

// ── Ad Lightbox ──────────────────────────────────────────

function AdLightbox({ ad, onClose }) {
  if (!ad) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl max-w-sm w-full overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {ad.image_url && (
          <img src={ad.image_url} alt={ad.title} className="w-full h-48 object-cover" />
        )}
        <div className="p-5">
          <p className="text-[9px] uppercase tracking-widest text-sage-500 font-bold mb-1">{ad.label || 'Sponsored'}</p>
          <p className="font-bold text-gray-900 text-base leading-snug mb-2">{ad.title}</p>
          {ad.description && (
            <p className="text-sm text-gray-500 leading-relaxed">{ad.description}</p>
          )}
          <div className="flex gap-3 mt-4">
            {ad.link_url && (
              <a href={ad.link_url} target="_blank" rel="noopener noreferrer"
                className="btn-primary text-sm flex-1 text-center">
                Learn more →
              </a>
            )}
            <button onClick={onClose}
              className="btn-secondary text-sm px-4">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Ad Banner ────────────────────────────────────────────

function AdBanner({ ad, onExpand }) {
  if (!ad) return null
  return (
    <button
      type="button"
      onClick={() => onExpand(ad)}
      className="w-full text-left block"
    >
      <div className="flex items-center gap-3 p-3.5 bg-white rounded-2xl shadow-card
                      border border-sage-100 hover:shadow-card-hover transition-shadow">
        {ad.image_url && (
          <img src={ad.image_url} alt={ad.title}
               className="w-12 h-12 object-cover rounded-xl flex-shrink-0" />
        )}
        <div className="min-w-0">
          <p className="text-[9px] uppercase tracking-widest text-sage-500 font-bold mb-0.5">{ad.label || 'Sponsored'}</p>
          <p className="font-semibold text-sm text-gray-800 truncate leading-tight">{ad.title}</p>
          {ad.description && (
            <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{ad.description}</p>
          )}
        </div>
        <span className="ml-auto text-coral-500 text-xs font-semibold flex-shrink-0">↗</span>
      </div>
    </button>
  )
}

// ── Step Pills ───────────────────────────────────────────

function Steps({ current }) {
  const steps = ['Choose slot', 'Your details', 'Confirmed']
  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((label, i) => {
        const num  = i + 1
        const done = num < current
        const active = num === current
        return (
          <div key={label} className="flex items-center flex-1 last:flex-none">
            <div className="flex items-center gap-2">
              <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold
                ${done   ? 'bg-lime-400 text-white' :
                  active ? 'bg-coral-500 text-white' :
                           'bg-sage-200 text-sage-500'}`}>
                {done ? '✓' : num}
              </span>
              <span className={`text-xs font-semibold hidden sm:block
                ${active ? 'text-coral-500' : done ? 'text-sage-600' : 'text-gray-400'}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-px mx-3 ${done ? 'bg-lime-300' : 'bg-sage-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────

export default function HomePage() {
  const [step, setStep]           = useState(1)
  const [slots, setSlots]         = useState([])
  const [questions, setQuestions] = useState([])
  const [events, setEvents]       = useState([])
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [topAds, setTopAds]       = useState([])
  const [sideAds, setSideAds]     = useState([])
  const [bottomAds, setBottomAds] = useState([])
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [booking, setBooking]     = useState(null)
  const [loading, setLoading]     = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]         = useState('')

  const [form, setForm]       = useState({ name: '', email: '', phone: '' })
  const [answers, setAnswers] = useState({})
  const [duplicateBooking, setDuplicateBooking] = useState(null)

  // Find my booking
  const [lightboxAd, setLightboxAd] = useState(null)

  // Find my booking
  const [findOpen, setFindOpen]   = useState(false)
  const [findMode, setFindMode]   = useState('id') // 'id' | 'name'
  const [findId, setFindId]       = useState('')
  const [findForm, setFindForm]   = useState({ name: '', email: '' })
  const [findResults, setFindResults] = useState(null)
  const [finding, setFinding]     = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/slots?available=true').then(r => r.json()),
      fetch('/api/questions').then(r => r.json()),
      fetch('/api/events').then(r => r.json()),
      fetch('/api/ads?position=top').then(r => r.json()),
      fetch('/api/ads?position=sidebar').then(r => r.json()),
      fetch('/api/ads?position=bottom').then(r => r.json()),
    ]).then(([s, q, ev, ta, sa, ba]) => {
      setSlots(Array.isArray(s) ? s : [])
      setQuestions(Array.isArray(q) ? q : [])
      setEvents(Array.isArray(ev) ? ev : [])
      setTopAds(Array.isArray(ta) ? ta : [])
      setSideAds(Array.isArray(sa) ? sa : [])
      setBottomAds(Array.isArray(ba) ? ba : [])
    }).finally(() => setLoading(false))
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setDuplicateBooking(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slot_id: selectedSlot.id,
          name: form.name, email: form.email, phone: form.phone, answers,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.error === 'duplicate') {
          setDuplicateBooking(data.existing)
        } else {
          throw new Error(data.error || 'Booking failed')
        }
        return
      }
      setBooking(data)
      setStep(3)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleFind(e) {
    e.preventDefault()
    setFinding(true)
    setFindResults(null)
    try {
      if (findMode === 'id') {
        const res = await fetch(`/api/bookings/${findId.trim()}`)
        if (res.ok) {
          const data = await res.json()
          setFindResults(data ? [data] : [])
        } else {
          setFindResults([])
        }
      } else {
        const res = await fetch('/api/bookings/lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(findForm),
        })
        const data = await res.json()
        setFindResults(Array.isArray(data) ? data : [])
      }
    } finally {
      setFinding(false)
    }
  }

  // When events exist, filter slots/questions by selected event (null event_id = all events)
  const filteredSlots = events.length > 0 && selectedEvent
    ? slots.filter(s => !s.event_id || s.event_id === selectedEvent.id)
    : slots
  const filteredQuestions = selectedEvent
    ? questions.filter(q => !q.event_id || q.event_id === selectedEvent.id)
    : questions

  const grouped = groupByDate(filteredSlots)
  const totalSlots = filteredSlots.length

  return (
    <div className="min-h-screen bg-sage-100">
      <AdLightbox ad={lightboxAd} onClose={() => setLightboxAd(null)} />

      {/* ── Header ────────────────────────────────── */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-sage-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-coral-500 rounded-xl flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm leading-tight">Book a Slot</p>
              {totalSlots > 0 && (
                <p className="text-[10px] text-sage-500 font-medium leading-tight">
                  {totalSlots} time{totalSlots !== 1 ? 's' : ''} available
                </p>
              )}
            </div>
          </div>
          <a href="/admin" className="text-[11px] font-semibold text-sage-500 hover:text-sage-700 uppercase tracking-wider">
            Admin →
          </a>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6">

        {/* Top ads */}
        {topAds.length > 0 && (
          <div className={`grid gap-2.5 mb-5 ${topAds.length > 1 ? 'sm:grid-cols-2' : 'max-w-lg'}`}>
            {topAds.map(a => <AdBanner key={a.id} ad={a} onExpand={setLightboxAd} />)}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* ── Main card ────────────────────────── */}
          <div className="lg:col-span-2">
            <div className="card">
              <Steps current={step} />

              {/* Step 1 — pick slot */}
              {step === 1 && (
                <>
                  <h2 className="text-xl font-bold text-gray-900 mb-1">Pick a time</h2>
                  <p className="text-sm text-gray-400 mb-5">Choose from the available slots below.</p>

                  {/* Event selector */}
                  {events.length > 0 && (
                    <div className="mb-5">
                      <p className="text-[11px] font-bold uppercase tracking-widest text-sage-500 mb-2">Select event</p>
                      <div className="flex flex-wrap gap-2">
                        {events.map(ev => (
                          <button key={ev.id}
                            onClick={() => { setSelectedEvent(ev); setSelectedSlot(null) }}
                            style={selectedEvent?.id === ev.id ? { background: ev.color, borderColor: ev.color } : {}}
                            className={`px-4 py-2 rounded-xl border-2 text-sm font-semibold transition-all
                              ${selectedEvent?.id === ev.id
                                ? 'text-white shadow-sm'
                                : 'bg-white text-gray-700 border-sage-200 hover:border-coral-400 hover:text-coral-600'}`}>
                            {ev.name}
                          </button>
                        ))}
                      </div>
                      {selectedEvent?.description && (
                        <p className="text-xs text-gray-500 mt-2">{selectedEvent.description}</p>
                      )}
                    </div>
                  )}

                  {loading ? (
                    <div className="flex items-center gap-2 py-10 justify-center text-sage-400 text-sm">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      Loading slots…
                    </div>
                  ) : events.length > 0 && !selectedEvent ? (
                    <div className="py-10 text-center text-gray-400 text-sm">
                      <p>Select an event above to see available slots.</p>
                    </div>
                  ) : filteredSlots.length === 0 ? (
                    <div className="py-10 text-center">
                      <div className="w-12 h-12 bg-sage-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                        <svg className="w-6 h-6 text-sage-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <p className="text-sm font-semibold text-gray-600">No slots available</p>
                      <p className="text-xs text-gray-400 mt-1">Please check back later.</p>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {Object.entries(grouped).map(([date, daySlots]) => (
                        <div key={date}>
                          <p className="text-[11px] font-bold uppercase tracking-widest text-sage-500 mb-2.5">
                            {fmtDate(daySlots[0].start_time)}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {daySlots.map(slot => (
                              <button key={slot.id}
                                onClick={() => { setSelectedSlot(slot); setStep(2) }}
                                className={`px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all
                                  ${selectedSlot?.id === slot.id
                                    ? 'bg-coral-500 text-white border-coral-500 shadow-sm'
                                    : 'bg-white text-gray-700 border-sage-200 hover:border-coral-400 hover:text-coral-600 hover:bg-coral-50'
                                  }`}>
                                {fmtTime(slot.start_time)} – {fmtTime(slot.end_time)}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Step 2 — details form */}
              {step === 2 && (
                <form onSubmit={handleSubmit}>
                  <div className="flex items-center gap-2 mb-5 flex-wrap">
                    <button type="button" onClick={() => setStep(1)}
                      className="text-sm text-sage-600 hover:text-sage-800 font-semibold">← Back</button>
                    <span className="text-sage-300">|</span>
                    {selectedEvent && (
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold text-white"
                        style={{ background: selectedEvent.color }}>
                        {selectedEvent.name}
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 bg-sage-100 px-3 py-1 rounded-lg">
                      <svg className="w-3.5 h-3.5 text-coral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-xs font-semibold text-gray-600">{fmt(selectedSlot.start_time)}</span>
                    </div>
                  </div>

                  <h2 className="text-xl font-bold text-gray-900 mb-1">Your details</h2>
                  <p className="text-sm text-gray-400 mb-5">We'll send your confirmation to your email.</p>

                  <div className="space-y-4">
                    <div>
                      <label className="label">Full name <span className="text-coral-500 normal-case tracking-normal">*</span></label>
                      <input className="input" required value={form.name}
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="Jane Smith" />
                    </div>
                    <div>
                      <label className="label">Email <span className="text-coral-500 normal-case tracking-normal">*</span></label>
                      <input className="input" type="email" required value={form.email}
                        onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                        placeholder="jane@example.com" />
                    </div>
                    <div>
                      <label className="label">Phone <span className="text-gray-300 normal-case tracking-normal font-normal">optional</span></label>
                      <input className="input" type="tel" value={form.phone}
                        onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                        placeholder="+1 234 567 8900" />
                    </div>

                    {filteredQuestions.map(q => (
                      <div key={q.id}>
                        <label className="label">
                          {q.label}
                          {q.required
                            ? <span className="text-coral-500 normal-case tracking-normal"> *</span>
                            : <span className="text-gray-300 normal-case tracking-normal font-normal"> optional</span>
                          }
                        </label>
                        <QuestionInput q={q} value={answers[q.id] ?? ''} onChange={v =>
                          setAnswers(a => ({ ...a, [q.id]: v }))} />
                      </div>
                    ))}
                  </div>

                  {/* Duplicate booking warning */}
                  {duplicateBooking && (
                    <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
                      <p className="text-sm font-semibold text-amber-800 mb-1">
                        You already have a booking
                      </p>
                      <p className="text-xs text-amber-700 mb-3">
                        A booking for this name or email already exists on{' '}
                        <strong>{fmt(duplicateBooking.start_time)}</strong>.
                      </p>
                      <a href={`/manage/${duplicateBooking.id}`}
                        className="text-xs font-semibold text-amber-700 underline underline-offset-2">
                        View or manage existing booking →
                      </a>
                    </div>
                  )}

                  {error && (
                    <div className="mt-4 text-sm text-coral-600 bg-coral-50 border border-coral-100 rounded-xl px-4 py-3">
                      {error}
                    </div>
                  )}

                  <button type="submit" disabled={submitting}
                    className="btn-primary w-full mt-6 disabled:opacity-60 disabled:cursor-not-allowed">
                    {submitting ? 'Confirming…' : 'Confirm booking'}
                  </button>
                </form>
              )}

              {/* Step 3 — confirmed */}
              {step === 3 && booking && (
                <div className="py-4">
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-lime-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-lime-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-1">You're booked!</h2>
                    <p className="text-sm text-gray-400">{fmt(booking.start_time)}</p>
                  </div>

                  {/* Add to calendar */}
                  <div className="bg-sage-50 border border-sage-200 rounded-2xl p-4 mb-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-sage-500 mb-3">
                      Add to your calendar
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      {/* Google Calendar */}
                      <a
                        href={googleCalUrl({
                          summary:     'My Booking',
                          start:       booking.start_time,
                          end:         booking.end_time,
                          description: `Booking ID: ${booking.id}`,
                        })}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-sage-200
                                   hover:border-coral-400 rounded-xl text-sm font-semibold text-gray-700
                                   hover:text-coral-600 transition-all">
                        {/* Google coloured G icon */}
                        <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                        </svg>
                        Google Calendar
                      </a>

                      {/* .ics download — works for Apple Calendar, Outlook, etc. */}
                      <button
                        onClick={() => downloadICS({
                          uid:         booking.id,
                          summary:     'My Booking',
                          start:       booking.start_time,
                          end:         booking.end_time,
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

                  {/* Booking ID */}
                  <div className="bg-sage-50 border border-sage-200 rounded-2xl p-4 mb-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-sage-500 mb-1">Your booking ID</p>
                    <p className="font-mono text-sm text-gray-700 break-all leading-relaxed">{booking.id}</p>
                    <p className="text-xs text-sage-500 mt-1.5 font-medium">
                      Save this to reschedule or cancel.
                    </p>
                  </div>

                  <a href={`/manage/${booking.id}`} className="btn-secondary text-sm w-full">
                    Manage booking →
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* ── Sidebar ───────────────────────────── */}
          {sideAds.length > 0 && (
            <div className="space-y-2.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-sage-400 px-1">Promoted</p>
              {sideAds.map(a => <AdBanner key={a.id} ad={a} onExpand={setLightboxAd} />)}
            </div>
          )}
        </div>

        {/* Bottom ads */}
        {bottomAds.length > 0 && (
          <div className={`grid gap-2.5 mt-5 ${bottomAds.length > 1 ? 'sm:grid-cols-2 lg:grid-cols-3' : 'max-w-sm'}`}>
            {bottomAds.map(a => <AdBanner key={a.id} ad={a} onExpand={setLightboxAd} />)}
          </div>
        )}

        {/* ── Find my booking ─────────────────────── */}
        <div className="mt-6 max-w-lg">
          <button
            onClick={() => { setFindOpen(o => !o); setFindResults(null) }}
            className="flex items-center gap-2 text-sm font-semibold text-sage-600 hover:text-sage-800 transition-colors">
            <svg className={`w-4 h-4 transition-transform ${findOpen ? 'rotate-90' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Already booked? Find my booking
          </button>

          {findOpen && (
            <div className="card mt-3">
              <p className="text-sm font-semibold text-gray-800 mb-3">Look up your booking</p>

              {/* Mode tabs */}
              <div className="flex gap-1 mb-4 bg-sage-100 rounded-xl p-1 w-fit">
                {[['id', 'By booking ID'], ['name', 'By name & email']].map(([mode, label]) => (
                  <button key={mode} type="button"
                    onClick={() => { setFindMode(mode); setFindResults(null) }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                      ${findMode === mode ? 'bg-white shadow-card text-gray-900' : 'text-gray-400 hover:text-gray-700'}`}>
                    {label}
                  </button>
                ))}
              </div>

              <form onSubmit={handleFind} className="space-y-3">
                {findMode === 'id' ? (
                  <div>
                    <label className="label">Booking ID</label>
                    <input className="input font-mono text-sm" required value={findId}
                      onChange={e => setFindId(e.target.value)}
                      placeholder="Paste your booking ID" />
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="label">Full name</label>
                      <input className="input" required value={findForm.name}
                        onChange={e => setFindForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="Jane Smith" />
                    </div>
                    <div>
                      <label className="label">Email</label>
                      <input className="input" type="email" required value={findForm.email}
                        onChange={e => setFindForm(f => ({ ...f, email: e.target.value }))}
                        placeholder="jane@example.com" />
                    </div>
                  </>
                )}
                <button type="submit" disabled={finding} className="btn-secondary btn-sm disabled:opacity-60">
                  {finding ? 'Searching…' : 'Find booking'}
                </button>
              </form>

              {findResults !== null && (
                <div className="mt-4 border-t border-sage-100 pt-4">
                  {findResults.length === 0 ? (
                    <p className="text-sm text-gray-400">
                      {findMode === 'id' ? 'No booking found with that ID.' : 'No bookings found for that name and email.'}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {findResults.map(b => (
                        <a key={b.id} href={`/manage/${b.id}`}
                          className="flex items-center justify-between p-3 bg-sage-50 rounded-xl hover:bg-sage-100 transition-colors">
                          <div>
                            <p className="text-sm font-semibold text-gray-800">{fmt(b.start_time)}</p>
                            <span className={b.status === 'confirmed' ? 'badge-green' : 'badge-red'}>
                              {b.status}
                            </span>
                          </div>
                          <span className="text-xs font-semibold text-coral-500">Manage →</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Question input renderer ──────────────────────────────

function QuestionInput({ q, value, onChange }) {
  switch (q.type) {
    case 'textarea':
      return (
        <textarea className="input h-24 resize-none" required={q.required}
          value={value} onChange={e => onChange(e.target.value)} />
      )
    case 'select':
      return (
        <select className="input" required={q.required} value={value}
          onChange={e => onChange(e.target.value)}>
          <option value="">Select…</option>
          {q.options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      )
    case 'radio':
      return (
        <div className="space-y-2 mt-1">
          {q.options.map(o => (
            <label key={o} className="flex items-center gap-2.5 text-sm cursor-pointer group">
              <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0
                ${value === o ? 'border-coral-500 bg-coral-500' : 'border-sage-300 group-hover:border-coral-400'}`}>
                {value === o && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
              </span>
              <input type="radio" name={q.id} value={o} checked={value === o}
                onChange={() => onChange(o)} required={q.required} className="sr-only" />
              {o}
            </label>
          ))}
        </div>
      )
    case 'checkbox':
      return (
        <div className="space-y-2 mt-1">
          {q.options.map(o => {
            const checked = Array.isArray(value) ? value.includes(o) : false
            return (
              <label key={o} className="flex items-center gap-2.5 text-sm cursor-pointer">
                <span className={`w-4 h-4 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all
                  ${checked ? 'border-coral-500 bg-coral-500' : 'border-sage-300 hover:border-coral-400'}`}>
                  {checked && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/>
                    </svg>
                  )}
                </span>
                <input type="checkbox" checked={checked} className="sr-only" onChange={e => {
                  const cur = Array.isArray(value) ? [...value] : []
                  if (e.target.checked) onChange([...cur, o])
                  else onChange(cur.filter(x => x !== o))
                }} />
                {o}
              </label>
            )
          })}
        </div>
      )
    default:
      return (
        <input className="input" type="text" required={q.required}
          value={value} onChange={e => onChange(e.target.value)} />
      )
  }
}
