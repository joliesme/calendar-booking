import Database from 'better-sqlite3'
import path from 'path'
import { randomUUID } from 'crypto'

const DB_PATH = path.join(process.cwd(), 'data', 'bookings.db')

let _db = null

export function getDb() {
  if (_db) return _db
  // Ensure data dir exists
  const { mkdirSync } = require('fs')
  mkdirSync(path.dirname(DB_PATH), { recursive: true })
  _db = new Database(DB_PATH)
  _db.pragma('journal_mode = WAL')
  _db.pragma('foreign_keys = ON')
  migrate(_db)
  return _db
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS events (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      description TEXT,
      color       TEXT NOT NULL DEFAULT '#e85c45',
      active      INTEGER NOT NULL DEFAULT 1,
      order_num   INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS slots (
      id            TEXT PRIMARY KEY,
      start_time    TEXT NOT NULL,
      end_time      TEXT NOT NULL,
      max_bookings  INTEGER NOT NULL DEFAULT 1,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id               TEXT PRIMARY KEY,
      slot_id          TEXT NOT NULL REFERENCES slots(id),
      name             TEXT NOT NULL,
      email            TEXT NOT NULL,
      phone            TEXT,
      answers          TEXT NOT NULL DEFAULT '{}',
      outlook_event_id TEXT,
      status           TEXT NOT NULL DEFAULT 'confirmed',
      created_at       TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS questions (
      id         TEXT PRIMARY KEY,
      label      TEXT NOT NULL,
      type       TEXT NOT NULL DEFAULT 'text',
      options    TEXT NOT NULL DEFAULT '[]',
      required   INTEGER NOT NULL DEFAULT 1,
      order_num  INTEGER NOT NULL DEFAULT 0,
      active     INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS ads (
      id          TEXT PRIMARY KEY,
      title       TEXT NOT NULL,
      description TEXT,
      image_url   TEXT,
      link_url    TEXT,
      position    TEXT NOT NULL DEFAULT 'sidebar',
      active      INTEGER NOT NULL DEFAULT 1,
      order_num   INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  // Incremental migrations — safe to run on existing DBs
  const alters = [
    "ALTER TABLE ads      ADD COLUMN label    TEXT NOT NULL DEFAULT 'Sponsored'",
    "ALTER TABLE slots    ADD COLUMN event_id TEXT REFERENCES events(id)",
    "ALTER TABLE questions ADD COLUMN event_id TEXT REFERENCES events(id)",
  ]
  for (const sql of alters) {
    try { db.exec(sql) } catch {}
  }
}

// ── Settings ──────────────────────────────────────────────

export function getSetting(key) {
  const db = getDb()
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key)
  return row ? row.value : null
}

export function setSetting(key, value) {
  const db = getDb()
  db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, value)
}

// ── Slots ─────────────────────────────────────────────────

export function getSlots({ onlyAvailable = false } = {}) {
  const db = getDb()
  let sql = `
    SELECT s.*,
           (SELECT COUNT(*) FROM bookings b WHERE b.slot_id = s.id AND b.status = 'confirmed') AS booking_count
    FROM slots s
    WHERE s.start_time >= datetime('now')
    ORDER BY s.start_time ASC
  `
  const rows = db.prepare(sql).all()
  if (onlyAvailable) {
    return rows.filter(r => r.booking_count < r.max_bookings)
  }
  return rows
}

export function getAllSlots() {
  const db = getDb()
  return db.prepare(`
    SELECT s.*,
           (SELECT COUNT(*) FROM bookings b WHERE b.slot_id = s.id AND b.status = 'confirmed') AS booking_count
    FROM slots s
    ORDER BY s.start_time ASC
  `).all()
}

export function getSlotById(id) {
  const db = getDb()
  return db.prepare(`
    SELECT s.*,
           (SELECT COUNT(*) FROM bookings b WHERE b.slot_id = s.id AND b.status = 'confirmed') AS booking_count
    FROM slots s WHERE s.id = ?
  `).get(id)
}

export function createSlot({ start_time, end_time, max_bookings = 1, event_id = null }) {
  const db = getDb()
  const id = randomUUID()
  db.prepare(`
    INSERT INTO slots (id, start_time, end_time, max_bookings, event_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, start_time, end_time, max_bookings, event_id)
  return getSlotById(id)
}

export function bulkCreateSlots(slots) {
  const db = getDb()
  const insert = db.prepare(`
    INSERT OR IGNORE INTO slots (id, start_time, end_time, max_bookings, event_id)
    VALUES (?, ?, ?, ?, ?)
  `)
  const insertMany = db.transaction((items) => {
    for (const s of items) insert.run(randomUUID(), s.start_time, s.end_time, s.max_bookings ?? 1, s.event_id ?? null)
  })
  insertMany(slots)
}

export function updateSlot(id, fields) {
  const db = getDb()
  const sets = [], vals = []
  if (fields.max_bookings !== undefined) { sets.push('max_bookings = ?'); vals.push(fields.max_bookings) }
  if ('event_id' in fields) { sets.push('event_id = ?'); vals.push(fields.event_id ?? null) }
  if (!sets.length) return getSlotById(id)
  db.prepare(`UPDATE slots SET ${sets.join(', ')} WHERE id = ?`).run(...vals, id)
  return getSlotById(id)
}

export function bulkDeleteSlots(ids) {
  const db = getDb()
  const delB = db.prepare('DELETE FROM bookings WHERE slot_id = ?')
  const del  = db.prepare('DELETE FROM slots WHERE id = ?')
  db.transaction((list) => { for (const id of list) { delB.run(id); del.run(id) } })(ids)
}

export function bulkUpdateSlots(ids, fields) {
  const db = getDb()
  const sets = []
  const vals = []
  if (fields.event_id !== undefined) { sets.push('event_id = ?');    vals.push(fields.event_id) }
  if (fields.max_bookings !== undefined) { sets.push('max_bookings = ?'); vals.push(fields.max_bookings) }
  if (!sets.length) return
  const sql = `UPDATE slots SET ${sets.join(', ')} WHERE id = ?`
  const stmt = db.prepare(sql)
  db.transaction((list) => { for (const id of list) stmt.run(...vals, id) })(ids)
}

export function deleteSlot(id) {
  const db = getDb()
  db.prepare('DELETE FROM bookings WHERE slot_id = ?').run(id)
  db.prepare('DELETE FROM slots WHERE id = ?').run(id)
}

export function getNextAvailableSlotAfter(afterSlotId) {
  const db = getDb()
  const current = getSlotById(afterSlotId)
  if (!current) return null
  return db.prepare(`
    SELECT s.*,
           (SELECT COUNT(*) FROM bookings b WHERE b.slot_id = s.id AND b.status = 'confirmed') AS booking_count
    FROM slots s
    WHERE s.start_time > ?
    ORDER BY s.start_time ASC
    LIMIT 1
  `).get(current.start_time)
}

// ── Bookings ──────────────────────────────────────────────

/**
 * Find confirmed bookings where email OR name matches.
 * Used to detect duplicate bookings when allow_duplicate_bookings = false.
 */
export function findExistingBookings(email, name) {
  const db = getDb()
  return db.prepare(`
    SELECT b.*, s.start_time, s.end_time
    FROM bookings b
    JOIN slots s ON b.slot_id = s.id
    WHERE b.status = 'confirmed'
      AND (LOWER(b.email) = LOWER(?) OR LOWER(b.name) = LOWER(?))
    ORDER BY s.start_time ASC
  `).all(email, name)
}

/**
 * Lookup bookings by exact name + email (case-insensitive).
 * Used by "Find my booking" feature.
 */
export function lookupBookings(name, email) {
  const db = getDb()
  return db.prepare(`
    SELECT b.*, s.start_time, s.end_time
    FROM bookings b
    JOIN slots s ON b.slot_id = s.id
    WHERE LOWER(b.name) = LOWER(?) AND LOWER(b.email) = LOWER(?)
    ORDER BY s.start_time DESC
  `).all(name, email)
}

export function getBookings({ status } = {}) {
  const db = getDb()
  const where = status ? `WHERE b.status = '${status}'` : ''
  return db.prepare(`
    SELECT b.*, s.start_time, s.end_time, s.event_id AS slot_event_id
    FROM bookings b
    JOIN slots s ON b.slot_id = s.id
    ${where}
    ORDER BY s.start_time DESC
  `).all()
}

export function getBookingById(id) {
  const db = getDb()
  return db.prepare(`
    SELECT b.*, s.start_time, s.end_time
    FROM bookings b
    JOIN slots s ON b.slot_id = s.id
    WHERE b.id = ?
  `).get(id)
}

export function createBooking({ slot_id, name, email, phone, answers }) {
  const db = getDb()
  const id = randomUUID()
  db.prepare(`
    INSERT INTO bookings (id, slot_id, name, email, phone, answers)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, slot_id, name, email, phone ?? null, JSON.stringify(answers ?? {}))
  return getBookingById(id)
}

export function updateBookingSlot(id, newSlotId) {
  const db = getDb()
  db.prepare(`
    UPDATE bookings
    SET slot_id = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(newSlotId, id)
  return getBookingById(id)
}

export function updateBookingOutlookId(id, outlookEventId) {
  const db = getDb()
  db.prepare(`
    UPDATE bookings
    SET outlook_event_id = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(outlookEventId, id)
}

export function cancelBooking(id) {
  const db = getDb()
  db.prepare(`
    UPDATE bookings
    SET status = 'cancelled', updated_at = datetime('now')
    WHERE id = ?
  `).run(id)
  return getBookingById(id)
}

// ── Questions ─────────────────────────────────────────────

export function getQuestions({ activeOnly = true } = {}) {
  const db = getDb()
  const where = activeOnly ? 'WHERE active = 1' : ''
  return db.prepare(`SELECT * FROM questions ${where} ORDER BY order_num ASC, rowid ASC`).all()
    .map(q => ({ ...q, options: JSON.parse(q.options), required: !!q.required, active: !!q.active }))
}

export function createQuestion({ label, type = 'text', options = [], required = true, order_num = 0, event_id = null }) {
  const db = getDb()
  const id = randomUUID()
  db.prepare(`
    INSERT INTO questions (id, label, type, options, required, order_num, event_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, label, type, JSON.stringify(options), required ? 1 : 0, order_num, event_id)
  return db.prepare('SELECT * FROM questions WHERE id = ?').get(id)
}

export function updateQuestion(id, fields) {
  const db = getDb()
  const sets = []
  const vals = []
  if (fields.label !== undefined)    { sets.push('label = ?');     vals.push(fields.label) }
  if (fields.type !== undefined)     { sets.push('type = ?');      vals.push(fields.type) }
  if (fields.options !== undefined)  { sets.push('options = ?');   vals.push(JSON.stringify(fields.options)) }
  if (fields.required !== undefined) { sets.push('required = ?');  vals.push(fields.required ? 1 : 0) }
  if (fields.order_num !== undefined){ sets.push('order_num = ?'); vals.push(fields.order_num) }
  if (fields.active !== undefined)   { sets.push('active = ?');    vals.push(fields.active ? 1 : 0) }
  if (fields.event_id !== undefined) { sets.push('event_id = ?');  vals.push(fields.event_id || null) }
  if (!sets.length) return
  db.prepare(`UPDATE questions SET ${sets.join(', ')} WHERE id = ?`).run(...vals, id)
}

export function deleteQuestion(id) {
  const db = getDb()
  db.prepare('DELETE FROM questions WHERE id = ?').run(id)
}

/** Bulk-update order_num for an ordered array of IDs. */
export function reorderQuestions(orderedIds) {
  const db = getDb()
  const update = db.prepare('UPDATE questions SET order_num = ? WHERE id = ?')
  const tx = db.transaction((ids) => {
    ids.forEach((id, i) => update.run(i, id))
  })
  tx(orderedIds)
}

// ── Ads ───────────────────────────────────────────────────

export function getAds({ position, activeOnly = true } = {}) {
  const db = getDb()
  const conditions = []
  if (activeOnly) conditions.push('active = 1')
  if (position)   conditions.push(`position = '${position}'`)
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  return db.prepare(`SELECT * FROM ads ${where} ORDER BY order_num ASC, rowid ASC`).all()
    .map(a => ({ ...a, active: !!a.active }))
}

export function createAd({ title, description, image_url, link_url, position = 'sidebar', order_num = 0, label = 'Sponsored' }) {
  const db = getDb()
  const id = randomUUID()
  db.prepare(`
    INSERT INTO ads (id, title, description, image_url, link_url, position, order_num, label)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, title, description ?? null, image_url ?? null, link_url ?? null, position, order_num, label)
  return db.prepare('SELECT * FROM ads WHERE id = ?').get(id)
}

export function updateAd(id, fields) {
  const db = getDb()
  const sets = []
  const vals = []
  if (fields.title !== undefined)       { sets.push('title = ?');       vals.push(fields.title) }
  if (fields.description !== undefined) { sets.push('description = ?'); vals.push(fields.description) }
  if (fields.image_url !== undefined)   { sets.push('image_url = ?');   vals.push(fields.image_url) }
  if (fields.link_url !== undefined)    { sets.push('link_url = ?');    vals.push(fields.link_url) }
  if (fields.position !== undefined)    { sets.push('position = ?');    vals.push(fields.position) }
  if (fields.active !== undefined)      { sets.push('active = ?');      vals.push(fields.active ? 1 : 0) }
  if (fields.order_num !== undefined)   { sets.push('order_num = ?');   vals.push(fields.order_num) }
  if (fields.label !== undefined)       { sets.push('label = ?');       vals.push(fields.label) }
  if (!sets.length) return
  db.prepare(`UPDATE ads SET ${sets.join(', ')} WHERE id = ?`).run(...vals, id)
}

export function deleteAd(id) {
  const db = getDb()
  db.prepare('DELETE FROM ads WHERE id = ?').run(id)
}

// ── Events ─────────────────────────────────────────────────

export function getEvents({ activeOnly = true } = {}) {
  const db = getDb()
  const where = activeOnly ? 'WHERE active = 1' : ''
  return db.prepare(`SELECT * FROM events ${where} ORDER BY order_num ASC, rowid ASC`).all()
    .map(e => ({ ...e, active: !!e.active }))
}

export function getEventById(id) {
  const db = getDb()
  const row = db.prepare('SELECT * FROM events WHERE id = ?').get(id)
  return row ? { ...row, active: !!row.active } : null
}

export function createEvent({ name, description = null, color = '#e85c45', active = true, order_num = 0 }) {
  const db = getDb()
  const id = randomUUID()
  db.prepare(`
    INSERT INTO events (id, name, description, color, active, order_num)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, name, description, color, active ? 1 : 0, order_num)
  return getEventById(id)
}

export function updateEvent(id, fields) {
  const db = getDb()
  const sets = []
  const vals = []
  if (fields.name !== undefined)        { sets.push('name = ?');        vals.push(fields.name) }
  if (fields.description !== undefined) { sets.push('description = ?'); vals.push(fields.description ?? null) }
  if (fields.color !== undefined)       { sets.push('color = ?');       vals.push(fields.color) }
  if (fields.active !== undefined)      { sets.push('active = ?');      vals.push(fields.active ? 1 : 0) }
  if (fields.order_num !== undefined)   { sets.push('order_num = ?');   vals.push(fields.order_num) }
  if (!sets.length) return
  db.prepare(`UPDATE events SET ${sets.join(', ')} WHERE id = ?`).run(...vals, id)
  return getEventById(id)
}

export function deleteEvent(id) {
  const db = getDb()
  db.prepare("UPDATE slots SET event_id = NULL WHERE event_id = ?").run(id)
  db.prepare("UPDATE questions SET event_id = NULL WHERE event_id = ?").run(id)
  db.prepare('DELETE FROM events WHERE id = ?').run(id)
}
