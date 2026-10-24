import Spinner from './Spinner'

// variant: 'primary' | 'secondary' | 'ghost' | 'danger'
export default function Button({
  children,
  variant = 'primary',
  loading = false,
  disabled = false,
  type = 'button',
  block = false,
  size,
  ...rest
}) {
  const classes = ['btn', `btn-${variant}`, block && 'btn-block', size === 'sm' && 'btn-sm']
    .filter(Boolean)
    .join(' ')
  return (
    <button className={classes} type={type} disabled={disabled || loading} {...rest}>
      {loading && <Spinner small />}
      <span>{children}</span>
    </button>
  )
}
