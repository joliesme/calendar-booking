'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function OutlookContent() {
  const searchParams  = useSearchParams()
  const connected     = searchParams.get('connected') === '1'
  const errorParam    = searchParams.get('error')
  const [status, setStatus] = useState(null) // 'connected' | 'disconnected' | 'unconfigured'
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Try a lightweight call to check if outlook token exists
    fetch('/api/outlook/status', { credentials: 'same-origin' })
      .then(r => r.json())
      .then(d => setStatus(d.status))
      .catch(() => setStatus('unconfigured'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Outlook Calendar Sync</h1>
      <p className="text-sm text-gray-500 mb-6">
        Connect your Microsoft Outlook account to automatically add bookings to your calendar.
      </p>

      {connected && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 text-sm text-green-700">
          ✅ Outlook connected successfully! Bookings will now sync to your calendar.
        </div>
      )}
      {errorParam && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-sm text-red-700">
          ❌ Error: {decodeURIComponent(errorParam)}
        </div>
      )}

      <div className="card max-w-lg">
        {loading ? (
          <p className="text-sm text-gray-400">Checking connection…</p>
        ) : status === 'unconfigured' ? (
          <UnconfiguredState />
        ) : status === 'connected' ? (
          <ConnectedState />
        ) : (
          <DisconnectedState />
        )}
      </div>

      <div className="mt-8 max-w-lg">
        <h2 className="font-semibold text-gray-800 mb-3">Setup instructions</h2>
        <ol className="space-y-3 text-sm text-gray-600">
          {[
            <>Go to <strong>portal.azure.com</strong> → Azure Active Directory → App registrations → New registration.</>,
            <>Set a name, choose "Accounts in any org directory and personal accounts", then click Register.</>,
            <>Under <strong>Certificates & secrets</strong> → add a new Client secret. Copy the value.</>,
            <>Under <strong>Authentication</strong> → add a Web platform with redirect URI:<br/>
              <code className="bg-gray-100 px-2 py-0.5 rounded text-xs font-mono">
                {typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/api/outlook/callback
              </code></>,
            <>Under <strong>API permissions</strong> → add <code className="bg-gray-100 px-1 rounded text-xs">Calendars.ReadWrite</code> and <code className="bg-gray-100 px-1 rounded text-xs">offline_access</code> (delegated).</>,
            <>Copy your <strong>Application (client) ID</strong> and the secret value into <code className="bg-gray-100 px-1 rounded text-xs font-mono">.env.local</code>.</>,
            <>Restart the server, then click <strong>Connect Outlook</strong> below.</>,
          ].map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="w-6 h-6 flex-shrink-0 rounded-full bg-blue-100 text-blue-700 text-xs font-bold
                              flex items-center justify-center mt-0.5">{i + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

function ConnectedState() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-lg">✅</div>
        <div>
          <p className="font-semibold text-gray-900">Outlook is connected</p>
          <p className="text-sm text-gray-500">Bookings are syncing to your calendar.</p>
        </div>
      </div>
      <a href="/api/outlook/connect" className="btn-secondary btn-sm">Reconnect</a>
    </div>
  )
}

function DisconnectedState() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center text-lg">🔌</div>
        <div>
          <p className="font-semibold text-gray-900">Not connected</p>
          <p className="text-sm text-gray-500">Connect your Outlook account to enable calendar sync.</p>
        </div>
      </div>
      <a href="/api/outlook/connect" className="btn-primary btn-sm">Connect Outlook →</a>
    </div>
  )
}

function UnconfiguredState() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-lg">⚙️</div>
        <div>
          <p className="font-semibold text-gray-900">Not configured</p>
          <p className="text-sm text-gray-500">Add your Azure app credentials to <code className="bg-gray-100 px-1 rounded text-xs font-mono">.env.local</code> first.</p>
        </div>
      </div>
      <div className="bg-gray-50 rounded-lg p-3 text-xs font-mono text-gray-600 space-y-1">
        <p>OUTLOOK_CLIENT_ID=your-client-id</p>
        <p>OUTLOOK_CLIENT_SECRET=your-client-secret</p>
        <p>OUTLOOK_TENANT_ID=common</p>
      </div>
    </div>
  )
}

export default function OutlookPage() {
  return (
    <Suspense fallback={<div className="text-sm text-gray-400">Loading…</div>}>
      <OutlookContent />
    </Suspense>
  )
}
