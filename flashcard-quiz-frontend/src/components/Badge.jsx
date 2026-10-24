// tone: 'navy' | 'green' | 'amber' | 'gray' | 'red'
export default function Badge({ tone = 'navy', children }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}
