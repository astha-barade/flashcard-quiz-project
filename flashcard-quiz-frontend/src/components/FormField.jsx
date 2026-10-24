import { useId } from 'react'

/**
 * Label + input + error message in one piece.
 * Pass `as="textarea"` for a multi-line box.
 */
export default function FormField({ label, error, hint, as = 'input', ...inputProps }) {
  const id = useId()
  const Tag = as
  return (
    <div className={`field ${error ? 'field-error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <Tag
        id={id}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? `${id}-err` : undefined}
        {...inputProps}
      />
      {hint && !error && <small className="field-hint">{hint}</small>}
      {error && (
        <small id={`${id}-err`} className="field-message">
          {error}
        </small>
      )}
    </div>
  )
}
