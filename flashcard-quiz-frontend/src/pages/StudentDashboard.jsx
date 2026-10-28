import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getMyAttempts, getTodayQuiz } from '../services/api'
import { normalizeAttempts } from '../utils/attempts'
import { formatDateTime, formatDate } from '../utils/format'
import Alert from '../components/Alert'
import Badge from '../components/Badge'
import Button from '../components/Button'
import EmptyState from '../components/EmptyState'
import { LoadingBlock } from '../components/Spinner'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import {
  IconBook,
  IconTrophy,
  IconClock,
  IconCheckCircle,
  IconSparkles,
  IconCalendar,
  IconArrowRight,
  IconBarChart,
} from '../components/Icons'

export default function StudentDashboard() {
  const { user } = useAuth()
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

  // Generate the last 7 days for the date-wise learning calendar
  const pastDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    const isoDate = d.toISOString().split('T')[0]
    const dayName = d.toLocaleDateString(undefined, { weekday: 'short' })
    const dayNum = d.getDate()
    const attemptForDay = attempts.find((a) => {
      const aDate = a.submittedAt ? a.submittedAt.split('T')[0] : a.quizDate
      return aDate === isoDate
    })
    const isToday = i === 6
    return {
      isoDate,
      dayName,
      dayNum,
      isToday,
      attempt: attemptForDay,
    }
  })

  return (
    <>
      <PageHeader
        title={`Hello, ${user.name} 👋`}
        subtitle="Here's your learning overview."
      />

      {/* ---------- Today's quiz spotlight ---------- */}
      <section className="card hero-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
          <IconSparkles size={18} style={{ color: '#93c5fd' }} />
          <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#93c5fd' }}>
            Daily Challenge
          </span>
        </div>

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
          <div className="quiz-summary" style={{ marginTop: '0.75rem' }}>
            <div>
              <h3>{quizState.quiz.title}</h3>
              <p className="muted" style={{ margin: '0.25rem 0 0.5rem' }}>
                Topic: <strong style={{ color: '#fff' }}>{quizState.quiz.topic}</strong> ·{' '}
                {quizState.quiz.questions.length} question
                {quizState.quiz.questions.length === 1 ? '' : 's'}
              </p>
              {alreadyDone && <Badge tone="green">Already completed</Badge>}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              {alreadyDone ? (
                <Link className="btn btn-secondary" to="/attempts">
                  View my attempts
                </Link>
              ) : (
                <Link className="btn btn-primary" to="/quiz" style={{ fontWeight: 700 }}>
                  Start quiz →
                </Link>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ---------- Stats Grid ---------- */}
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

          {/* ---------- Date-wise Quiz History Calendar ---------- */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div className="card-head" style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <IconCalendar size={18} style={{ color: 'var(--blue-500)' }} />
                <h3 style={{ margin: 0 }}>7-Day Learning Activity</h3>
              </div>
              <span className="muted small">Consistency builds mastery</span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(85px, 1fr))',
                gap: '0.75rem',
                padding: '0.25rem 0',
              }}
            >
              {pastDays.map((day) => (
                <div
                  key={day.isoDate}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '0.85rem 0.5rem',
                    borderRadius: '10px',
                    border: day.isToday
                      ? '2px solid var(--blue-500)'
                      : '1px solid var(--border)',
                    background: day.attempt
                      ? 'var(--blue-50)'
                      : day.isToday
                      ? 'var(--surface)'
                      : 'var(--surface-subtle)',
                    transition: 'transform 0.15s ease',
                  }}
                >
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>
                    {day.dayName}
                  </span>
                  <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--navy-950)', margin: '0.15rem 0' }}>
                    {day.dayNum}
                  </span>
                  {day.attempt ? (
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: 'var(--green)',
                        background: 'var(--green-bg)',
                        border: '1px solid var(--green-border)',
                        padding: '0.1rem 0.4rem',
                        borderRadius: '999px',
                        marginTop: '0.25rem',
                      }}
                    >
                      {day.attempt.percent}%
                    </span>
                  ) : day.isToday ? (
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        color: 'var(--blue-600)',
                        marginTop: '0.25rem',
                      }}
                    >
                      Today
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
                      —
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ---------- Recent Attempts ---------- */}
          <div className="card">
            <div className="card-head">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <IconClock size={18} style={{ color: 'var(--blue-500)' }} />
                <h3 style={{ margin: 0 }}>Recent attempts</h3>
              </div>
              <Link to="/attempts" style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                See all →
              </Link>
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
