import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockBackend } from './mockBackend'
import * as api from '../services/api'

const mock = createMockBackend()
beforeAll(() => mock.start(18080))
afterAll(() => mock.stop())
beforeEach(() => {
  mock.reset()
  sessionStorage.clear()
  api.clearSession()
  api.setUnauthorizedHandler(null)
})

const b64 = (s) => Buffer.from(s).toString('base64')

describe('api service', () => {
  it('logs in without auth header, then sends HTTP Basic on later calls', async () => {
    const user = await api.loginUser({ email: 'student@test.com', password: 'studentpass' })
    expect(user).toEqual({ id: 2, name: 'Sam Student', email: 'student@test.com', role: 'STUDENT' })
    expect(mock.calls[0].auth).toBeNull() // login itself is unauthenticated

    await api.getMyAttempts(2)
    const call = mock.calls.at(-1)
    expect(call.path).toBe('/api/student/attempts')
    expect(call.query).toEqual({ studentId: '2' })
    expect(call.auth).toBe('Basic ' + b64('student@test.com:studentpass'))
    expect(call.xrw).toBe('XMLHttpRequest')
  })

  it('surfaces the backend {error} message on 400', async () => {
    await expect(api.loginUser({ email: 'student@test.com', password: 'nope' })).rejects.toMatchObject({
      status: 400,
      message: 'Invalid email or password',
    })
    await expect(api.registerUser({ name: 'X', email: 'student@test.com', password: 'abcdef' })).rejects.toMatchObject({
      message: 'Email already registered',
    })
  })

  it('maps 403 (wrong role) to a friendly message', async () => {
    await api.loginUser({ email: 'student@test.com', password: 'studentpass' })
    await expect(api.publishQuiz(1)).rejects.toMatchObject({ status: 403, message: 'You do not have permission to do that.' })
  })

  it('maps 401 and calls the unauthorized handler only when a session existed', async () => {
    const handler = vi.fn()
    api.setUnauthorizedHandler(handler)

    // no session: 401 but handler not triggered
    await expect(api.getMyAttempts(2)).rejects.toMatchObject({ status: 401 })
    expect(handler).not.toHaveBeenCalled()

    // session exists but credentials go stale
    await api.loginUser({ email: 'student@test.com', password: 'studentpass' })
    mock.db.users[1].password = 'changed'
    await expect(api.getMyAttempts(2)).rejects.toMatchObject({ status: 401 })
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('reports an unreachable server clearly', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await expect(api.getTodayQuiz()).rejects.toMatchObject({ status: 0, message: expect.stringContaining('Cannot reach the server') })
    spy.mockRestore()
  })

  it('submits answers as { questionId: letter } with studentId in the query string', async () => {
    await api.loginUser({ email: 'admin@test.com', password: 'adminpass' })
    const quiz = await api.createQuiz({ title: 'T', topic: 'P', quizDate: '2030-01-01', adminId: 1 })
    expect(mock.calls.at(-1).body).toEqual({ title: 'T', topic: 'P', quizDate: '2030-01-01', adminId: 1 })
    await api.addQuestion({ quizId: quiz.id, questionText: 'Q', optionA: 'a', optionB: 'b', optionC: 'c', optionD: 'd', correctOption: 'A' })
    await api.publishQuiz(quiz.id)

    api.clearSession()
    await api.loginUser({ email: 'student@test.com', password: 'studentpass' })
    const res = await api.submitQuiz(quiz.id, 2, { 1: 'A' })
    expect(res).toMatchObject({ score: 1, totalQuestions: 1 })
    const call = mock.calls.at(-1)
    expect(call.query).toEqual({ studentId: '2' })
    expect(call.body).toEqual({ 1: 'A' })

    // test retrieving attempt review
    const review = await api.getAttemptDetails(res.attemptId, 2)
    expect(review).toMatchObject({
      score: 1,
      totalQuestions: 1,
      hasDetailedReview: true,
    })
    expect(review.questions).toHaveLength(1)
    expect(review.questions[0]).toMatchObject({
      selectedOption: 'A',
      correctOption: 'A',
      correct: true,
    })
  })

  it('updates a quiz using PUT /api/admin/quizzes/{id}', async () => {
    await api.loginUser({ email: 'admin@test.com', password: 'adminpass' })
    const quiz = await api.createQuiz({ title: 'Initial Title', topic: 'Initial Topic', quizDate: '2030-02-01', adminId: 1 })

    const updated = await api.updateQuiz(quiz.id, {
      title: 'Updated Title',
      topic: 'Updated Topic',
      quizDate: '2030-02-02',
    })

    expect(updated).toMatchObject({
      message: 'Quiz updated successfully',
      id: quiz.id,
      title: 'Updated Title',
      topic: 'Updated Topic',
      quizDate: '2030-02-02',
    })

    const call = mock.calls.at(-1)
    expect(call.method).toBe('PUT')
    expect(call.path).toBe(`/api/admin/quizzes/${quiz.id}`)
    expect(call.body).toEqual({
      title: 'Updated Title',
      topic: 'Updated Topic',
      quizDate: '2030-02-02',
    })
  })

  it('deletes a quiz using DELETE /api/admin/quizzes/{id} and enforces safety rule on attempts', async () => {
    await api.loginUser({ email: 'admin@test.com', password: 'adminpass' })
    const quiz = await api.createQuiz({ title: 'Deletable Quiz', topic: 'Testing', quizDate: '2030-03-01', adminId: 1 })
    await api.addQuestion({ quizId: quiz.id, questionText: 'Q?', optionA: '1', optionB: '2', optionC: '3', optionD: '4', correctOption: 'A' })
    expect(mock.db.quizzes.some((q) => q.id === quiz.id)).toBe(true)
    expect(mock.db.questions.some((q) => q.quizId === quiz.id)).toBe(true)

    // Successful delete when no attempts exist
    const res = await api.deleteQuiz(quiz.id)
    expect(res).toMatchObject({ message: 'Quiz deleted successfully', quizId: quiz.id })
    expect(mock.db.quizzes.some((q) => q.id === quiz.id)).toBe(false)
    expect(mock.db.questions.some((q) => q.quizId === quiz.id)).toBe(false)

    // Cannot delete quiz when student attempts exist
    const quizWithAttempt = await api.createQuiz({ title: 'Quiz with Attempts', topic: 'Testing', quizDate: '2030-04-01', adminId: 1 })
    await api.addQuestion({ quizId: quizWithAttempt.id, questionText: 'Q2?', optionA: '1', optionB: '2', optionC: '3', optionD: '4', correctOption: 'A' })
    await api.publishQuiz(quizWithAttempt.id)

    api.clearSession()
    await api.loginUser({ email: 'student@test.com', password: 'studentpass' })
    await api.submitQuiz(quizWithAttempt.id, 2, { 2: 'A' })

    api.clearSession()
    await api.loginUser({ email: 'admin@test.com', password: 'adminpass' })
    await expect(api.deleteQuiz(quizWithAttempt.id)).rejects.toMatchObject({
      status: 400,
      message: 'Cannot delete quiz because students have submitted attempts',
    })
    expect(mock.db.quizzes.some((q) => q.id === quizWithAttempt.id)).toBe(true)
  })

  it('unpublishes a quiz using POST /api/admin/quizzes/{id}/unpublish', async () => {
    await api.loginUser({ email: 'admin@test.com', password: 'adminpass' })
    const quiz = await api.createQuiz({ title: 'Unpublishable Quiz', topic: 'Testing', quizDate: '2030-05-01', adminId: 1 })
    await api.addQuestion({ quizId: quiz.id, questionText: 'Q?', optionA: '1', optionB: '2', optionC: '3', optionD: '4', correctOption: 'A' })
    await api.publishQuiz(quiz.id)
    expect(mock.db.quizzes.find((q) => q.id === quiz.id).published).toBe(true)

    const res = await api.unpublishQuiz(quiz.id)
    expect(res).toMatchObject({ message: 'Quiz unpublished successfully', quizId: quiz.id })
    expect(mock.db.quizzes.find((q) => q.id === quiz.id).published).toBe(false)
  })

  it('manages questions: get, update, and delete with attempt guard', async () => {
    await api.loginUser({ email: 'admin@test.com', password: 'adminpass' })
    const quiz = await api.createQuiz({ title: 'Question Quiz', topic: 'Testing', quizDate: '2030-06-01', adminId: 1 })
    const q1 = await api.addQuestion({ quizId: quiz.id, questionText: 'Original text', optionA: '1', optionB: '2', optionC: '3', optionD: '4', correctOption: 'A' })

    // View questions
    const list = await api.getQuizQuestions(quiz.id)
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe(q1.id)

    const fetched = await api.getQuestion(q1.id)
    expect(fetched.questionText).toBe('Original text')

    // Update question
    const updated = await api.updateQuestion(q1.id, {
      quizId: quiz.id,
      questionText: 'Updated text',
      optionA: '10',
      optionB: '20',
      optionC: '30',
      optionD: '40',
      correctOption: 'B',
    })
    expect(updated).toMatchObject({
      message: 'Question updated successfully',
      question: expect.objectContaining({
        questionText: 'Updated text',
        correctOption: 'B',
      }),
    })

    // Delete question
    const delRes = await api.deleteQuestion(q1.id)
    expect(delRes).toMatchObject({ message: 'Question deleted successfully', questionId: q1.id })
    const remaining = await api.getQuizQuestions(quiz.id)
    expect(remaining).toHaveLength(0)
  })

  it('retrieves analytics and attempt details for admin', async () => {
    await api.loginUser({ email: 'admin@test.com', password: 'adminpass' })
    const analytics = await api.getAdminAnalytics()
    expect(analytics).toMatchObject({
      totalQuizzes: expect.any(Number),
      publishedQuizzes: expect.any(Number),
      draftQuizzes: expect.any(Number),
      totalAttempts: expect.any(Number),
    })

    const attempts = await api.getAdminAttempts()
    expect(Array.isArray(attempts)).toBe(true)
  })

  it('creates another admin account securely', async () => {
    await api.loginUser({ email: 'admin@test.com', password: 'adminpass' })
    const res = await api.createAdminAccount({
      name: 'Second Admin',
      email: 'admin2@test.com',
      password: 'newadminpass123',
    })
    expect(res).toMatchObject({
      message: 'Admin account created successfully',
      email: 'admin2@test.com',
      role: 'ADMIN',
    })
    expect(mock.db.users.some((u) => u.email === 'admin2@test.com' && u.role === 'ADMIN')).toBe(true)
  })

  it('archives and unarchives questions, excluding archived from student attempts', async () => {
    await api.loginUser({ email: 'admin@test.com', password: 'adminpass' })
    const todayStr = new Date().toISOString().slice(0, 10)
    const quiz = await api.createQuiz({ title: 'Daily Test', topic: 'Testing', quizDate: todayStr, adminId: 1 })
    const q1 = await api.addQuestion({ quizId: quiz.id, questionText: 'Q1 Active', optionA: '1', optionB: '2', optionC: '3', optionD: '4', correctOption: 'A' })
    const q2 = await api.addQuestion({ quizId: quiz.id, questionText: 'Q2 To Archive', optionA: 'A', optionB: 'B', optionC: 'C', optionD: 'D', correctOption: 'B' })
    await api.publishQuiz(quiz.id)

    // Archive q2
    const archRes = await api.archiveQuestion(q2.id)
    expect(archRes).toMatchObject({
      message: 'Question archived successfully',
      question: expect.objectContaining({ id: q2.id, archived: true }),
    })

    // Student takes quiz - only q1 should be present
    api.clearSession()
    await api.loginUser({ email: 'student@test.com', password: 'studentpass' })
    const studentQuiz = await api.getTodayQuiz()
    expect(studentQuiz.questions).toHaveLength(1)
    expect(studentQuiz.questions[0].id).toBe(q1.id)

    // Unarchive q2
    api.clearSession()
    await api.loginUser({ email: 'admin@test.com', password: 'adminpass' })
    const unarchRes = await api.unarchiveQuestion(q2.id)
    expect(unarchRes).toMatchObject({
      message: 'Question unarchived successfully',
      question: expect.objectContaining({ id: q2.id, archived: false }),
    })
  })

  it('blocks question deletion when student attempts exist', async () => {
    await api.loginUser({ email: 'admin@test.com', password: 'adminpass' })
    const todayStr = new Date().toISOString().slice(0, 10)
    const quiz = await api.createQuiz({ title: 'Attempted Quiz', topic: 'Testing', quizDate: todayStr, adminId: 1 })
    const q1 = await api.addQuestion({ quizId: quiz.id, questionText: 'Q With Attempt', optionA: '1', optionB: '2', optionC: '3', optionD: '4', correctOption: 'A' })
    await api.publishQuiz(quiz.id)

    // Student submits attempt
    api.clearSession()
    await api.loginUser({ email: 'student@test.com', password: 'studentpass' })
    await api.submitQuiz(quiz.id, 2, { [q1.id]: 'A' })

    // Admin tries to delete question -> should fail
    api.clearSession()
    await api.loginUser({ email: 'admin@test.com', password: 'adminpass' })
    await expect(api.deleteQuestion(q1.id)).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining('Cannot delete question because students have submitted attempts'),
    })

    // Archiving still succeeds and preserves attempt history
    const arch = await api.archiveQuestion(q1.id)
    expect(arch.question.archived).toBe(true)

    // Historical attempt review still works perfectly
    const review = await api.getAdminAttemptDetails(mock.db.attempts.at(-1).id)
    expect(review.hasDetailedReview).toBe(true)
    expect(review.questions[0].questionText).toBe('Q With Attempt')
  })
})


