// Converts the timestamp formats the backend might send into milliseconds.
export function toTime(value) {
  if (!value) return 0
  if (Array.isArray(value)) {
    const [y, mo, d, h = 0, mi = 0, s = 0] = value
    return new Date(y, mo - 1, d, h, mi, s).getTime()
  }
  const t = new Date(value).getTime()
  return Number.isNaN(t) ? 0 : t
}
