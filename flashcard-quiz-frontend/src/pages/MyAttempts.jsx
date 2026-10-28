import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getMyAttempts, getAttemptDetails } from '../services/api'
import { normalizeAttempts } from '../utils/attempts'
import { formatDate, formatDateTime } from '../utils/format'
import Alert from '../components/Alert'
import Badge from '../components/Badge'
import Button from '../components/Button'
import EmptyState from '../components/EmptyState'
import { LoadingBlock } from '../components/Spinner'
import PageHeader from '../components/PageHeader'
import AttemptReview from '../components/AttemptReview'
import { IconTrophy, IconSearch, IconCalendar, IconCheckCircle } from '../components/Icons'

export default function MyAttempts() {
  const { user } = useAuth()
  const [state, setState] = useState({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')

  // Review modal state
  const [selectedAttemptId, setSelectedAttemptId] = useState(null)
  const [reviewState, setReviewState] = useState({ status: 'idle', review: null, message: '' })

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    getMyAttempts(user.id)
      .then((list) => !cancelled && setState({ status: 'ready', attempts: normalizeAttempts(list) }))
      .catch((err) => !cancelled && setState({ status: 'error', message: err.message }))
    return () => {
      cancelled = true
    }
  }, [user.id, reloadKey])

  const openReview = useCallback(
    (attemptId) => {
      setSelectedAttemptId(attemptId)
      setReviewState({ status: 'loading', review: null, message: '' })
      getAttemptDetails(attemptId, user.id)
        .then((review) => {
          setReviewState({ status: 'ready', review, message: '' })
        })
        .catch((err) => {
          setReviewState({ status: 'error', review: null, message: err.message || 'Could not load review.' })
        })
    },
    [user.id]
  )

  const closeReview = useCallback(() => {
    setSelectedAttemptId(null)
    setReviewState({ status: 'idle', review: null, message: '' })
  }, [])

  // Close modal on Escape key
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && selectedAttemptId !== null) {
        closeReview()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedAttemptId, closeReview])

  const attempts = state.status === 'ready' ? state.attempts : []
  const filteredAttempts = attempts.filter((a) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase().trim()
    return (
      (a.title && a.title.toLowerCase().includes(q)) ||
      (a.topic && a.topic.toLowerCase().includes(q))
    )
  })

  return (
    <>
      <PageHeader title="My attempts" subtitle="Every quiz you've submitted, newest first." />

      {state.status === 'loading' && <LoadingBlock message="Loading your attempts…" />}

      {state.status === 'error' && (
        <Alert
          type="error"
          title="Couldn't load your attempts"
          action={
            <Button size="sm" variant="secondary" onClick={() => setReloadKey((k) => k + 1)}>
              Retry
            </Button>
          }
        >
          {state.message}
        </Alert>
      )}

      {state.status === 'ready' && attempts.length === 0 && (
        <div className="card">
          <EmptyState
            icon="📝"
            title="No attempts yet"
            action={<Link className="btn btn-primary" to="/quiz">Take today's quiz</Link>}
          >
            Once you submit a quiz, it will be listed here.
          </EmptyState>
        </div>
      )}

      {state.status === 'ready' && attempts.length > 0 && (
        <>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem',
              marginBottom: '1rem',
            }}
          >
            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
              <span className="badge badge-navy">
                {attempts.length} Total Attempt{attempts.length === 1 ? '' : 's'}
              </span>
              <span className="badge badge-green">
                Avg. {Math.round(attempts.reduce((acc, x) => acc + x.percent, 0) / attempts.length)}%
              </span>
            </div>

            <div style={{ position: 'relative', width: 'min(100%, 280px)' }}>
              <input
                type="search"
                placeholder="Search quiz title or topic…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  padding: '0.5rem 0.85rem',
                  fontSize: '0.88rem',
                  borderRadius: 'var(--radius-sm)',
                }}
              />
            </div>
          </div>

          <div className="card table-card">
            <table className="table">
              <thead>
                <tr>
                  <th>Quiz</th>
                  <th>Quiz date</th>
                  <th>Submitted</th>
                  <th>Score</th>
                  <th>Result</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredAttempts.map((a) => (
                  <tr key={a.id}>
                    <td data-label="Quiz">
                      <div className="cell-stack">
                        <strong>{a.title}</strong>
                        {a.topic && <span className="muted small">{a.topic}</span>}
                      </div>
                    </td>
                    <td data-label="Quiz date">{formatDate(a.quizDate)}</td>
                    <td data-label="Submitted">{formatDateTime(a.submittedAt)}</td>
                    <td data-label="Score">{a.score} / {a.total}</td>
                    <td data-label="Result">
                      <Badge tone={a.percent >= 80 ? 'green' : a.percent >= 50 ? 'navy' : 'amber'}>
                        {a.percent}%
                      </Badge>
                    </td>
                    <td data-label="Details">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => openReview(a.id)}
                        aria-label={`View details for ${a.title}`}
                      >
                        View Details
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Review Modal Dialog */}
      {selectedAttemptId !== null && (
        <div
          className="modal-backdrop"
          onClick={closeReview}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-review-title"
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 id="modal-review-title" style={{ margin: 0 }}>
                  Question-wise Review
                </h2>
                <span className="muted small">Attempt {selectedAttemptId}</span>
              </div>
              <button className="modal-close" onClick={closeReview} aria-label="Close review dialog">
                ✕
              </button>
            </div>

            <div className="modal-body">
              {reviewState.status === 'loading' && <LoadingBlock message="Loading question review…" />}

              {reviewState.status === 'error' && (
                <Alert
                  type="error"
                  title="Couldn't load review"
                  action={
                    <Button size="sm" variant="secondary" onClick={() => openReview(selectedAttemptId)}>
                      Retry
                    </Button>
                  }
                >
                  {reviewState.message}
                </Alert>
              )}

              {reviewState.status === 'ready' && <AttemptReview review={reviewState.review} />}
            </div>

            <div className="modal-footer">
              <Button variant="secondary" onClick={closeReview}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
