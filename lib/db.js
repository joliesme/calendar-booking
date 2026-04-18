import { createClient } from '@libsql/client'
import { randomUUID } from 'crypto'

let _client = null
let _ready  = null

function getClient() {
  if (!_client) {
    _client = createClient({
      url:       process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    })
    _ready = _migrate(_client)
  }
  return _client
}

async function db() {
  const c = getClient()
  await _ready
  return c
}

async function _migrate(client) {
  await client.batch([
    { sql: `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`, args: [] },
    { sql: `CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT,
      color TEXT NOT NULL DEFAULT '#e85c45', active INTEGER NOT NULL DEFAULT 1,
      order_num INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`, args: [] },
    { sql: `CREATE TABLE IF NOT EXISTS slots (
      id TEXT PRIMARY KEY, start_time TEXT NOT NULL, end_time TEXT NOT NULL,
      max_bookings INTEGER NOT NULL DEFAULT 1, event_id TEXT REFERENCES events(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`, args: [] },
    { sql: `CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY, slot_id TEXT NOT NULL REFERENCES slots(id),
      name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT,
      answers TEXT NOT NULL DEFAULT '{}', outlook_event_id TEXT,
      status TEXT NOT NULL DEFAULT 'confirmed',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`, args: [] },
    { sql: `CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY, label TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'text',
      options TEXT NOT NULL DEFAULT '[]', required INTEGER NOT NULL DEFAULT 1,
      order_num INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1,
      event_id TEXT REFERENCES events(id)
    )`, args: [] },
    { sql: `CREATE TABLE IF NOT EXISTS ads (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT,
      image_url TEXT, link_url TEXT, position TEXT NOT NULL DEFAULT 'sidebar',
      active INTEGER NOT NULL DEFAULT 1, order_num INTEGER NOT NULL DEFAULT 0,
      label TEXT NOT NULL DEFAULT 'Sponsored',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`, args: [] },
  ], 'deferred')
}

// ── Settings ──────────────────────────────────────────────

export async function getSetting(key) {
  const c = await db()
  const { rows } = await c.execute({ sql: 'SELECT value FROM settings WHERE key = ?', args: [key] })
  return rows[0] ? rows[0].value : null
}

export async function setSetting(key, value) {
  const c = await db()
  await c.execute({
    sql: `INSERT INTO settings (key, value) VALUES (?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    args: [key, value],
  })
}

// ── Slots ─────────────────────────────────────────────────

const SLOT_SELECT = `
  SELECT s.*,
    (SELECT COUNT(*) FROM bookings b WHERE b.slot_id = s.id AND b.status = 'confirmed') AS booking_count
  FROM slots s`

export async function getSlots({ onlyAvailable = false } = {}) {
  const c = await db()
  const { rows } = await c.execute(
    SLOT_SELECT + ` WHERE s.start_time >= datetime('now') ORDER BY s.start_time ASC`
  )
  if (onlyAvailable) return rows.filter(r => r.booking_count < r.max_bookings)
  return rows
}

export async function getAllSlots() {
  const c = await db()
  const { rows } = await c.execute(SLOT_SELECT + ` ORDER BY s.start_time ASC`)
  return rows
}

export async function getSlotById(id) {
  const c = await db()
  const { rows } = await c.execute({ sql: SLOT_SELECT + ` WHERE s.id = ?`, args: [id] })
  return rows[0] ?? null
}

export async function createSlot({ start_time, end_time, max_bookings = 1, event_id = null }) {
  const c = await db()
  const id = randomUUID()
  await c.execute({
    sql: `INSERT INTO slots (id, start_time, end_time, max_bookings, event_id) VALUES (?, ?, ?, ?, ?)`,
    args: [id, start_time, end_time, max_bookings, event_id],
  })
  return getSlotById(id)
}

export async function bulkCreateSlots(slots) {
  const c = await db()
  await c.batch(
    slots.map(s => ({
      sql: `INSERT OR IGNORE INTO slots (id, start_time, end_time, max_bookings, event_id) VALUES (?, ?, ?, ?, ?)`,
      args: [randomUUID(), s.start_time, s.end_time, s.max_bookings ?? 1, s.event_id ?? null],
    })),
    'deferred'
  )
}

export async function updateSlot(id, fields) {
  const c = await db()
  const sets = [], vals = []
  if (fields.max_bookings !== undefined) { sets.push('max_bookings = ?'); vals.push(fields.max_bookings) }
  if ('event_id' in fields)              { sets.push('event_id = ?');     vals.push(fields.event_id ?? null) }
  if (!sets.length) return getSlotById(id)
  await c.execute({ sql: `UPDATE slots SET ${sets.join(', ')} WHERE id = ?`, args: [...vals, id] })
  return getSlotById(id)
}

export async function bulkDeleteSlots(ids) {
  const c = await db()
  await c.batch(
    ids.flatMap(id => [
      { sql: 'DELETE FROM bookings WHERE slot_id = ?', args: [id] },
      { sql: 'DELETE FROM slots WHERE id = ?',         args: [id] },
    ]),
    'deferred'
  )
}

export async function bulkUpdateSlots(ids, fields) {
  const sets = [], vals = []
  if (fields.event_id !== undefined)     { sets.push('event_id = ?');     vals.push(fields.event_id ?? null) }
  if (fields.max_bookings !== undefined) { sets.push('max_bookings = ?'); vals.push(fields.max_bookings) }
  if (!sets.length) return
  const c = await db()
  await c.batch(
    ids.map(id => ({ sql: `UPDATE slots SET ${sets.join(', ')} WHERE id = ?`, args: [...vals, id] })),
    'deferred'
  )
}

export async function deleteSlot(id) {
  const c = await db()
  await c.batch([
    { sql: 'DELETE FROM bookings WHERE slot_id = ?', args: [id] },
    { sql: 'DELETE FROM slots WHERE id = ?',         args: [id] },
  ], 'deferred')
}

export async function getNextAvailableSlotAfter(afterSlotId) {
  const current = await getSlotById(afterSlotId)
  if (!current) return null
  const c = await db()
  const { rows } = await c.execute({
    sql: SLOT_SELECT + ` WHERE s.start_time > ? ORDER BY s.start_time ASC LIMIT 1`,
    args: [current.start_time],
  })
  return rows[0] ?? null
}

// ── Bookings ──────────────────────────────────────────────

export async function findExistingBookings(email, name) {
  const c = await db()
  const { rows } = await c.execute({
    sql: `SELECT b.*, s.start_time, s.end_time FROM bookings b
          JOIN slots s ON b.slot_id = s.id
          WHERE b.status = 'confirmed'
            AND (LOWER(b.email) = LOWER(?) OR LOWER(b.name) = LOWER(?))
          ORDER BY s.start_time ASC`,
    args: [email, name],
  })
  return rows
}

export async function lookupBookings(name, email) {
  const c = await db()
  const { rows } = await c.execute({
    sql: `SELECT b.*, s.start_time, s.end_time FROM bookings b
          JOIN slots s ON b.slot_id = s.id
          WHERE LOWER(b.name) = LOWER(?) AND LOWER(b.email) = LOWER(?)
          ORDER BY s.start_time DESC`,
    args: [name, email],
  })
  return rows
}

export async function getBookings({ status } = {}) {
  const c = await db()
  const where = status ? `WHERE b.status = '${status}'` : ''
  const { rows } = await c.execute(
    `SELECT b.*, s.start_time, s.end_time, s.event_id AS slot_event_id
     FROM bookings b JOIN slots s ON b.slot_id = s.id
     ${where} ORDER BY s.start_time DESC`
  )
  return rows
}

export async function getBookingById(id) {
  const c = await db()
  const { rows } = await c.execute({
    sql: `SELECT b.*, s.start_time, s.end_time FROM bookings b
          JOIN slots s ON b.slot_id = s.id WHERE b.id = ?`,
    args: [id],
  })
  return rows[0] ?? null
}

export async function createBooking({ slot_id, name, email, phone, answers }) {
  const c = await db()
  const id = randomUUID()
  await c.execute({
    sql: `INSERT INTO bookings (id, slot_id, name, email, phone, answers) VALUES (?, ?, ?, ?, ?, ?)`,
    args: [id, slot_id, name, email, phone ?? null, JSON.stringify(answers ?? {})],
  })
  return getBookingById(id)
}

export async function updateBookingSlot(id, newSlotId) {
  const c = await db()
  await c.execute({
    sql: `UPDATE bookings SET slot_id = ?, updated_at = datetime('now') WHERE id = ?`,
    args: [newSlotId, id],
  })
  return getBookingById(id)
}

export async function updateBookingOutlookId(id, outlookEventId) {
  const c = await db()
  await c.execute({
    sql: `UPDATE bookings SET outlook_event_id = ?, updated_at = datetime('now') WHERE id = ?`,
    args: [outlookEventId, id],
  })
}

export async function cancelBooking(id) {
  const c = await db()
  await c.execute({
    sql: `UPDATE bookings SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?`,
    args: [id],
  })
  return getBookingById(id)
}

// ── Questions ─────────────────────────────────────────────

export async function getQuestions({ activeOnly = true } = {}) {
  const c = await db()
  const where = activeOnly ? 'WHERE active = 1' : ''
  const { rows } = await c.execute(`SELECT * FROM questions ${where} ORDER BY order_num ASC, rowid ASC`)
  return rows.map(q => ({ ...q, options: JSON.parse(q.options), required: !!q.required, active: !!q.active }))
}

export async function createQuestion({ label, type = 'text', options = [], required = true, order_num = 0, event_id = null }) {
  const c = await db()
  const id = randomUUID()
  await c.execute({
    sql: `INSERT INTO questions (id, label, type, options, required, order_num, event_id)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [id, label, type, JSON.stringify(options), required ? 1 : 0, order_num, event_id],
  })
  const { rows } = await c.execute({ sql: 'SELECT * FROM questions WHERE id = ?', args: [id] })
  return rows[0]
}

export async function updateQuestion(id, fields) {
  const c = await db()
  const sets = [], vals = []
  if (fields.label !== undefined)    { sets.push('label = ?');     vals.push(fields.label) }
  if (fields.type !== undefined)     { sets.push('type = ?');      vals.push(fields.type) }
  if (fields.options !== undefined)  { sets.push('options = ?');   vals.push(JSON.stringify(fields.options)) }
  if (fields.required !== undefined) { sets.push('required = ?');  vals.push(fields.required ? 1 : 0) }
  if (fields.order_num !== undefined){ sets.push('order_num = ?'); vals.push(fields.order_num) }
  if (fields.active !== undefined)   { sets.push('active = ?');    vals.push(fields.active ? 1 : 0) }
  if (fields.event_id !== undefined) { sets.push('event_id = ?');  vals.push(fields.event_id || null) }
  if (!sets.length) return
  await c.execute({ sql: `UPDATE questions SET ${sets.join(', ')} WHERE id = ?`, args: [...vals, id] })
}

export async function deleteQuestion(id) {
  const c = await db()
  await c.execute({ sql: 'DELETE FROM questions WHERE id = ?', args: [id] })
}

export async function reorderQuestions(orderedIds) {
  const c = await db()
  await c.batch(
    orderedIds.map((id, i) => ({ sql: 'UPDATE questions SET order_num = ? WHERE id = ?', args: [i, id] })),
    'deferred'
  )
}

// ── Ads ───────────────────────────────────────────────────

export async function getAds({ position, activeOnly = true } = {}) {
  const c = await db()
  const conditions = []
  if (activeOnly) conditions.push('active = 1')
  if (position)   conditions.push(`position = '${position}'`)
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const { rows } = await c.execute(`SELECT * FROM ads ${where} ORDER BY order_num ASC, rowid ASC`)
  return rows.map(a => ({ ...a, active: !!a.active }))
}

export async function createAd({ title, description, image_url, link_url, position = 'sidebar', order_num = 0, label = 'Sponsored' }) {
  const c = await db()
  const id = randomUUID()
  await c.execute({
    sql: `INSERT INTO ads (id, title, description, image_url, link_url, position, order_num, label)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, title, description ?? null, image_url ?? null, link_url ?? null, position, order_num, label],
  })
  const { rows } = await c.execute({ sql: 'SELECT * FROM ads WHERE id = ?', args: [id] })
  return rows[0]
}

export async function updateAd(id, fields) {
  const c = await db()
  const sets = [], vals = []
  if (fields.title !== undefined)       { sets.push('title = ?');       vals.push(fields.title) }
  if (fields.description !== undefined) { sets.push('description = ?'); vals.push(fields.description) }
  if (fields.image_url !== undefined)   { sets.push('image_url = ?');   vals.push(fields.image_url) }
  if (fields.link_url !== undefined)    { sets.push('link_url = ?');    vals.push(fields.link_url) }
  if (fields.position !== undefined)    { sets.push('position = ?');    vals.push(fields.position) }
  if (fields.active !== undefined)      { sets.push('active = ?');      vals.push(fields.active ? 1 : 0) }
  if (fields.order_num !== undefined)   { sets.push('order_num = ?');   vals.push(fields.order_num) }
  if (fields.label !== undefined)       { sets.push('label = ?');       vals.push(fields.label) }
  if (!sets.length) return
  await c.execute({ sql: `UPDATE ads SET ${sets.join(', ')} WHERE id = ?`, args: [...vals, id] })
}

export async function deleteAd(id) {
  const c = await db()
  await c.execute({ sql: 'DELETE FROM ads WHERE id = ?', args: [id] })
}

// ── Events ─────────────────────────────────────────────────

export async function getEvents({ activeOnly = true } = {}) {
  const c = await db()
  const where = activeOnly ? 'WHERE active = 1' : ''
  const { rows } = await c.execute(`SELECT * FROM events ${where} ORDER BY order_num ASC, rowid ASC`)
  return rows.map(e => ({ ...e, active: !!e.active }))
}

export async function getEventById(id) {
  const c = await db()
  const { rows } = await c.execute({ sql: 'SELECT * FROM events WHERE id = ?', args: [id] })
  return rows[0] ? { ...rows[0], active: !!rows[0].active } : null
}

export async function createEvent({ name, description = null, color = '#e85c45', active = true, order_num = 0 }) {
  const c = await db()
  const id = randomUUID()
  await c.execute({
    sql: `INSERT INTO events (id, name, description, color, active, order_num) VALUES (?, ?, ?, ?, ?, ?)`,
    args: [id, name, description, color, active ? 1 : 0, order_num],
  })
  return getEventById(id)
}

export async function updateEvent(id, fields) {
  const c = await db()
  const sets = [], vals = []
  if (fields.name !== undefined)        { sets.push('name = ?');        vals.push(fields.name) }
  if (fields.description !== undefined) { sets.push('description = ?'); vals.push(fields.description ?? null) }
  if (fields.color !== undefined)       { sets.push('color = ?');       vals.push(fields.color) }
  if (fields.active !== undefined)      { sets.push('active = ?');      vals.push(fields.active ? 1 : 0) }
  if (fields.order_num !== undefined)   { sets.push('order_num = ?');   vals.push(fields.order_num) }
  if (!sets.length) return
  await c.execute({ sql: `UPDATE events SET ${sets.join(', ')} WHERE id = ?`, args: [...vals, id] })
  return getEventById(id)
}

export async function deleteEvent(id) {
  const c = await db()
  await c.batch([
    { sql: `UPDATE slots SET event_id = NULL WHERE event_id = ?`,     args: [id] },
    { sql: `UPDATE questions SET event_id = NULL WHERE event_id = ?`, args: [id] },
    { sql: `DELETE FROM events WHERE id = ?`,                         args: [id] },
  ], 'deferred')
}
