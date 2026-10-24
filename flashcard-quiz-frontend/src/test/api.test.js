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
})

