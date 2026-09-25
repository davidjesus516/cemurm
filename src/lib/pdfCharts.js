// PDF scan charts (Hito 5 #76): storage upload, signed URLs, validation and
// offline cache. midi.js/spotify.js pattern — every DOM/env access is guarded
// so this module never explodes in node (no caches, no URL.createObjectURL).

import { supabase } from './supabase.js'
import { cacheName } from './storage.js'

// Product cap: 10 MB per scan (acceptance #8). The stack cap
// (supabase/config.toml file_size_limit = "50MiB") is the hard server limit;
// validatePdfFile is the app guard that runs BEFORE any upload or write.
export const PDF_MAX_BYTES = 10 * 1024 * 1024
export const PDF_CACHE_VERSION = 1
export const PDF_SIZE_MESSAGE = 'PDF scans are limited to 10 MB'
export const PDF_TYPE_MESSAGE = 'Only PDF files are accepted'

/** Online check (guarded for node — no navigator ⇒ online). */
export function isOnline() {
  if (typeof navigator === 'undefined') return true
  return navigator.onLine !== false
}

/**
 * Validate a picked/selected PDF file against type + size.
 * Type: accept file.type 'application/pdf' OR the '.pdf' extension (either
 * satisfies — some pickers/files report no MIME type).
 * Returns { ok: true, sizeBytes } or { ok: false, reason: 'size' | 'type' }.
 */
export function validatePdfFile(file) {
  if (!file) return { ok: false, reason: 'type' }
  const looksPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '')
  if (!looksPdf) return { ok: false, reason: 'type' }
  const sizeBytes = Number(file.size) || 0
  if (sizeBytes > PDF_MAX_BYTES) return { ok: false, reason: 'size' }
  return { ok: true, sizeBytes }
}

/** Object key: `${userId}/${uuid}-<base>.pdf` — the first path segment IS the
 *  RLS boundary (owner folder), the uuid suffix keeps the key unguessable, and
 *  a sanitized base name keeps objects human-readable (extension dropped — the
 *  official suffix is always exactly '.pdf'). */
export function buildPdfObjectKey(userId, fileName) {
  const uuid = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const safeBase = String(fileName || 'scan')
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .slice(-40)
  return `${userId}/${uuid}-${safeBase}.pdf`
}

/** Upload to the private 'charts' bucket; returns { path }. Throws on error —
 *  callers map/display it (form stays the first validation gate). */
export async function uploadPdf(userId, file) {
  const key = buildPdfObjectKey(userId, file.name)
  const { data, error } = await supabase.storage.from('charts').upload(key, file, {
    contentType: 'application/pdf',
    upsert: false,
  })
  if (error) throw error
  return { path: data?.path || key }
}

/** Signed URL (tech-spec R2: bucket stays private, signed URLs only).
 *  Returns { signedUrl }. Throws on error. */
export async function signedPdfUrl(path, expiresInSeconds = 3600) {
  const { data, error } = await supabase.storage
    .from('charts')
    .createSignedUrl(path, expiresInSeconds)
  if (error) throw error
  return { signedUrl: data?.signedUrl || '' }
}

/**
 * Offline availability (scenario 5): fetch the signed URL and put the blob in
 * the versioned 'pdf' cache, keyed by the STABLE object path (survives
 * re-signing). Best-effort — never throws; returns true when cached.
 * Fire-and-forget from maybeCachePdf (songs.js) so reads never block on it.
 */
export async function ensurePdfCached(path) {
  try {
    if (typeof caches === 'undefined') return false
    if (!isOnline()) return false
    const { signedUrl } = await signedPdfUrl(path)
    if (!signedUrl) return false
    const res = await fetch(signedUrl)
    if (!res.ok) return false
    const blob = await res.blob()
    const cache = await caches.open(cacheName('pdf', PDF_CACHE_VERSION))
    await cache.put(new Request(path), new Response(blob, {
      headers: { 'Content-Type': 'application/pdf' },
    }))
    return true
  } catch {
    return false
  }
}

/** Read a cached scan blob by object path (stage-mode offline path). Returns
 *  the blob or null. Guarded, never throws. */
export async function getCachedPdfBlob(path) {
  try {
    if (typeof caches === 'undefined' || !path) return null
    const cache = await caches.open(cacheName('pdf', PDF_CACHE_VERSION))
    const res = await cache.match(path)
    if (!res) return null
    return await res.blob()
  } catch {
    return null
  }
}

/** Blob → objectURL for iframe/embed without network. Guarded (node has no
 *  URL.createObjectURL). Caller revokes when done (StageMode unmount). */
export function objectUrlForBlob(blob) {
  if (!blob || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return null
  }
  return URL.createObjectURL(blob)
}

/** True when the flattened song's current chart is a PDF scan. */
export function isPdfChart(song) {
  return song?.format === 'pdf'
}