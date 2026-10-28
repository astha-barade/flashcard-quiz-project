// tone: 'navy' | 'green' | 'amber' | 'gray' | 'red'
export default function Badge({ tone = 'navy', className = '', children, ...props }) {
  const isCorrect =
    children === 'Correct' ||
    (typeof children === 'string' && children.toLowerCase().includes('correct'))

  const classes = [
    'badge',
    `badge-${tone}`,
    isCorrect && 'badge-correct',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <span className={classes} {...props}>
      {children}
    </span>
  )
}
