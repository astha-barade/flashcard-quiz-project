// Small helpers for dates and percentages.
import { toTime } from './time'

/** Today's date as YYYY-MM-DD in the browser's local time. */
export function todayISO() {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function formatDateTime(value) {
  const t = toTime(value)
  if (!t) return value ? String(value) : '—'
  return new Date(t).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export function formatDate(value) {
  if (!value) return '—'
  // "2026-10-23" alone is parsed as UTC; add a time so it stays on the same day.
  if (typeof value === 'string' && value.length === 10) {
    return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { dateStyle: 'medium' })
  }
  const t = toTime(value)
  return t ? new Date(t).toLocaleDateString(undefined, { dateStyle: 'medium' }) : String(value)
}

export function percent(score, total) {
  return total > 0 ? Math.round((score / total) * 100) : 0
}
