import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getMyAttempts, getAttemptDetails } from '../services/api'
import { normalizeAttempts } from '../utils/attempts'
import { formatDateTime, percent as calcPercent } from '../utils/format'
import Alert from '../components/Alert'
import Button from '../components/Button'
import EmptyState from '../components/EmptyState'
import { LoadingBlock } from '../components/Spinner'
import ScoreRing from '../components/ScoreRing'
import AttemptReview from '../components/AttemptReview'

function verdict(pct) {
  if (pct >= 80) return { emoji: '🎉', text: 'Excellent work!' }
  if (pct >= 50) return { emoji: '👍', text: 'Good job — keep going!' }
  return { emoji: '💪', text: 'Keep practising, you will improve.' }
}

export default function QuizResults() {
  const { quizId } = useParams()
  const { user } = useAuth()
  const location = useLocation()

  // Right after submitting, the quiz page passes the backend's response here.
  const fromSubmit = location.state?.result
  const [state, setState] = useState(
    fromSubmit
      ? {
          status: 'ready',
          result: {
            attemptId: fromSubmit.attemptId || null,
            score: fromSubmit.score,
            total: fromSubmit.totalQuestions,
            title: location.state.quizTitle,
            topic: location.state.quizTopic,
            submittedAt: null,
          },
        }
      : { status: 'loading' },
  )
  const [reloadKey, setReloadKey] = useState(0)
  const [review, setReview] = useState(null)
  const [loadingReview, setLoadingReview] = useState(false)

  // If the page was opened/refreshed without that data, look the attempt up from the backend.
  useEffect(() => {
    let cancelled = false
    if (!fromSubmit) {
      setState({ status: 'loading' })
      getMyAttempts(user.id)
        .then((list) => {
          if (cancelled) return
          const match = normalizeAttempts(list).find((a) => String(a.quizId) === String(quizId))
          if (match) {
            setState({
              status: 'ready',
              result: {
                attemptId: match.id,
                score: match.score,
                total: match.total,
                title: match.title,
                topic: match.topic,
                submittedAt: match.submittedAt,
              },
            })
          } else {
            setState({ status: 'missing' })
          }
        })
        .catch((err) => !cancelled && setState({ status: 'error', message: err.message }))
    } else if (!fromSubmit.attemptId) {
      // If fromSubmit had no attemptId, find it from getMyAttempts
      getMyAttempts(user.id)
        .then((list) => {
          if (cancelled) return
          const match = normalizeAttempts(list).find((a) => String(a.quizId) === String(quizId))
          if (match?.id) {
            setState((prev) => ({
              ...prev,
              result: { ...prev.result, attemptId: match.id, submittedAt: match.submittedAt },
            }))
          }
        })
        .catch(() => {})
    }

    return () => {
      cancelled = true
    }
  }, [fromSubmit, quizId, user.id, reloadKey])

  // Fetch detailed review once attemptId is available
  const attemptId = state.result?.attemptId || fromSubmit?.attemptId
  useEffect(() => {
    if (!attemptId) return
    let cancelled = false
    setLoadingReview(true)
    getAttemptDetails(attemptId, user.id)
      .then((data) => {
        if (!cancelled) setReview(data)
      })
      .catch(() => {
        // Detailed review might be unavailable for older attempts
      })
      .finally(() => {
        if (!cancelled) setLoadingReview(false)
      })

    return () => {
      cancelled = true
    }
  }, [attemptId, user.id])

  if (state.status === 'loading') return <LoadingBlock message="Loading your result…" />

  if (state.status === 'error') {
    return (
      <div className="narrow">
        <Alert
          type="error"
          title="Couldn't load this result"
          action={<Button size="sm" variant="secondary" onClick={() => setReloadKey((k) => k + 1)}>Retry</Button>}
        >
          {state.message}
        </Alert>
      </div>
    )
  }

  if (state.status === 'missing') {
    return (
      <div className="card narrow">
        <EmptyState
          title="No result found"
          action={<Link className="btn btn-secondary" to="/attempts">View my attempts</Link>}
        >
          You haven't submitted an attempt for this quiz yet.
        </EmptyState>
      </div>
    )
  }

  const { score, total, title, topic, submittedAt } = state.result
  const pct = calcPercent(score, total)
  const v = verdict(pct)

  return (
    <div className="card results-card" style={{ maxWidth: '820px', margin: '0 auto' }}>
      <p className="eyebrow">Quiz results</p>
      <h1>{title || `Quiz #${quizId}`}</h1>
      {topic && <p className="muted">Topic: {topic}</p>}

      <ScoreRing percent={pct}>
        <span className="ring-score">{score}<small>/{total}</small></span>
        <span className="ring-pct">{pct}%</span>
      </ScoreRing>

      <p className="verdict"><span aria-hidden="true">{v.emoji}</span> {v.text}</p>
      {submittedAt && <p className="muted small">Submitted {formatDateTime(submittedAt)}</p>}

      <div style={{ margin: '1.75rem 0', textAlign: 'left' }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '0.75rem' }}>Question Review</h2>
        {loadingReview && <LoadingBlock message="Loading detailed answer review…" />}

        {review && <AttemptReview review={review} />}

        {!loadingReview && !review && (
          <div className="note">
            <strong>Question review unavailable for this attempt.</strong> This attempt does not have saved question-level answers.
          </div>
        )}
      </div>

      <div className="results-actions">
        <Link className="btn btn-primary" to="/attempts">My attempts</Link>
        <Link className="btn btn-secondary" to="/dashboard">Dashboard</Link>
      </div>
    </div>
  )
}

