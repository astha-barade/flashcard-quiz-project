import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getMyAttempts, getTodayQuiz, submitQuiz } from '../services/api'
import { normalizeAttempts } from '../utils/attempts'
import Alert from '../components/Alert'
import Button from '../components/Button'
import EmptyState from '../components/EmptyState'
import { LoadingBlock } from '../components/Spinner'
import ProgressBar from '../components/ProgressBar'

const LETTERS = ['A', 'B', 'C', 'D']

export default function DailyQuiz() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [state, setState] = useState({ status: 'loading' }) // loading | ready | unavailable | error | done
  const [answers, setAnswers] = useState({}) // { [questionId]: 'A'..'D' }
  const [step, setStep] = useState(0) // 0..n-1 = question, n = review screen
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  // ---- load today's quiz (and check, best-effort, if it was already submitted) ----
  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })

    async function load() {
      try {
        const quiz = await getTodayQuiz()
        if (cancelled) return

        let attempted = false
        try {
          const list = normalizeAttempts(await getMyAttempts(user.id))
          attempted = list.some((a) => a.quizId === quiz.id)
        } catch {
          // If this check fails we still let the student try; the backend rejects duplicates.
        }
        if (cancelled) return

        if (attempted) {
          setState({ status: 'done', quiz })
          return
        }
        // Restore answers if the page was refreshed mid-quiz.
        try {
          const saved = JSON.parse(sessionStorage.getItem(`fq_answers_${user.id}_${quiz.id}`) || '{}')
          setAnswers(saved)
        } catch {
          setAnswers({})
        }
        setStep(0)
        setState({ status: 'ready', quiz })
      } catch (err) {
        if (cancelled) return
        if (err.status === 400) setState({ status: 'unavailable', message: err.message })
        else setState({ status: 'error', message: err.message })
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [user.id, reloadKey])

  function choose(questionId, letter) {
    const next = { ...answers, [questionId]: letter }
    setAnswers(next)
    sessionStorage.setItem(`fq_answers_${user.id}_${state.quiz.id}`, JSON.stringify(next))
  }

  async function handleSubmit() {
    const { quiz } = state
    setSubmitError('')
    setSubmitting(true)
    try {
      const result = await submitQuiz(quiz.id, user.id, answers)
      sessionStorage.removeItem(`fq_answers_${user.id}_${quiz.id}`)
      navigate(`/results/${quiz.id}`, {
        replace: true,
        state: { result, quizTitle: quiz.title, quizTopic: quiz.topic },
      })
    } catch (err) {
      setSubmitError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // ------------------------------- render -------------------------------
  if (state.status === 'loading') return <LoadingBlock message="Loading today's quiz…" />

  if (state.status === 'error') {
    return (
      <div className="narrow">
        <Alert
          type="error"
          title="Couldn't load today's quiz"
          action={<Button size="sm" variant="secondary" onClick={() => setReloadKey((k) => k + 1)}>Retry</Button>}
        >
          {state.message}
        </Alert>
      </div>
    )
  }

  if (state.status === 'unavailable') {
    return (
      <div className="card narrow">
        <EmptyState
          icon="🌙"
          title="No quiz available right now"
          action={<Link className="btn btn-secondary" to="/dashboard">Back to dashboard</Link>}
        >
          {state.message}. Check back later.
        </EmptyState>
      </div>
    )
  }

  if (state.status === 'done') {
    return (
      <div className="card narrow">
        <EmptyState
          icon="✅"
          title="You've already completed today's quiz"
          action={<Link className="btn btn-primary" to="/attempts">View my attempts</Link>}
        >
          “{state.quiz.title}” can only be submitted once.
        </EmptyState>
      </div>
    )
  }

  const { quiz } = state
  const questions = quiz.questions
  const total = questions.length

  if (total === 0) {
    return (
      <div className="card narrow">
        <EmptyState icon="📭" title="This quiz has no questions">
          The quiz is published but the backend returned no questions for it.
        </EmptyState>
      </div>
    )
  }

  const answeredCount = questions.filter((q) => answers[q.id]).length
  const unanswered = total - answeredCount
  const onReview = step >= total
  const q = questions[Math.min(step, total - 1)]

  return (
    <div className="quiz-page">
      <div className="quiz-top">
        <div>
          <h1>{quiz.title}</h1>
          <p className="muted">Topic: {quiz.topic}</p>
        </div>
        <span className="quiz-count">{answeredCount}/{total} answered</span>
      </div>
      <ProgressBar value={answeredCount} max={total} label="Questions answered" />

      {submitError && (
        <Alert
          type="error"
          title="Couldn't submit your quiz"
          action={
            /already submitted/i.test(submitError) ? (
              <Link className="btn btn-secondary btn-sm" to="/attempts">My attempts</Link>
            ) : null
          }
        >
          {submitError}
        </Alert>
      )}

      {!onReview && (
        <div className="card flashcard">
          <span className="flashcard-index">Question {step + 1} of {total}</span>
          <h2 className="flashcard-question">{q.questionText}</h2>

          <div className="options" role="radiogroup" aria-label={`Answers for question ${step + 1}`}>
            {LETTERS.map((letter) => {
              const text = q[`option${letter}`]
              const selected = answers[q.id] === letter
              return (
                <label key={letter} className={`option ${selected ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name={`question-${q.id}`}
                    value={letter}
                    checked={selected}
                    onChange={() => choose(q.id, letter)}
                  />
                  <span className="option-letter">{letter}</span>
                  <span className="option-text">{text}</span>
                </label>
              )
            })}
          </div>

          <div className="quiz-nav">
            <Button variant="secondary" disabled={step === 0} onClick={() => setStep(step - 1)}>
              ← Previous
            </Button>
            <Button onClick={() => setStep(step + 1)}>
              {step === total - 1 ? 'Review & submit' : 'Next →'}
            </Button>
          </div>
        </div>
      )}

      {onReview && (
        <div className="card">
          <h2>Review your answers</h2>
          <p className="muted">Select a number to go back to that question.</p>
          <div className="review-grid">
            {questions.map((item, i) => (
              <button
                key={item.id}
                className={`review-chip ${answers[item.id] ? 'answered' : ''}`}
                onClick={() => setStep(i)}
                aria-label={`Question ${i + 1}: ${answers[item.id] ? `answered ${answers[item.id]}` : 'not answered'}`}
              >
                {i + 1}
              </button>
            ))}
          </div>

          {unanswered > 0 && (
            <Alert type="warning">
              {unanswered} question{unanswered === 1 ? ' is' : 's are'} unanswered and will count as incorrect.
            </Alert>
          )}
          <p className="muted small">You can only submit this quiz once.</p>

          <div className="quiz-nav">
            <Button variant="secondary" onClick={() => setStep(total - 1)}>← Back to questions</Button>
            <Button onClick={handleSubmit} loading={submitting}>Submit quiz</Button>
          </div>
        </div>
      )}
    </div>
  )
}
