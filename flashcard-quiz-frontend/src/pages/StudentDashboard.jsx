import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getMyAttempts, getTodayQuiz } from '../services/api'
import { normalizeAttempts } from '../utils/attempts'
import { formatDateTime } from '../utils/format'
import Alert from '../components/Alert'
import Badge from '../components/Badge'
import Button from '../components/Button'
import EmptyState from '../components/EmptyState'
import { LoadingBlock } from '../components/Spinner'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'

export default function StudentDashboard() {
  const { user } = useAuth()
  // Each state is { status: 'loading' | 'ready' | 'unavailable' | 'error', ... }
  const [quizState, setQuizState] = useState({ status: 'loading' })
  const [attemptsState, setAttemptsState] = useState({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setQuizState({ status: 'loading' })
    setAttemptsState({ status: 'loading' })

    getTodayQuiz()
      .then((quiz) => !cancelled && setQuizState({ status: 'ready', quiz }))
      .catch((err) => {
        if (cancelled) return
        // The backend answers HTTP 400 with a message when there is no published quiz today.
        if (err.status === 400) setQuizState({ status: 'unavailable', message: err.message })
        else setQuizState({ status: 'error', message: err.message })
      })

    getMyAttempts(user.id)
      .then((list) => !cancelled && setAttemptsState({ status: 'ready', attempts: normalizeAttempts(list) }))
      .catch((err) => !cancelled && setAttemptsState({ status: 'error', message: err.message }))

    return () => {
      cancelled = true
    }
  }, [user.id, reloadKey])

  const retry = () => setReloadKey((k) => k + 1)
  const attempts = attemptsState.status === 'ready' ? attemptsState.attempts : []
  const alreadyDone =
    quizState.status === 'ready' && attempts.some((a) => a.quizId === quizState.quiz.id)

  const avg = attempts.length
    ? Math.round(attempts.reduce((sum, a) => sum + a.percent, 0) / attempts.length)
    : null
  const best = attempts.length ? Math.max(...attempts.map((a) => a.percent)) : null

  return (
    <>
      <PageHeader title={`Hello, ${user.name} 👋`} subtitle="Here's your learning overview." />

      {/* ---------- Today's quiz ---------- */}
      <section className="card hero-card">
        <h2>Today's quiz</h2>
        {quizState.status === 'loading' && <LoadingBlock message="Checking for today's quiz…" />}

        {quizState.status === 'error' && (
          <Alert
            type="error"
            title="Couldn't load today's quiz"
            action={<Button size="sm" variant="secondary" onClick={retry}>Retry</Button>}
          >
            {quizState.message}
          </Alert>
        )}

        {quizState.status === 'unavailable' && (
          <EmptyState icon="🌙" title="No quiz available right now">
            {quizState.message}. Check back later.
          </EmptyState>
        )}

        {quizState.status === 'ready' && (
          <div className="quiz-summary">
            <div>
              <h3>{quizState.quiz.title}</h3>
              <p className="muted">
                Topic: <strong>{quizState.quiz.topic}</strong> ·{' '}
                {quizState.quiz.questions.length} question
                {quizState.quiz.questions.length === 1 ? '' : 's'}
              </p>
              {alreadyDone && <Badge tone="green">Already completed</Badge>}
            </div>
            {alreadyDone ? (
              <Link className="btn btn-secondary" to="/attempts">View my attempts</Link>
            ) : (
              <Link className="btn btn-primary" to="/quiz">Start quiz →</Link>
            )}
          </div>
        )}
      </section>

      {/* ---------- Stats + recent attempts ---------- */}
      <h2 className="section-title">Your progress</h2>
      {attemptsState.status === 'loading' && <LoadingBlock message="Loading your attempts…" />}

      {attemptsState.status === 'error' && (
        <Alert
          type="error"
          title="Couldn't load your attempts"
          action={<Button size="sm" variant="secondary" onClick={retry}>Retry</Button>}
        >
          {attemptsState.message}
        </Alert>
      )}

      {attemptsState.status === 'ready' && attempts.length === 0 && (
        <div className="card">
          <EmptyState icon="📝" title="No attempts yet">
            Complete your first daily quiz and your results will appear here.
          </EmptyState>
        </div>
      )}

      {attemptsState.status === 'ready' && attempts.length > 0 && (
        <>
          <div className="stat-grid">
            <StatCard label="Quizzes taken" value={attempts.length} />
            <StatCard label="Average score" value={`${avg}%`} />
            <StatCard label="Best score" value={`${best}%`} />
            <StatCard
              label="Latest"
              value={`${attempts[0].score}/${attempts[0].total}`}
              hint={formatDateTime(attempts[0].submittedAt)}
            />
          </div>

          <div className="card">
            <div className="card-head">
              <h3>Recent attempts</h3>
              <Link to="/attempts">See all →</Link>
            </div>
            <ul className="plain-list">
              {attempts.slice(0, 3).map((a) => (
                <li key={a.id}>
                  <div>
                    <strong>{a.title}</strong>
                    <span className="muted small">{formatDateTime(a.submittedAt)}</span>
                  </div>
                  <Badge tone={a.percent >= 80 ? 'green' : a.percent >= 50 ? 'navy' : 'amber'}>
                    {a.score}/{a.total} · {a.percent}%
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </>
  )
}
