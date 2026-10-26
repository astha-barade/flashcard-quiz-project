import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  addQuestion,
  createQuiz,
  publishQuiz,
  unpublishQuiz,
  getAdminQuizzes,
  updateQuiz,
  deleteQuiz,
  getQuizQuestions,
  updateQuestion,
  deleteQuestion,
  archiveQuestion,
  unarchiveQuestion,
  createAdminAccount,
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

export default function AdminDashboard() {
  const { user } = useAuth()

  const [quizzes, setQuizzes] = useState([])
  const [loadingQuizzes, setLoadingQuizzes] = useState(true)
  const [quizListError, setQuizListError] = useState('')

  const [banner, setBanner] = useState(null)

  // 1. Create quiz state
  const [quizForm, setQuizForm] = useState({
    title: '',
    topic: '',
    quizDate: todayISO(),
  })
  const [quizErrors, setQuizErrors] = useState({})
  const [quizApiError, setQuizApiError] = useState('')
  const [creating, setCreating] = useState(false)

  // 2. Add question state
  const [selectedQuizId, setSelectedQuizId] = useState('')
  const [qForm, setQForm] = useState(EMPTY_QUESTION)
  const [qErrors, setQErrors] = useState({})
  const [qApiError, setQApiError] = useState('')
  const [adding, setAdding] = useState(false)

  // Questions list for selected quiz
  const [quizQuestions, setQuizQuestions] = useState([])
  const [loadingQuestions, setLoadingQuestions] = useState(false)

  // Edit question modal state
  const [editingQuestion, setEditingQuestion] = useState(null)
  const [editQForm, setEditQForm] = useState(EMPTY_QUESTION)
  const [editQErrors, setEditQErrors] = useState({})
  const [editQApiError, setEditQApiError] = useState('')
  const [savingEditQ, setSavingEditQ] = useState(false)

  // Delete question modal state
  const [deletingQuestion, setDeletingQuestion] = useState(null)
  const [deleteQApiError, setDeleteQApiError] = useState('')
  const [deletingQ, setDeletingQ] = useState(false)
  const [archivingQ, setArchivingQ] = useState(false)

  // 3. Publish & Unpublish state
  const [confirmingId, setConfirmingId] = useState(null)
  const [publishingId, setPublishingId] = useState(null)
  const [confirmUnpublishId, setConfirmUnpublishId] = useState(null)
  const [unpublishingId, setUnpublishingId] = useState(null)

  // Edit quiz modal state
  const [editingQuiz, setEditingQuiz] = useState(null)
  const [editForm, setEditForm] = useState({ title: '', topic: '', quizDate: '' })
  const [editErrors, setEditErrors] = useState({})
  const [editApiError, setEditApiError] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  // Delete quiz modal state
  const [deletingQuiz, setDeletingQuiz] = useState(null)
  const [deleteApiError, setDeleteApiError] = useState('')
  const [deleting, setDeleting] = useState(false)

  // 4. Create admin state
  const [adminForm, setAdminForm] = useState({ name: '', email: '', password: '' })
  const [adminErrors, setAdminErrors] = useState({})
  const [adminApiError, setAdminApiError] = useState('')
  const [creatingAdmin, setCreatingAdmin] = useState(false)

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

      setSelectedQuizId((currentId) =>
        list.some((q) => String(q.id) === currentId)
          ? currentId
          : list.length > 0
          ? String(list[0].id)
          : ''
      )
    } catch (err) {
      setQuizListError(err.message || 'Could not load quizzes.')
    } finally {
      setLoadingQuizzes(false)
    }
  }, [])

  // Fetch questions for currently selected quiz
  const refreshQuestions = useCallback(async (quizId) => {
    if (!quizId) {
      setQuizQuestions([])
      return
    }
    setLoadingQuestions(true)
    try {
      const data = await getQuizQuestions(quizId)
      setQuizQuestions(Array.isArray(data) ? data : [])
    } catch {
      setQuizQuestions([])
    } finally {
      setLoadingQuestions(false)
    }
  }, [])

  useEffect(() => {
    refreshQuizzes()
  }, [refreshQuizzes])

  useEffect(() => {
    if (selectedQuizId) {
      refreshQuestions(selectedQuizId)
    } else {
      setQuizQuestions([])
    }
  }, [selectedQuizId, refreshQuestions])

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
    if (!qForm.questionText.trim()) errs.questionText = 'Question text is required.'
    ;['A', 'B', 'C', 'D'].forEach((letter) => {
      if (!qForm[`option${letter}`].trim()) {
        errs[`option${letter}`] = `Option ${letter} is required.`
      }
    })
    if (!qForm.correctOption) errs.correctOption = 'Select the correct option.'

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

      await refreshQuestions(selectedQuizId)
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

  // Edit question handlers
  function openEditQuestion(q) {
    setEditingQuestion(q)
    setEditQForm({
      questionText: q.questionText || '',
      optionA: q.optionA || '',
      optionB: q.optionB || '',
      optionC: q.optionC || '',
      optionD: q.optionD || '',
      correctOption: q.correctOption || '',
    })
    setEditQErrors({})
    setEditQApiError('')
  }

  function closeEditQuestion() {
    setEditingQuestion(null)
    setEditQErrors({})
    setEditQApiError('')
  }

  async function handleSaveEditQuestion(e) {
    e.preventDefault()
    setEditQApiError('')

    const errs = {}
    if (!editQForm.questionText.trim()) errs.questionText = 'Question text is required.'
    ;['A', 'B', 'C', 'D'].forEach((l) => {
      if (!editQForm[`option${l}`].trim()) errs[`option${l}`] = `Option ${l} is required.`
    })
    if (!editQForm.correctOption) errs.correctOption = 'Select the correct option.'

    setEditQErrors(errs)
    if (Object.keys(errs).length) return

    setSavingEditQ(true)
    try {
      await updateQuestion(editingQuestion.id, {
        questionText: editQForm.questionText.trim(),
        optionA: editQForm.optionA.trim(),
        optionB: editQForm.optionB.trim(),
        optionC: editQForm.optionC.trim(),
        optionD: editQForm.optionD.trim(),
        correctOption: editQForm.correctOption,
      })

      await refreshQuestions(selectedQuizId)
      await refreshQuizzes()
      closeEditQuestion()
      setBanner({
        type: 'success',
        text: `Question #${editingQuestion.id} updated successfully.`,
      })
    } catch (err) {
      setEditQApiError(err.message || 'Could not update question.')
    } finally {
      setSavingEditQ(false)
    }
  }

  // Delete question handlers
  function openDeleteQuestion(q) {
    setDeletingQuestion(q)
    setDeleteQApiError('')
  }

  function closeDeleteQuestion() {
    setDeletingQuestion(null)
    setDeleteQApiError('')
  }

  async function handleConfirmDeleteQuestion() {
    if (!deletingQuestion) return
    setDeleteQApiError('')
    setDeletingQ(true)

    try {
      await deleteQuestion(deletingQuestion.id)
      await refreshQuestions(selectedQuizId)
      await refreshQuizzes()
      const qId = deletingQuestion.id
      closeDeleteQuestion()
      setBanner({
        type: 'success',
        text: `Question #${qId} deleted successfully.`,
      })
    } catch (err) {
      setDeleteQApiError(err.message || 'Could not delete question.')
    } finally {
      setDeletingQ(false)
    }
  }

  async function handleArchiveQuestion(qToArchive = deletingQuestion) {
    if (!qToArchive) return
    setDeleteQApiError('')
    setArchivingQ(true)

    try {
      await archiveQuestion(qToArchive.id)
      await refreshQuestions(selectedQuizId)
      await refreshQuizzes()
      const qId = qToArchive.id
      closeDeleteQuestion()
      setBanner({
        type: 'success',
        text: `Question #${qId} has been archived. It will not appear in future quiz attempts while past student records are preserved.`,
      })
    } catch (err) {
      setDeleteQApiError(err.message || 'Could not archive question.')
    } finally {
      setArchivingQ(false)
    }
  }

  async function handleUnarchiveQuestion(qToUnarchive) {
    if (!qToUnarchive) return
    try {
      await unarchiveQuestion(qToUnarchive.id)
      await refreshQuestions(selectedQuizId)
      await refreshQuizzes()
      setBanner({
        type: 'success',
        text: `Question #${qToUnarchive.id} has been unarchived and returned to active questions.`,
      })
    } catch (err) {
      setBanner({
        type: 'error',
        text: `Could not unarchive question #${qToUnarchive.id}: ${err.message}`,
      })
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

  // Unpublish quiz
  async function handleUnpublish(quiz) {
    setBanner(null)
    setUnpublishingId(quiz.id)

    try {
      await unpublishQuiz(quiz.id)
      await refreshQuizzes()

      setBanner({
        type: 'success',
        text: `"${quiz.title}" has been unpublished and returned to Draft mode.`,
      })
    } catch (err) {
      setBanner({
        type: 'error',
        text: `Could not unpublish "${quiz.title}": ${err.message}`,
      })
    } finally {
      setUnpublishingId(null)
      setConfirmUnpublishId(null)
    }
  }

  // Edit quiz handlers
  function openEdit(quiz) {
    setEditingQuiz(quiz)
    setEditForm({
      title: quiz.title || '',
      topic: quiz.topic || '',
      quizDate: quiz.quizDate || '',
    })
    setEditErrors({})
    setEditApiError('')
  }

  function closeEdit() {
    setEditingQuiz(null)
    setEditErrors({})
    setEditApiError('')
  }

  async function handleSaveEdit(e) {
    e.preventDefault()
    setEditApiError('')

    const errs = {}
    if (!editForm.title.trim()) errs.title = 'Title is required.'
    if (!editForm.topic.trim()) errs.topic = 'Topic is required.'
    if (!editForm.quizDate) errs.quizDate = 'Pick the date this quiz is for.'

    setEditErrors(errs)
    if (Object.keys(errs).length) return

    setSavingEdit(true)
    try {
      const res = await updateQuiz(editingQuiz.id, {
        title: editForm.title.trim(),
        topic: editForm.topic.trim(),
        quizDate: editForm.quizDate,
      })

      await refreshQuizzes()
      closeEdit()
      setBanner({
        type: 'success',
        text: `Quiz "${res?.title || editForm.title.trim()}" (ID ${editingQuiz.id}) updated successfully.`,
      })
    } catch (err) {
      setEditApiError(err.message || 'Could not update the quiz.')
    } finally {
      setSavingEdit(false)
    }
  }

  // Delete quiz handlers
  function openDelete(quiz) {
    setDeletingQuiz(quiz)
    setDeleteApiError('')
  }

  function closeDelete() {
    setDeletingQuiz(null)
    setDeleteApiError('')
  }

  async function handleConfirmDelete() {
    if (!deletingQuiz) return
    setDeleteApiError('')
    setDeleting(true)

    try {
      await deleteQuiz(deletingQuiz.id)
      await refreshQuizzes()
      const deletedTitle = deletingQuiz.title
      const deletedId = deletingQuiz.id
      closeDelete()
      setBanner({
        type: 'success',
        text: `Quiz "${deletedTitle}" (ID ${deletedId}) deleted successfully.`,
      })
    } catch (err) {
      setDeleteApiError(err.message || 'Could not delete the quiz.')
    } finally {
      setDeleting(false)
    }
  }

  // 4. Create admin handler
  async function handleCreateAdmin(e) {
    e.preventDefault()
    setAdminApiError('')
    setBanner(null)

    const errs = {}
    if (!adminForm.name.trim()) errs.name = 'Name is required.'
    if (!adminForm.email.trim()) errs.email = 'Email is required.'
    if (!adminForm.password || adminForm.password.length < 6) {
      errs.password = 'Password must be at least 6 characters.'
    }

    setAdminErrors(errs)
    if (Object.keys(errs).length) return

    setCreatingAdmin(true)
    try {
      const res = await createAdminAccount({
        name: adminForm.name.trim(),
        email: adminForm.email.trim().toLowerCase(),
        password: adminForm.password,
      })

      setAdminForm({ name: '', email: '', password: '' })
      setAdminErrors({})
      setBanner({
        type: 'success',
        text: `Admin account for "${res.name}" (${res.email}) created successfully.`,
      })
    } catch (err) {
      setAdminApiError(err.message || 'Could not create admin account.')
    } finally {
      setCreatingAdmin(false)
    }
  }

  const setQ = (field) => (e) => {
    setQForm((form) => ({
      ...form,
      [field]: e.target.value,
    }))
  }

  const setEditQ = (field) => (e) => {
    setEditQForm((form) => ({
      ...form,
      [field]: e.target.value,
    }))
  }

  const selectedQuiz = quizzes.find((q) => String(q.id) === String(selectedQuizId))

  return (
    <>
      <PageHeader
        title="Admin dashboard"
        subtitle="Create quizzes, manage questions, publish to students, and manage admin users."
      />

      <ol className="steps">
        <li><span>1</span> Create quiz</li>
        <li><span>2</span> Manage questions</li>
        <li><span>3</span> Publish & Manage</li>
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
                className={`radio-row ${qErrors.correctOption ? 'field-error' : ''}`}
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

          {/* Existing questions in selected quiz */}
          {selectedQuizId && (
            <section className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <h2 style={{ margin: 0 }}>Questions in Quiz #{selectedQuizId}</h2>
                  <span className="muted small">
                    {selectedQuiz?.title ? `"${selectedQuiz.title}" · ` : ''}
                    {quizQuestions.length} question{quizQuestions.length === 1 ? '' : 's'}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => refreshQuestions(selectedQuizId)}
                  loading={loadingQuestions}
                >
                  Refresh
                </Button>
              </div>

              {loadingQuestions ? (
                <p className="muted small">Loading questions…</p>
              ) : quizQuestions.length === 0 ? (
                <EmptyState icon="❓" title="No questions yet">
                  Add questions using the form above.
                </EmptyState>
              ) : (
                <ul className="quiz-list">
                  {quizQuestions.map((q, idx) => (
                    <li key={q.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <strong>#{idx + 1}. {q.questionText}</strong>
                          {q.archived && <Badge tone="amber">Archived</Badge>}
                        </div>
                        <div className="quiz-list-actions">
                          <Button size="sm" variant="secondary" onClick={() => openEditQuestion(q)}>
                            Edit
                          </Button>
                          {!q.archived ? (
                            <Button size="sm" variant="ghost" onClick={() => handleArchiveQuestion(q)}>
                              Archive
                            </Button>
                          ) : (
                            <Button size="sm" variant="ghost" onClick={() => handleUnarchiveQuestion(q)}>
                              Unarchive
                            </Button>
                          )}
                          <Button size="sm" variant="danger" onClick={() => openDeleteQuestion(q)}>
                            Delete
                          </Button>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.4rem', fontSize: '0.85rem' }}>
                        {['A', 'B', 'C', 'D'].map((l) => (
                          <div
                            key={l}
                            style={{
                              padding: '0.3rem 0.5rem',
                              borderRadius: '4px',
                              background: q.correctOption === l ? 'var(--blue-50, #eff6ff)' : '#f8fafc',
                              border: q.correctOption === l ? '1px solid var(--primary, #2563eb)' : '1px solid var(--border, #e2e8f0)',
                              display: 'flex',
                              justifyContent: 'space-between',
                            }}
                          >
                            <span><strong>{l}:</strong> {q[`option${l}`]}</span>
                            {q.correctOption === l && <Badge tone="green">Correct</Badge>}
                          </div>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>

        <div className="admin-col">
          {/* 3. Publish and list database quizzes */}
          <section className="card">
            <h2>3 · Quizzes & Publishing</h2>

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

                      {/* Publish button for drafts */}
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

                      {/* Unpublish button for published quizzes */}
                      {q.published === true &&
                        (confirmUnpublishId === q.id ? (
                          <>
                            <Button
                              size="sm"
                              variant="secondary"
                              loading={unpublishingId === q.id}
                              onClick={() => handleUnpublish(q)}
                            >
                              Confirm unpublish
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={unpublishingId === q.id}
                              onClick={() => setConfirmUnpublishId(null)}
                            >
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={unpublishingId !== null}
                            onClick={() => setConfirmUnpublishId(q.id)}
                          >
                            Unpublish
                          </Button>
                        ))}

                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => openEdit(q)}
                      >
                        Edit
                      </Button>

                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => openDelete(q)}
                      >
                        Delete
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <p className="muted small">
              You can unpublish a quiz at any time to return it to draft mode.
            </p>
          </section>

          {/* 4. Create other admin accounts */}
          <section className="card">
            <h2>4 · Create another admin account</h2>
            <p className="muted small">
              Register an additional administrator with administrative privileges.
            </p>

            {adminApiError && <Alert type="error">{adminApiError}</Alert>}

            <form onSubmit={handleCreateAdmin} noValidate>
              <FormField
                label="Full name"
                value={adminForm.name}
                onChange={(e) =>
                  setAdminForm((f) => ({ ...f, name: e.target.value }))
                }
                error={adminErrors.name}
              />

              <FormField
                label="Email address"
                type="email"
                value={adminForm.email}
                onChange={(e) =>
                  setAdminForm((f) => ({ ...f, email: e.target.value }))
                }
                error={adminErrors.email}
              />

              <FormField
                label="Password"
                type="password"
                value={adminForm.password}
                onChange={(e) =>
                  setAdminForm((f) => ({ ...f, password: e.target.value }))
                }
                error={adminErrors.password}
                hint="Must be at least 6 characters."
              />

              <Button type="submit" loading={creatingAdmin}>
                Create admin account
              </Button>
            </form>
          </section>
        </div>
      </div>

      {/* Edit Quiz Modal */}
      {editingQuiz && (
        <div
          className="modal-backdrop"
          onClick={closeEdit}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-edit-title"
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '540px' }}
          >
            <div className="modal-header">
              <div>
                <h2 id="modal-edit-title" style={{ margin: 0 }}>
                  Edit quiz
                </h2>
                <span className="muted small">Quiz #{editingQuiz.id}</span>
              </div>
              <button
                className="modal-close"
                onClick={closeEdit}
                aria-label="Close edit dialog"
                disabled={savingEdit}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} noValidate>
              <div className="modal-body">
                {editApiError && <Alert type="error">{editApiError}</Alert>}

                <FormField
                  label="Title"
                  value={editForm.title}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, title: e.target.value }))
                  }
                  error={editErrors.title}
                />

                <FormField
                  label="Topic"
                  value={editForm.topic}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, topic: e.target.value }))
                  }
                  error={editErrors.topic}
                />

                <FormField
                  label="Quiz date"
                  type="date"
                  value={editForm.quizDate}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, quizDate: e.target.value }))
                  }
                  error={editErrors.quizDate}
                  hint="The backend allows only one quiz per date."
                />
              </div>

              <div className="modal-footer" style={{ gap: '0.75rem' }}>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={closeEdit}
                  disabled={savingEdit}
                >
                  Cancel
                </Button>
                <Button type="submit" loading={savingEdit}>
                  Save changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Quiz Confirmation Dialog */}
      {deletingQuiz && (
        <div
          className="modal-backdrop"
          onClick={() => !deleting && closeDelete()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-delete-title"
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '500px' }}
          >
            <div className="modal-header">
              <div>
                <h2 id="modal-delete-title" style={{ margin: 0, color: 'var(--red, #e11d48)' }}>
                  Delete quiz
                </h2>
                <span className="muted small">Quiz #{deletingQuiz.id}</span>
              </div>
              <button
                className="modal-close"
                onClick={closeDelete}
                aria-label="Close delete dialog"
                disabled={deleting}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              {deleteApiError && <Alert type="error">{deleteApiError}</Alert>}

              <p style={{ margin: '0 0 0.75rem' }}>
                Are you sure you want to delete <strong>"{deletingQuiz.title}"</strong> (ID #{deletingQuiz.id})?
              </p>

              <p className="muted small" style={{ margin: 0 }}>
                This will permanently delete the quiz and all of its questions. Quizzes with submitted student attempts cannot be deleted.
              </p>
            </div>

            <div className="modal-footer" style={{ gap: '0.75rem' }}>
              <Button
                type="button"
                variant="ghost"
                onClick={closeDelete}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                loading={deleting}
                onClick={handleConfirmDelete}
              >
                Confirm delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Question Modal */}
      {editingQuestion && (
        <div
          className="modal-backdrop"
          onClick={closeEditQuestion}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-edit-q-title"
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '580px' }}
          >
            <div className="modal-header">
              <div>
                <h2 id="modal-edit-q-title" style={{ margin: 0 }}>
                  Edit Question
                </h2>
                <span className="muted small">Question #{editingQuestion.id}</span>
              </div>
              <button
                className="modal-close"
                onClick={closeEditQuestion}
                aria-label="Close edit question dialog"
                disabled={savingEditQ}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditQuestion} noValidate>
              <div className="modal-body">
                {editQApiError && <Alert type="error">{editQApiError}</Alert>}

                <FormField
                  as="textarea"
                  rows={3}
                  label="Question text"
                  value={editQForm.questionText}
                  onChange={setEditQ('questionText')}
                  error={editQErrors.questionText}
                />

                <div className="two-col">
                  {['A', 'B', 'C', 'D'].map((letter) => (
                    <FormField
                      key={letter}
                      label={`Option ${letter}`}
                      value={editQForm[`option${letter}`]}
                      onChange={setEditQ(`option${letter}`)}
                      error={editQErrors[`option${letter}`]}
                    />
                  ))}
                </div>

                <fieldset
                  className={`radio-row ${editQErrors.correctOption ? 'field-error' : ''}`}
                >
                  <legend>Correct option</legend>
                  {['A', 'B', 'C', 'D'].map((letter) => (
                    <label
                      key={letter}
                      className={editQForm.correctOption === letter ? 'selected' : ''}
                    >
                      <input
                        type="radio"
                        name="editCorrectOption"
                        value={letter}
                        checked={editQForm.correctOption === letter}
                        onChange={setEditQ('correctOption')}
                      />
                      {letter}
                    </label>
                  ))}
                  {editQErrors.correctOption && (
                    <small className="field-message">{editQErrors.correctOption}</small>
                  )}
                </fieldset>
              </div>

              <div className="modal-footer" style={{ gap: '0.75rem' }}>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={closeEditQuestion}
                  disabled={savingEditQ}
                >
                  Cancel
                </Button>
                <Button type="submit" loading={savingEditQ}>
                  Save changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Question Confirmation Dialog */}
      {deletingQuestion && (
        <div
          className="modal-backdrop"
          onClick={() => !deletingQ && !archivingQ && closeDeleteQuestion()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-delete-q-title"
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '520px' }}
          >
            <div className="modal-header">
              <div>
                <h2 id="modal-delete-q-title" style={{ margin: 0, color: 'var(--red, #e11d48)' }}>
                  Delete Question
                </h2>
                <span className="muted small">Question #{deletingQuestion.id} · Quiz #{selectedQuizId}</span>
              </div>
              <button
                className="modal-close"
                onClick={closeDeleteQuestion}
                aria-label="Close delete question dialog"
                disabled={deletingQ || archivingQ}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              {deleteQApiError && <Alert type="error">{deleteQApiError}</Alert>}

              {(() => {
                const quizHasAttempts = Boolean(
                  deletingQuestion.hasAttempts ||
                  selectedQuiz?.hasAttempts ||
                  (deleteQApiError && deleteQApiError.toLowerCase().includes('attempts'))
                )

                if (quizHasAttempts) {
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <Alert type="warning">
                        <strong>Permanent deletion blocked:</strong> Students have already submitted attempts for this quiz. Deleting this question would invalidate historical student attempts, answers, and scores.
                      </Alert>

                      <p style={{ margin: 0 }}>
                        Instead of permanent deletion, you can <strong>Archive Question</strong>. Archived questions are immediately excluded from future quiz attempts while preserving all existing student attempts, scores, and review history.
                      </p>

                      <div style={{ padding: '0.75rem', background: 'var(--surface-muted, #f8fafc)', borderRadius: '6px', border: '1px solid var(--border, #e2e8f0)' }}>
                        <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                          Question #{deletingQuestion.id}
                          {deletingQuestion.archived && <Badge tone="amber">Currently Archived</Badge>}
                        </div>
                        <div className="muted" style={{ fontStyle: 'italic', fontSize: '0.9rem' }}>
                          "{deletingQuestion.questionText}"
                        </div>
                      </div>
                    </div>
                  )
                }

                return (
                  <div>
                    <p style={{ margin: '0 0 0.75rem' }}>
                      Are you sure you want to delete question <strong>#{deletingQuestion.id}</strong>:
                    </p>
                    <p className="muted" style={{ fontStyle: 'italic', margin: '0 0 0.75rem' }}>
                      "{deletingQuestion.questionText}"
                    </p>

                    <p className="muted small" style={{ margin: 0 }}>
                      This action cannot be undone. Questions in quizzes that have student attempts cannot be deleted.
                    </p>
                  </div>
                )
              })()}
            </div>

            <div className="modal-footer" style={{ gap: '0.75rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <Button
                type="button"
                variant="ghost"
                onClick={closeDeleteQuestion}
                disabled={deletingQ || archivingQ}
              >
                Cancel
              </Button>

              {(() => {
                const quizHasAttempts = Boolean(
                  deletingQuestion.hasAttempts ||
                  selectedQuiz?.hasAttempts ||
                  (deleteQApiError && deleteQApiError.toLowerCase().includes('attempts'))
                )

                if (quizHasAttempts) {
                  return (
                    <>
                      <Button
                        type="button"
                        variant="danger"
                        disabled={true}
                        title="Permanent deletion is blocked because students have submitted attempts for this quiz."
                      >
                        Confirm delete
                      </Button>
                      {!deletingQuestion.archived ? (
                        <Button
                          type="button"
                          variant="primary"
                          loading={archivingQ}
                          onClick={() => handleArchiveQuestion(deletingQuestion)}
                        >
                          Archive Question
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => {
                            handleUnarchiveQuestion(deletingQuestion)
                            closeDeleteQuestion()
                          }}
                        >
                          Unarchive Question
                        </Button>
                      )}
                    </>
                  )
                }

                return (
                  <Button
                    type="button"
                    variant="danger"
                    loading={deletingQ}
                    onClick={handleConfirmDeleteQuestion}
                  >
                    Confirm delete
                  </Button>
                )
              })()}
            </div>
          </div>
        </div>
      )}
    </>
  )
}