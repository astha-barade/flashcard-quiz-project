import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  addQuestion,
  createQuiz,
  publishQuiz,
  getAdminQuizzes,
} from '../services/api'
import { formatDate, todayISO } from '../utils/format'
import Alert from '../components/Alert'
import Badge from '../components/Badge'
import Button from '../components/Button'
import EmptyState from '../components/EmptyState'
import FormField from '../components/FormField'
import PageHeader from '../components/PageHeader'

const EMPTY_QUESTION = {
  questionText: '',
  optionA: '',
  optionB: '',
  optionC: '',
  optionD: '',
  correctOption: '',
}

const UNAVAILABLE = [
  'Viewing, editing or deleting existing questions',
  'Editing or deleting quizzes',
  'Un-publishing a quiz',
  'Viewing student results or analytics',
  'Creating other admin accounts (done directly in the database)',
]

export default function AdminDashboard() {
  const { user } = useAuth()

  const [quizzes, setQuizzes] = useState([])
  const [loadingQuizzes, setLoadingQuizzes] = useState(true)
  const [quizListError, setQuizListError] = useState('')

  const [banner, setBanner] = useState(null)

  const [quizForm, setQuizForm] = useState({
    title: '',
    topic: '',
    quizDate: todayISO(),
  })
  const [quizErrors, setQuizErrors] = useState({})
  const [quizApiError, setQuizApiError] = useState('')
  const [creating, setCreating] = useState(false)

  const [selectedQuizId, setSelectedQuizId] = useState('')
  const [qForm, setQForm] = useState(EMPTY_QUESTION)
  const [qErrors, setQErrors] = useState({})
  const [qApiError, setQApiError] = useState('')
  const [adding, setAdding] = useState(false)

  const [confirmingId, setConfirmingId] = useState(null)
  const [publishingId, setPublishingId] = useState(null)

  // Fetch quizzes from the backend database.
  const refreshQuizzes = useCallback(async () => {
    setLoadingQuizzes(true)
    setQuizListError('')

    try {
      const data = await getAdminQuizzes()

      const list = (Array.isArray(data) ? data : []).map((q) => ({
        id: q.id,
        title: q.title,
        topic: q.topic ?? '',
        quizDate: q.quizDate ?? null,
        published: q.published,
        questionsAdded: q.questionsAdded ?? 0,
      }))

      setQuizzes(list)

      // Keep the selected quiz if it still exists.
      setSelectedQuizId((currentId) =>
        list.some((q) => String(q.id) === currentId)
          ? currentId
          : ''
      )
    } catch (err) {
      setQuizListError(err.message || 'Could not load quizzes.')
    } finally {
      setLoadingQuizzes(false)
    }
  }, [])

  useEffect(() => {
    refreshQuizzes()
  }, [refreshQuizzes])

  const updateQuiz = (id, changes) => {
    setQuizzes((list) =>
      list.map((q) => (q.id === id ? { ...q, ...changes } : q))
    )
  }

  // 1. Create quiz
  async function handleCreateQuiz(e) {
    e.preventDefault()
    setQuizApiError('')
    setBanner(null)

    const errs = {}

    if (!quizForm.title.trim()) errs.title = 'Title is required.'
    if (!quizForm.topic.trim()) errs.topic = 'Topic is required.'
    if (!quizForm.quizDate) errs.quizDate = 'Pick the date this quiz is for.'

    setQuizErrors(errs)

    if (Object.keys(errs).length) return

    setCreating(true)

    try {
      const created = await createQuiz({
        title: quizForm.title.trim(),
        topic: quizForm.topic.trim(),
        quizDate: quizForm.quizDate,
        adminId: user.id,
      })

      await refreshQuizzes()
      setSelectedQuizId(String(created.id))

      setQuizForm({
        title: '',
        topic: '',
        quizDate: todayISO(),
      })
      setQuizErrors({})

      setBanner({
        type: 'success',
        text: `Quiz "${created.title ?? quizForm.title}" created (ID ${created.id}). Now add questions to it.`,
      })
    } catch (err) {
      setQuizApiError(err.message || 'Could not create the quiz.')
    } finally {
      setCreating(false)
    }
  }

  // 2. Add question
  async function handleAddQuestion(e) {
    e.preventDefault()
    setQApiError('')
    setBanner(null)

    const errs = {}

    if (!selectedQuizId) errs.quizId = 'Choose a quiz first.'
    if (!qForm.questionText.trim()) {
      errs.questionText = 'Question text is required.'
    }

    ;['A', 'B', 'C', 'D'].forEach((letter) => {
      if (!qForm[`option${letter}`].trim()) {
        errs[`option${letter}`] = `Option ${letter} is required.`
      }
    })

    if (!qForm.correctOption) {
      errs.correctOption = 'Select the correct option.'
    }

    setQErrors(errs)

    if (Object.keys(errs).length) return

    setAdding(true)

    try {
      const saved = await addQuestion({
        quizId: Number(selectedQuizId),
        questionText: qForm.questionText.trim(),
        optionA: qForm.optionA.trim(),
        optionB: qForm.optionB.trim(),
        optionC: qForm.optionC.trim(),
        optionD: qForm.optionD.trim(),
        correctOption: qForm.correctOption,
      })

      await refreshQuizzes()
      setQForm(EMPTY_QUESTION)
      setQErrors({})

      setBanner({
        type: 'success',
        text: `Question saved${saved?.id ? ` (ID ${saved.id})` : ''}.`,
      })
    } catch (err) {
      setQApiError(err.message || 'Could not save the question.')
    } finally {
      setAdding(false)
    }
  }

  // 3. Publish quiz
  async function handlePublish(quiz) {
    setBanner(null)
    setPublishingId(quiz.id)

    try {
      await publishQuiz(quiz.id)
      await refreshQuizzes()

      setBanner({
        type: 'success',
        text: `"${quiz.title}" is published. Students can see it when its quiz date is today.`,
      })
    } catch (err) {
      setBanner({
        type: 'error',
        text: `Could not publish "${quiz.title}": ${err.message}`,
      })
    } finally {
      setPublishingId(null)
      setConfirmingId(null)
    }
  }

  const setQ = (field) => (e) => {
    setQForm((form) => ({
      ...form,
      [field]: e.target.value,
    }))
  }

  return (
    <>
      <PageHeader
        title="Admin dashboard"
        subtitle="Create a quiz, add its questions, then publish it for students."
      />

      <ol className="steps">
        <li><span>1</span> Create quiz</li>
        <li><span>2</span> Add questions</li>
        <li><span>3</span> Publish</li>
      </ol>

      {banner && <Alert type={banner.type}>{banner.text}</Alert>}

      <div className="admin-grid">
        <div className="admin-col">
          {/* 1. Create quiz */}
          <section className="card">
            <h2>1 · Create a quiz</h2>
            <p className="muted small">
              The backend allows only one quiz per date.
            </p>

            {quizApiError && <Alert type="error">{quizApiError}</Alert>}

            <form onSubmit={handleCreateQuiz} noValidate>
              <FormField
                label="Title"
                value={quizForm.title}
                onChange={(e) =>
                  setQuizForm((f) => ({ ...f, title: e.target.value }))
                }
                error={quizErrors.title}
              />

              <FormField
                label="Topic"
                value={quizForm.topic}
                onChange={(e) =>
                  setQuizForm((f) => ({ ...f, topic: e.target.value }))
                }
                error={quizErrors.topic}
              />

              <FormField
                label="Quiz date"
                type="date"
                value={quizForm.quizDate}
                onChange={(e) =>
                  setQuizForm((f) => ({ ...f, quizDate: e.target.value }))
                }
                error={quizErrors.quizDate}
                hint="Students can only take the quiz dated today."
              />

              <Button type="submit" loading={creating}>
                Create quiz
              </Button>
            </form>
          </section>

          {/* 2. Add question */}
          <section className="card">
            <h2>2 · Add a question</h2>

            {qApiError && <Alert type="error">{qApiError}</Alert>}

            <form onSubmit={handleAddQuestion} noValidate>
              <FormField
                as="select"
                label="Quiz"
                value={selectedQuizId}
                onChange={(e) => setSelectedQuizId(e.target.value)}
                error={qErrors.quizId}
                hint={
                  quizzes.length === 0
                    ? 'Create a quiz first.'
                    : 'Select the quiz you want to add a question to.'
                }
              >
                <option value="">Select a quiz…</option>
                {quizzes.map((q) => (
                  <option key={q.id} value={q.id}>
                    #{q.id} · {q.title}
                  </option>
                ))}
              </FormField>

              <FormField
                as="textarea"
                rows={3}
                label="Question"
                value={qForm.questionText}
                onChange={setQ('questionText')}
                error={qErrors.questionText}
              />

              <div className="two-col">
                {['A', 'B', 'C', 'D'].map((letter) => (
                  <FormField
                    key={letter}
                    label={`Option ${letter}`}
                    value={qForm[`option${letter}`]}
                    onChange={setQ(`option${letter}`)}
                    error={qErrors[`option${letter}`]}
                  />
                ))}
              </div>

              <fieldset
                className={`radio-row ${qErrors.correctOption ? 'field-error' : ''
                  }`}
              >
                <legend>Correct option</legend>

                {['A', 'B', 'C', 'D'].map((letter) => (
                  <label
                    key={letter}
                    className={
                      qForm.correctOption === letter ? 'selected' : ''
                    }
                  >
                    <input
                      type="radio"
                      name="correctOption"
                      value={letter}
                      checked={qForm.correctOption === letter}
                      onChange={setQ('correctOption')}
                    />
                    {letter}
                  </label>
                ))}

                {qErrors.correctOption && (
                  <small className="field-message">
                    {qErrors.correctOption}
                  </small>
                )}
              </fieldset>

              <Button
                type="submit"
                loading={adding}
                disabled={loadingQuizzes || quizzes.length === 0}
              >
                Add question
              </Button>
            </form>
          </section>
        </div>

        <div className="admin-col">
          {/* 3. Publish and list database quizzes */}
          <section className="card">
            <h2>3 · Publish</h2>

            <p className="muted small">
              Quizzes below are loaded from the backend database.
            </p>

            <Button
              type="button"
              variant="secondary"
              onClick={refreshQuizzes}
              loading={loadingQuizzes}
            >
              Refresh quizzes
            </Button>

            {quizListError && (
              <div>
                <Alert type="error">{quizListError}</Alert>
                <p className="muted small">
                  Check that the backend is running and your admin account is
                  authorized to access the quiz list.
                </p>
              </div>
            )}

            {loadingQuizzes ? (
              <p className="muted">Loading quizzes…</p>
            ) : quizListError ? null : quizzes.length === 0 ? (
              <EmptyState icon="📚" title="No quizzes found">
                Create a quiz using the form on the left.
              </EmptyState>
            ) : (
              <ul className="quiz-list">
                {quizzes.map((q) => (
                  <li key={q.id}>
                    <div className="quiz-list-main">
                      <strong>{q.title}</strong>

                      <span className="muted small">
                        ID {q.id}
                        {q.topic ? ` · ${q.topic}` : ''}
                        {q.quizDate ? ` · ${formatDate(q.quizDate)}` : ''}
                      </span>

                      <span className="muted small">
                        {q.questionsAdded} question
                        {q.questionsAdded === 1 ? '' : 's'} in database
                      </span>
                    </div>

                    <div className="quiz-list-actions">
                      {q.published === true && (
                        <Badge tone="green">Published</Badge>
                      )}

                      {q.published === false && (
                        <Badge tone="gray">Draft</Badge>
                      )}

                      {q.published == null && (
                        <Badge tone="amber">Status unknown</Badge>
                      )}

                      {q.published !== true &&
                        (confirmingId === q.id ? (
                          <>
                            <Button
                              size="sm"
                              loading={publishingId === q.id}
                              onClick={() => handlePublish(q)}
                            >
                              Confirm publish
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={publishingId === q.id}
                              onClick={() => setConfirmingId(null)}
                            >
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={publishingId !== null}
                            onClick={() => setConfirmingId(q.id)}
                          >
                            Publish
                          </Button>
                        ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <p className="muted small">
              Publishing cannot be undone through the current backend API.
            </p>
          </section>

          {/* Backend features not currently implemented */}
          <section className="card unavailable">
            <h2>Not available</h2>

            <p className="muted small">
              These features are not currently supported by the backend:
            </p>

            <ul className="unavailable-list">
              {UNAVAILABLE.map((item) => (
                <li key={item}>
                  <Badge tone="gray">Unavailable</Badge> {item}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </>
  )
}