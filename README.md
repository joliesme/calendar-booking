# Calendar Booking App

A self-hosted appointment booking system with Outlook calendar sync, custom form questions, and ad banners.

## Features
- **Public booking page** — users pick a slot, answer your custom questions, and confirm
- **Manage booking page** — users can reschedule (to next available or a chosen slot) or cancel via their booking ID
- **Outlook sync** — bookings automatically appear in your Outlook calendar as events
- **Custom questions** — add any questions to the booking form (text, dropdown, radio, checkboxes)
- **Ad banners** — place sponsored ads at the top, sidebar, or bottom of the booking page
- **Admin panel** — manage everything at `/admin`

---

## Quick Start

```bash
cd calendar-booking

# 1. Install dependencies
npm install

# 2. Copy env file and fill in your values
cp .env.local.example .env.local
# Edit .env.local — at minimum set ADMIN_PASSWORD and NEXT_PUBLIC_BASE_URL

# 3. Run dev server
npm run dev
# → http://localhost:3000
```

The SQLite database is auto-created at `data/bookings.db` on first run.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ADMIN_PASSWORD` | ✅ | Password to access `/admin` |
| `NEXT_PUBLIC_BASE_URL` | ✅ | Full URL of your app (e.g. `https://book.yourdomain.com`) |
| `OUTLOOK_CLIENT_ID` | Optional | Azure app client ID |
| `OUTLOOK_CLIENT_SECRET` | Optional | Azure app client secret |
| `OUTLOOK_TENANT_ID` | Optional | `common` for personal/work accounts (default) |
| `OUTLOOK_CALENDAR_ID` | Optional | Leave blank to use the default Outlook calendar |

---

## Outlook Setup (Microsoft Azure)

1. Go to [portal.azure.com](https://portal.azure.com) → **Azure Active Directory** → **App registrations** → **New registration**
2. Name your app, choose **"Accounts in any organizational directory and personal Microsoft accounts"**
3. Click **Register**
4. Go to **Certificates & secrets** → **New client secret** → copy the **Value**
5. Go to **Authentication** → **Add a platform** → **Web**
   - Redirect URI: `https://yourdomain.com/api/outlook/callback`
   - Check **Access tokens** and **ID tokens**
6. Go to **API permissions** → **Add a permission** → **Microsoft Graph** → **Delegated**
   - Add `Calendars.ReadWrite` and `offline_access`
7. Copy **Application (client) ID** from the Overview page
8. Add both values to `.env.local`, restart server
9. Visit `/admin/outlook` → click **Connect Outlook**

---

## Admin Panel

Visit `/admin` and enter your `ADMIN_PASSWORD`.

| Section | URL | What you can do |
|---|---|---|
| Dashboard | `/admin` | View all bookings, filter by status |
| Slots | `/admin/slots` | Add single slots or bulk-generate by date range |
| Questions | `/admin/questions` | Add/edit/hide custom form questions |
| Ads | `/admin/ads` | Create ad banners (top / sidebar / bottom) |
| Outlook | `/admin/outlook` | Connect your Outlook calendar |

---

## User Flow

1. User visits `/` → picks a time slot
2. Fills in name, email, optional phone + your custom questions
3. Receives a **Booking ID** on confirmation
4. To reschedule or cancel: visit `/manage/<booking-id>`
   - **Reschedule**: pick "next available" (auto) or choose a specific slot
   - **Cancel**: one-click cancellation, Outlook event is deleted

---

## Deployment (Vercel / Railway / Fly.io)

> ⚠️ `better-sqlite3` requires a Node.js server — it doesn't work on Vercel Edge Functions.
> Use **Vercel with Node.js runtime** (default), Railway, Fly.io, or a VPS.

```bash
# Build
npm run build

# Start production server
npm start
```

Make sure the `data/` directory is writable and persisted (mount a volume if using containers).
