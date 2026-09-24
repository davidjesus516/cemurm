/* eslint-disable react/prop-types */
// In-App Feedback surface (Hito 5 — features/in-app-feedback.feature, 8
// scenarios). Trigger button lives in the app header ("main menu", scenario 1).
// Logged-out users get the public issue tracker instead of a live form
// (scenario 4). Consent gates device/log diagnostics for bug reports
// (scenario 5); submit is fire-and-forget and never blocks navigation
// (scenario 6); offline submits queue with a pending confirmation (scenario 7);
// server failure surfaces "Could not send, retry or copy your text" and keeps
// the draft (scenario 8).

import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'
import {
  collectDiagnostics,
  ISSUE_TRACKER_URL,
  queueFeedback,
  submitFeedback,
} from '../lib/feedback.js'

const SCREENSHOT_MAX_CHARS = 1_500_000

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Could not read the image.'))
    reader.readAsDataURL(file)
  })
}

function IssueTrackerCard() {
  return (
    <div className="space-y-3">
      <p className="text-sm text-cem-secondary">
        You must be signed in to attach account context to a report.
      </p>
      <a
        href={ISSUE_TRACKER_URL}
        target="_blank"
        rel="noreferrer"
        className="inline-block rounded bg-cem-amber px-4 py-2 text-sm font-semibold text-cem-base hover:opacity-90"
      >
        Open the public issue tracker
      </a>
    </div>
  )
}

function FeedbackFormBody() {
  const { user } = useAuth()
  const location = useLocation()

  const [kind, setKind] = useState('bug_report')
  const [message, setMessage] = useState('')
  const [consent, setConsent] = useState(false)
  const [screenshot, setScreenshot] = useState('')
  const [status, setStatus] = useState('idle') // idle | submitting | success | queued | error

  const isBug = kind === 'bug_report'

  async function handleScreenshot(file) {
    if (!file) {
      setScreenshot('')
      return
    }
    let dataUrl = ''
    try {
      dataUrl = await readFileAsDataUrl(file)
    } catch {
      dataUrl = ''
    }
    setScreenshot(dataUrl.length > SCREENSHOT_MAX_CHARS ? '' : dataUrl)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!user || !message.trim() || status === 'submitting') return

    const diagnostics = collectDiagnostics({ consent, screenshotDataUrl: screenshot })
    const payload = { kind, message: message.trim(), screen: location.pathname, diagnostics }
    setStatus('submitting')

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      await queueFeedback(user.id, payload)
      setStatus('queued')
      return
    }

    try {
      await submitFeedback(user.id, payload)
      setStatus('success')
    } catch {
      setStatus('error')
    }
  }

  async function handleRetry(event) {
    // Draft (this.state message) is still held — resubmit it directly.
    event.preventDefault()
    await handleSubmit(event)
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(message)
    } catch {
      // Clipboard unavailable — the text area still lets the user copy.
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex gap-2">
        {[
          { value: 'bug_report', label: 'Bug report' },
          { value: 'general_feedback', label: 'General feedback' },
        ].map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => {
              setKind(option.value)
              setStatus('idle')
            }}
            className={`rounded px-3 py-1.5 text-sm font-medium ${
              kind === option.value
                ? 'bg-cem-amber text-cem-base'
                : 'bg-cem-elevated text-cem-secondary hover:text-cem-text'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-cem-text">Your message</span>
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={5}
          placeholder={isBug ? 'What happened, and what were you doing?' : 'Share your thoughts'}
          className="w-full rounded border border-cem-elevated bg-cem-surface px-3 py-2 text-sm text-cem-text"
        />
      </label>

      <p className="text-xs text-cem-secondary">
        Screen: <span className="text-cem-text">{location.pathname}</span>
      </p>

      {isBug && (
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-cem-text">
              Screenshot (optional)
            </span>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => handleScreenshot(event.target.files?.[0])}
              className="block w-full text-sm text-cem-secondary file:mr-3 file:rounded file:border-0 file:bg-cem-elevated file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-cem-text"
            />
          </label>
          <label className="flex items-start gap-2 text-sm text-cem-secondary">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              className="mt-0.5"
            />
            <span>Attach device info and recent console errors to help diagnose.</span>
          </label>
        </div>
      )}

      {status === 'success' && (
        <p className="rounded bg-cem-elevated px-3 py-2 text-sm text-cem-text">
          Thanks, your feedback was sent
        </p>
      )}
      {status === 'queued' && (
        <p className="rounded bg-cem-elevated px-3 py-2 text-sm text-cem-text">
          Saved — will send when you&apos;re back online
        </p>
      )}
      {status === 'error' && (
        <div className="space-y-2 rounded bg-cem-elevated px-3 py-2">
          <p className="text-sm text-cem-text">Could not send, retry or copy your text</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleRetry}
              className="rounded bg-cem-amber px-3 py-1 text-sm font-semibold text-cem-base"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="rounded border border-cem-elevated px-3 py-1 text-sm font-medium text-cem-text"
            >
              Copy
            </button>
          </div>
        </div>
      )}

      {status !== 'success' && status !== 'queued' && (
        <button
          type="submit"
          disabled={!message.trim() || status === 'submitting'}
          className="rounded bg-cem-amber px-4 py-2 text-sm font-semibold text-cem-base disabled:opacity-50"
        >
          {status === 'submitting' ? 'Sending…' : 'Send feedback'}
        </button>
      )}
    </form>
  )
}

export default function FeedbackForm({ onClose }) {
  const { user } = useAuth()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-cem-surface p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-cem-text">Feedback</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-medium text-cem-secondary hover:text-cem-text"
          >
            Close
          </button>
        </div>
        {user ? <FeedbackFormBody /> : <IssueTrackerCard />}
      </div>
    </div>
  )
}