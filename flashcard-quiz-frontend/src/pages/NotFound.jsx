import { Link } from 'react-router-dom'
import EmptyState from '../components/EmptyState'

export default function NotFound() {
  return (
    <div className="card narrow">
      <EmptyState icon="🧭" title="Page not found" action={<Link className="btn btn-primary" to="/">Go home</Link>}>
        The page you're looking for doesn't exist.
      </EmptyState>
    </div>
  )
}
