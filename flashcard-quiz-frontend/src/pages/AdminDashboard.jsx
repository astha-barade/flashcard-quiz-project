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
  createAdminAccount,
  getAdminAnalytics,
  generateAiQuestions,
} from '../services/api'
import { formatDate, todayISO } from '../utils/format'
import { Link } from 'react-router-dom'
import Alert from '../components/Alert'
import Badge from '../components/Badge'
import Button from '../components/Button'
import EmptyState from '../components/EmptyState'
import FormField from '../components/FormField'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import {
  IconLayers,
  IconBook,
  IconPlus,
  IconBarChart,
  IconUser,
  IconShield,
  IconEdit,
  IconTrash,
  IconSearch,
  IconClock,
  IconSparkles,
} from '../components/Icons'

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
  const [analytics, setAnalytics] = useState(null)
  const [quizSearch, setQuizSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')

  // 5. Grok AI Generator state
  const [aiTopic, setAiTopic] = useState('')
  const [aiTargetQuizId, setAiTargetQuizId] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState(null)
  const [aiSuccess, setAiSuccess] = useState(null)
  const [aiGeneratedQuestions, setAiGeneratedQuestions] = useState([])
  const [isAiModalOpen, setIsAiModalOpen] = useState(false)
  const [aiSaving, setAiSaving] = useState(false)

  // Fetch quizzes and platform analytics from the backend database.
  const refreshQuizzes = useCallback(async () => {
    setLoadingQuizzes(true)
    setQuizListError('')

    try {
      const [quizzesRes, analyticsRes] = await Promise.allSettled([
        getAdminQuizzes(),
        getAdminAnalytics(),
      ])

      if (quizzesRes.status === 'fulfilled') {
        const data = quizzesRes.value
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
      } else {
        throw quizzesRes.reason
      }

      if (analyticsRes.status === 'fulfilled' && analyticsRes.value) {
        setAnalytics(analyticsRes.value)
      }
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
        text: `Question ${editingQuestion.id} updated successfully.`,
      })
    } catch (err) {
      setEditQApiError(err.message || 'Could not update question.')
    } finally {
      setSavingEditQ(false)
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

  // AI Quiz Generator Handlers
  async function handleGenerateAi(e) {
    e?.preventDefault()
    if (!aiTopic.trim()) {
      setAiError('Please enter a topic to generate questions.')
      return
    }
    setAiLoading(true)
    setAiError(null)
    setAiSuccess(null)
    try {
      const res = await generateAiQuestions(aiTopic.trim())
      if (res?.questions && res.questions.length > 0) {
        setAiGeneratedQuestions(res.questions)
        setIsAiModalOpen(true)
        if (!aiTargetQuizId && quizzes.length > 0) {
          setAiTargetQuizId(selectedQuizId || String(quizzes[0].id))
        }
      } else {
        setAiError('No questions were returned by the AI model. Please try again.')
      }
    } catch (err) {
      setAiError(err.message || 'Failed to generate questions with AI.')
    } finally {
      setAiLoading(false)
    }
  }

  function handleEditAiQuestion(index, field, value) {
    setAiGeneratedQuestions((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  function handleRemoveAiQuestion(index) {
    setAiGeneratedQuestions((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSaveAiQuestions() {
    const targetId = Number(aiTargetQuizId || selectedQuizId)
    if (!targetId || targetId <= 0) {
      setAiError('Please select a valid quiz to attach these questions to.')
      return
    }
    if (aiGeneratedQuestions.length === 0) {
      setAiError('No questions available to save.')
      return
    }
    setAiSaving(true)
    setAiError(null)
    try {
      let saved = 0
      for (const q of aiGeneratedQuestions) {
        await addQuestion({
          quizId: targetId,
          questionText: q.questionText,
          optionA: q.optionA,
          optionB: q.optionB,
          optionC: q.optionC,
          optionD: q.optionD,
          correctOption: q.correctOption || q.correctAnswer || 'A',
        })
        saved++
      }
      setAiSuccess(`Successfully saved ${saved} reviewed questions to Quiz ${targetId}!`)
      setIsAiModalOpen(false)
      setAiGeneratedQuestions([])
      setAiTopic('')
      await refreshQuizzes()
      if (selectedQuizId === String(targetId)) {
        await refreshQuestions(selectedQuizId)
      }
    } catch (err) {
      setAiError('Error while saving questions: ' + (err.message || 'Unknown error'))
    } finally {
      setAiSaving(false)
    }
  }

  const selectedQuiz = quizzes.find((q) => String(q.id) === String(selectedQuizId))

  return (
    <>
      <PageHeader
        title="Admin dashboard"
        subtitle="Create quizzes, manage questions, publish to students, and manage admin users."
      />

      {/* KPI Platform Summary Cards */}
      <div className="stat-grid" style={{ marginBottom: '1.5rem' }}>
        <StatCard
          label="Total Quizzes"
          value={analytics?.totalQuizzes ?? quizzes.length}
          hint={`${analytics?.publishedQuizzes ?? quizzes.filter((q) => q.published).length} published · ${analytics?.draftQuizzes ?? quizzes.filter((q) => !q.published).length} draft`}
        />
        <StatCard
          label="Total Attempts"
          value={analytics?.totalAttempts ?? 0}
          hint={`${analytics?.uniqueStudents ?? 0} unique student${(analytics?.uniqueStudents ?? 0) === 1 ? '' : 's'}`}
        />
        <StatCard
          label="Average Accuracy"
          value={`${analytics?.averagePercentage ?? 0}%`}
          hint="Overall platform score accuracy"
        />
        <StatCard
          label="Student Analytics"
          value="Results →"
          hint={
            <Link to="/admin/analytics" style={{ fontWeight: 600, color: 'var(--blue-600)' }}>
              Open Attempt Logs
            </Link>
          }
        />
      </div>

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
                    {q.id} · {q.title}
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

          {/* 3. AI Quiz Generator (Grok AI) */}
          <section className="card" style={{ borderLeft: '4px solid var(--primary, #2563eb)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <IconSparkles size={20} style={{ color: 'var(--primary, #2563eb)' }} />
              <h2 style={{ margin: 0 }}>3 · AI Quiz Generator (Grok)</h2>
            </div>
            <p className="muted small">
              Generate exactly 10 multiple-choice questions on any topic using Grok AI. You can review, edit, and adjust questions before saving them.
            </p>

            {aiError && <Alert type="error">{aiError}</Alert>}
            {aiSuccess && <Alert type="success">{aiSuccess}</Alert>}

            <form onSubmit={handleGenerateAi} noValidate>
              <FormField
                label="Quiz Topic"
                placeholder="e.g. Java Concurrency & Threads, World Geography, React Hooks"
                value={aiTopic}
                onChange={(e) => setAiTopic(e.target.value)}
                hint="Grok AI will generate 10 comprehensive MCQs with 4 options and explanations."
              />

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '0.5rem' }}>
                <Button
                  type="submit"
                  loading={aiLoading}
                  disabled={aiLoading}
                >
                  <IconSparkles size={16} /> Generate 10 questions with AI
                </Button>

                {aiGeneratedQuestions.length > 0 && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setIsAiModalOpen(true)}
                  >
                    Review generated questions ({aiGeneratedQuestions.length})
                  </Button>
                )}
              </div>
            </form>
          </section>

          {/* Existing questions in selected quiz */}
          {selectedQuizId && (
            <section className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <h2 style={{ margin: 0 }}>Questions in Quiz {selectedQuizId}</h2>
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
                          <strong>{idx + 1}. {q.questionText}</strong>

                        </div>
                        <div className="quiz-list-actions">
                          <Button size="sm" variant="secondary" onClick={() => openEditQuestion(q)}>
                            Edit
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
                              alignItems: 'center',
                            }}
                          >
                            <span><strong>{l}:</strong> {q[`option${l}`]}</span>
                            {q.correctOption === l && (
                              <Badge
                                tone="green"
                                className="badge-correct"
                                style={{ borderRadius: '6px' }}
                              >
                                Correct
                              </Badge>
                            )}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div>
                <h2 style={{ margin: 0 }}>3 · Quizzes & Publishing</h2>
                <p className="muted small" style={{ margin: '0.2rem 0 0' }}>
                  Quizzes below are loaded from the backend database.
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={refreshQuizzes}
                loading={loadingQuizzes}
              >
                Refresh quizzes
              </Button>
            </div>

            {/* Search and status filter */}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', margin: '0.75rem 0 1rem' }}>
              <input
                type="search"
                placeholder="Search quiz title or topic…"
                value={quizSearch}
                onChange={(e) => setQuizSearch(e.target.value)}
                style={{ flex: 1, minWidth: '180px', padding: '0.45rem 0.75rem', fontSize: '0.88rem' }}
              />
              <div style={{ display: 'flex', gap: '0.3rem' }}>
                {['ALL', 'PUBLISHED', 'DRAFT'].map((filterKey) => (
                  <button
                    key={filterKey}
                    type="button"
                    onClick={() => setStatusFilter(filterKey)}
                    style={{
                      padding: '0.35rem 0.65rem',
                      borderRadius: '6px',
                      border: statusFilter === filterKey ? '1px solid var(--blue-500)' : '1px solid var(--border)',
                      background: statusFilter === filterKey ? 'var(--blue-50)' : 'var(--surface)',
                      color: statusFilter === filterKey ? 'var(--blue-600)' : 'var(--muted)',
                      fontWeight: 600,
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                    }}
                  >
                    {filterKey === 'ALL' ? 'All Quizzes' : filterKey === 'PUBLISHED' ? 'Published Only' : 'Drafts'}
                  </button>
                ))}
              </div>
            </div>

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
                {quizzes
                  .filter((q) => {
                    if (statusFilter === 'PUBLISHED' && !q.published) return false
                    if (statusFilter === 'DRAFT' && q.published) return false
                    if (!quizSearch.trim()) return true
                    const query = quizSearch.toLowerCase().trim()
                    return (
                      (q.title && q.title.toLowerCase().includes(query)) ||
                      (q.topic && q.topic.toLowerCase().includes(query)) ||
                      String(q.id).includes(query)
                    )
                  })
                  .map((q) => (
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
                <span className="muted small">Quiz {editingQuiz.id}</span>
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
                <span className="muted small">Quiz {deletingQuiz.id}</span>
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
                Are you sure you want to delete <strong>"{deletingQuiz.title}"</strong> (ID {deletingQuiz.id})?
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
                <span className="muted small">Question {editingQuestion.id}</span>
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


      {/* AI Generated Questions Review Modal */}
      {isAiModalOpen && (
        <div className="modal-backdrop" onClick={() => !aiSaving && setIsAiModalOpen(false)}>
          <div
            className="modal-card modal-card-lg"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto' }}
          >
            <div className="modal-header">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <IconSparkles size={20} style={{ color: 'var(--primary, #2563eb)' }} />
                  <h3 style={{ margin: 0 }}>Review & Edit AI Generated Questions</h3>
                </div>
                <p className="muted small" style={{ margin: '0.25rem 0 0 0' }}>
                  Review each question and its answer options below. You can edit any field before saving to your quiz.
                </p>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => !aiSaving && setIsAiModalOpen(false)}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {aiError && <Alert type="error">{aiError}</Alert>}

              <FormField
                as="select"
                label="Target Quiz to save into"
                value={aiTargetQuizId || selectedQuizId}
                onChange={(e) => setAiTargetQuizId(e.target.value)}
                hint="Choose which quiz will receive these 10 reviewed questions."
              >
                <option value="">Select a target quiz…</option>
                {quizzes.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.id} · {q.title} ({q.questionsAdded} existing questions)
                  </option>
                ))}
              </FormField>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
                {aiGeneratedQuestions.map((q, idx) => (
                  <div
                    key={idx}
                    style={{
                      border: '1px solid var(--border, #e2e8f0)',
                      borderRadius: '0.5rem',
                      padding: '1rem',
                      background: 'var(--card-bg, #fff)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--primary, #2563eb)' }}>
                        Question {idx + 1} of {aiGeneratedQuestions.length}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveAiQuestion(idx)}
                        style={{ color: 'var(--danger, #dc2626)' }}
                      >
                        <IconTrash size={14} /> Remove
                      </Button>
                    </div>

                    <FormField
                      as="textarea"
                      rows={2}
                      label="Question prompt"
                      value={q.questionText}
                      onChange={(e) => handleEditAiQuestion(idx, 'questionText', e.target.value)}
                    />

                    <div className="two-col" style={{ marginTop: '0.5rem' }}>
                      {['A', 'B', 'C', 'D'].map((letter) => (
                        <FormField
                          key={letter}
                          label={`Option ${letter}`}
                          value={q[`option${letter}`] || ''}
                          onChange={(e) => handleEditAiQuestion(idx, `option${letter}`, e.target.value)}
                        />
                      ))}
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                      <div style={{ minWidth: '160px' }}>
                        <FormField
                          as="select"
                          label="Correct Option"
                          value={q.correctOption || q.correctAnswer || 'A'}
                          onChange={(e) => handleEditAiQuestion(idx, 'correctOption', e.target.value)}
                        >
                          <option value="A">Option A</option>
                          <option value="B">Option B</option>
                          <option value="C">Option C</option>
                          <option value="D">Option D</option>
                        </FormField>
                      </div>

                      <div style={{ flex: 1, minWidth: '220px' }}>
                        <FormField
                          label="Explanation (optional)"
                          value={q.explanation || ''}
                          onChange={(e) => handleEditAiQuestion(idx, 'explanation', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-footer" style={{ gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsAiModalOpen(false)}
                disabled={aiSaving}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                loading={aiSaving}
                onClick={handleSaveAiQuestions}
                disabled={aiGeneratedQuestions.length === 0}
              >
                Save {aiGeneratedQuestions.length} Reviewed Questions to Quiz
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}