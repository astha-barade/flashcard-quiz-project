export default function Spinner({ small = false }) {
  return <span className={small ? 'spinner spinner-sm' : 'spinner'} role="status" aria-label="Loading" />
}

/** A centered spinner with a message, used while a page loads. */
export function LoadingBlock({ message = 'Loading…' }) {
  return (
    <div className="loading-block">
      <Spinner />
      <p>{message}</p>
    </div>
  )
}
