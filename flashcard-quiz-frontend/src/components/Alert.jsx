// type: 'error' | 'success' | 'info' | 'warning'
export default function Alert({ type = 'info', title, children, action }) {
  return (
    <div className={`alert alert-${type}`} role={type === 'error' ? 'alert' : 'status'}>
      <div className="alert-body">
        {title && <strong>{title}</strong>}
        {children && <p>{children}</p>}
      </div>
      {action}
    </div>
  )
}
