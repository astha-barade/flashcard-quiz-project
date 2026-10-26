import { useCallback, useEffect, useState } from 'react'
import { getAdminAnalytics, getAdminAttempts, getAdminAttemptDetails } from '../services/api'
import { formatDateTime, formatDate } from '../utils/format'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import Alert from '../components/Alert'
import Badge from '../components/Badge'
import Button from '../components/Button'
import EmptyState from '../components/EmptyState'
import AttemptReview from '../components/AttemptReview'

export default function AdminAnalytics() {
  const [analytics, setAnalytics] = useState(null)
  const [attempts, setAttempts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Attempt detail modal
  const [selectedAttemptId, setSelectedAttemptId] = useState(null)
  const [reviewData, setReviewData] = useState(null)
  const [reviewLoading, setReviewLoading] = useState(false)
  const [reviewError, setReviewError] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [analyticsData, attemptsData] = await Promise.all([
        getAdminAnalytics(),
        getAdminAttempts(),
      ])
      setAnalytics(analyticsData)
      setAttempts(Array.isArray(attemptsData) ? attemptsData : [])
    } catch (err) {
      setError(err.message || 'Failed to load analytics and attempts.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  async function openAttemptReview(attemptId) {
    setSelectedAttemptId(attemptId)
    setReviewLoading(true)
    setReviewError('')
    setReviewData(null)

    try {
      const data = await getAdminAttemptDetails(attemptId)
      setReviewData(data)
    } catch (err) {
      setReviewError(err.message || 'Could not load attempt details.')
    } finally {
      setReviewLoading(false)
    }
  }

  function closeAttemptReview() {
    setSelectedAttemptId(null)
    setReviewData(null)
    setReviewError('')
  }

  const filteredAttempts = attempts.filter((a) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase().trim()
    return (
      (a.studentName && a.studentName.toLowerCase().includes(q)) ||
      (a.studentEmail && a.studentEmail.toLowerCase().includes(q)) ||
      (a.quizTitle && a.quizTitle.toLowerCase().includes(q)) ||
      String(a.attemptId || a.id).includes(q)
    )
  })

  return (
    <>
      <PageHeader
        title="Student Results & Analytics"
        subtitle="Live quiz metrics and comprehensive student attempt logs."
      />

      {error && (
        <Alert
          type="error"
          action={
            <Button size="sm" variant="secondary" onClick={loadData}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {loading ? (
        <p className="muted" style={{ padding: '2rem 0', textAlign: 'center' }}>
          Loading analytics data…
        </p>
      ) : (
        <>
          {analytics && (
            <div className="stat-grid" style={{ marginBottom: '2rem' }}>
              <StatCard
                label="Total Quizzes"
                value={analytics.totalQuizzes ?? 0}
                hint={`${analytics.publishedQuizzes ?? 0} published · ${analytics.draftQuizzes ?? 0} draft`}
              />
              <StatCard
                label="Total Attempts"
                value={analytics.totalAttempts ?? 0}
                hint={`${analytics.uniqueStudents ?? 0} unique student${(analytics.uniqueStudents ?? 0) === 1 ? '' : 's'}`}
              />
              <StatCard
                label="Average Score"
                value={`${analytics.averageScore ?? 0}`}
                hint={`Mean points across attempts`}
              />
              <StatCard
                label="Average Accuracy"
                value={`${analytics.averagePercentage ?? 0}%`}
                hint="Overall platform accuracy"
              />
            </div>
          )}

          <section className="card">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
                marginBottom: '1.25rem',
              }}
            >
              <div>
                <h2 style={{ margin: 0 }}>Student Quiz Attempts</h2>
                <p className="muted small" style={{ margin: '0.25rem 0 0' }}>
                  {filteredAttempts.length} attempt{filteredAttempts.length === 1 ? '' : 's'} recorded in database
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="search"
                  className="input"
                  style={{ width: '240px', padding: '0.4rem 0.75rem', fontSize: '0.9rem' }}
                  placeholder="Search student or quiz…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <Button size="sm" variant="secondary" onClick={loadData}>
                  Refresh
                </Button>
              </div>
            </div>

            {filteredAttempts.length === 0 ? (
              <EmptyState icon="📊" title="No attempts found">
                {searchQuery
                  ? 'No attempts match your search criteria.'
                  : 'Students have not submitted any quiz attempts yet.'}
              </EmptyState>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th>Attempt #</th>
                      <th>Date / Time</th>
                      <th>Student</th>
                      <th>Quiz</th>
                      <th>Score</th>
                      <th>Accuracy</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAttempts.map((a) => (
                      <tr key={a.id || a.attemptId}>
                        <td>
                          <strong>#{a.id || a.attemptId}</strong>
                        </td>
                        <td>
                          <span className="small muted">
                            {a.submittedAt ? formatDateTime(a.submittedAt) : 'N/A'}
                          </span>
                        </td>
                        <td>
                          <div className="cell-stack">
                            <strong>{a.studentName || 'Student'}</strong>
                            <span className="small muted">{a.studentEmail}</span>
                          </div>
                        </td>
                        <td>
                          <div className="cell-stack">
                            <strong>{a.quizTitle || 'Quiz'}</strong>
                            <span className="small muted">
                              {a.quizTopic ? `${a.quizTopic} · ` : ''}
                              {a.quizDate ? formatDate(a.quizDate) : ''}
                            </span>
                          </div>
                        </td>
                        <td>
                          <strong>{a.score}</strong> / {a.totalQuestions}
                        </td>
                        <td>
                          <Badge
                            tone={
                              a.percentage >= 80
                                ? 'green'
                                : a.percentage >= 50
                                  ? 'navy'
                                  : 'amber'
                            }
                          >
                            {a.percentage}%
                          </Badge>
                        </td>
                        <td>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => openAttemptReview(a.id || a.attemptId)}
                          >
                            View details
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {/* Attempt Review Modal */}
      {selectedAttemptId !== null && (
        <div
          className="modal-backdrop"
          onClick={closeAttemptReview}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-analytics-title"
        >

          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(90vw, 600px)',
              maxWidth: '600px',
              maxHeight: '80vh',
              overflowY: 'auto',
              boxSizing: 'border-box',
            }}
          >

            <div className="modal-header">
              <div>
                <h2 id="modal-analytics-title" style={{ margin: 0 }}>
                  Question-wise Review
                </h2>
                <span className="muted small">Attempt #{selectedAttemptId}</span>
              </div>
              <button
                className="modal-close"
                onClick={closeAttemptReview}
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              {reviewLoading && (
                <p className="muted" style={{ padding: '2rem 0', textAlign: 'center' }}>
                  Loading question review…
                </p>
              )}

              {reviewError && (
                <Alert
                  type="error"
                  action={
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => openAttemptReview(selectedAttemptId)}
                    >
                      Retry
                    </Button>
                  }
                >
                  {reviewError}
                </Alert>
              )}

              {reviewData && <AttemptReview review={reviewData} />}
            </div>

            <div className="modal-footer">
              <Button variant="secondary" onClick={closeAttemptReview}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
