/**
 * Outlook / Microsoft Graph calendar sync
 *
 * Flow:
 *  1. Admin visits /admin/outlook → redirected to Microsoft login
 *  2. Microsoft redirects back to /api/outlook/callback with a code
 *  3. We exchange code for access_token + refresh_token → stored in DB settings
 *  4. On every booking create/reschedule/cancel we call Graph API
 */

import { getSetting, setSetting } from './db.js'

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'

const CLIENT_ID     = process.env.OUTLOOK_CLIENT_ID
const CLIENT_SECRET = process.env.OUTLOOK_CLIENT_SECRET
const TENANT_ID     = process.env.OUTLOOK_TENANT_ID || 'common'
const REDIRECT_URI  = `${process.env.NEXT_PUBLIC_BASE_URL}/api/outlook/callback`

export function outlookConfigured() {
  return !!(CLIENT_ID && CLIENT_SECRET)
}

export function getAuthUrl() {
  const params = new URLSearchParams({
    client_id:     CLIENT_ID,
    response_type: 'code',
    redirect_uri:  REDIRECT_URI,
    scope:         'Calendars.ReadWrite offline_access',
    response_mode: 'query',
  })
  return `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/authorize?${params}`
}

export async function exchangeCode(code) {
  const res = await fetch(
    `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        redirect_uri:  REDIRECT_URI,
        grant_type:    'authorization_code',
      }),
    }
  )
  if (!res.ok) throw new Error(`Token exchange failed: ${await res.text()}`)
  const data = await res.json()
  setSetting('outlook_access_token',  data.access_token)
  setSetting('outlook_refresh_token', data.refresh_token)
  setSetting('outlook_token_expiry',  String(Date.now() + data.expires_in * 1000))
  return data
}

async function refreshAccessToken() {
  const refreshToken = getSetting('outlook_refresh_token')
  if (!refreshToken) throw new Error('No Outlook refresh token stored')

  const res = await fetch(
    `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type:    'refresh_token',
        scope:         'Calendars.ReadWrite offline_access',
      }),
    }
  )
  if (!res.ok) throw new Error(`Token refresh failed: ${await res.text()}`)
  const data = await res.json()
  setSetting('outlook_access_token',  data.access_token)
  setSetting('outlook_token_expiry',  String(Date.now() + data.expires_in * 1000))
  if (data.refresh_token) setSetting('outlook_refresh_token', data.refresh_token)
  return data.access_token
}

async function getAccessToken() {
  const expiry = getSetting('outlook_token_expiry')
  const token  = getSetting('outlook_access_token')
  if (!token) throw new Error('Outlook not connected')
  // Refresh 5 minutes before expiry
  if (!expiry || Date.now() > Number(expiry) - 5 * 60 * 1000) {
    return await refreshAccessToken()
  }
  return token
}

function calendarId() {
  return process.env.OUTLOOK_CALENDAR_ID || 'me/calendar'
}

async function graphRequest(method, path, body) {
  const token = await getAccessToken()
  const res = await fetch(`${GRAPH_BASE}/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Graph API ${method} ${path} failed (${res.status}): ${text}`)
  }
  if (res.status === 204) return null
  return res.json()
}

/**
 * Create a calendar event for a confirmed booking.
 * Returns the Outlook event ID.
 */
export async function createOutlookEvent({ subject, start, end, attendeeEmail, attendeeName, description }) {
  const calId = calendarId()
  const endpoint = calId === 'me/calendar'
    ? 'me/events'
    : `me/calendars/${calId}/events`

  const event = await graphRequest('POST', endpoint, {
    subject,
    body: { contentType: 'HTML', content: description || '' },
    start: { dateTime: start, timeZone: 'UTC' },
    end:   { dateTime: end,   timeZone: 'UTC' },
    attendees: [
      {
        emailAddress: { address: attendeeEmail, name: attendeeName },
        type: 'required',
      },
    ],
  })
  return event.id
}

/**
 * Update an existing Outlook event (e.g., reschedule).
 */
export async function updateOutlookEvent(eventId, { start, end, subject, description }) {
  await graphRequest('PATCH', `me/events/${eventId}`, {
    ...(subject     ? { subject } : {}),
    ...(description ? { body: { contentType: 'HTML', content: description } } : {}),
    ...(start       ? { start: { dateTime: start, timeZone: 'UTC' } } : {}),
    ...(end         ? { end:   { dateTime: end,   timeZone: 'UTC' } } : {}),
  })
}

/**
 * Cancel / delete an Outlook event.
 */
export async function deleteOutlookEvent(eventId) {
  await graphRequest('DELETE', `me/events/${eventId}`)
}

export function isOutlookConnected() {
  const token = getSetting('outlook_access_token')
  return !!token
}
