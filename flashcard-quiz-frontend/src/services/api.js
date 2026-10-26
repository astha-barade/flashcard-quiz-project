// =====================================================================
// services/api.js  —  the ONLY place that talks to the backend.
// Every page imports functions from here instead of calling fetch().
//
// The backend uses HTTP Basic authentication (no tokens). After login we
// keep an "Authorization: Basic ..." value and send it with every request.
// =====================================================================

const RAW_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''
// In dev we can route through Vite's proxy (relative URLs) to avoid CORS.
const USE_DEV_PROXY =
  import.meta.env.DEV && import.meta.env.VITE_USE_DEV_PROXY === 'true'

export const API_BASE_URL = USE_DEV_PROXY ? '' : RAW_BASE_URL.replace(/\/$/, '')

// ---------- session (kept in sessionStorage: cleared when the tab closes) ----------
const SESSION_KEY = 'fq_session'

export function loadSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveSession(session) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY)
  authHeader = null
}

// Basic auth header value. encodeURIComponent/unescape keeps non-ASCII safe.
function makeBasicHeader(email, password) {
  return 'Basic ' + btoa(unescape(encodeURIComponent(`${email}:${password}`)))
}

let authHeader = loadSession()?.authHeader || null
let onUnauthorized = null

/** AuthContext registers a function here that runs when the backend says 401. */
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn
}

// ---------- errors ----------
export class ApiError extends Error {
  constructor(message, status = 0, data = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

function defaultMessage(status) {
  if (status === 401) return 'Your session is invalid or has expired. Please log in again.'
  if (status === 403) return 'You do not have permission to do that.'
  if (status === 404) return 'The requested resource was not found.'
  if (status >= 500) return 'The server had a problem. Please try again.'
  return `Request failed (HTTP ${status}).`
}

// ---------- core request helper ----------
async function request(path, { method = 'GET', body, query, auth = true } = {}) {
  let url = `${API_BASE_URL}${path}`
  if (query) {
    const qs = new URLSearchParams(query).toString()
    url += `?${qs}`
  }

  const headers = {
    Accept: 'application/json',
    // Tells Spring Security to answer 401 without the browser's login popup.
    'X-Requested-With': 'XMLHttpRequest',
  }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (auth && authHeader) headers.Authorization = authHeader

  let response
  try {
    response = await fetch(url, {
      method,
      headers,
      credentials: 'omit',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(
      'Cannot reach the server. Check that the backend is running and VITE_API_BASE_URL is correct.',
      0,
    )
  }

  // Backend replies are JSON, but errors from Spring Security can be empty.
  const text = await response.text()
  let data = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }

  if (!response.ok) {
    const message =
      (data && typeof data === 'object' && (data.error || data.message)) ||
      defaultMessage(response.status)
    if (response.status === 401 && auth && authHeader && onUnauthorized) {
      onUnauthorized()
    }
    throw new ApiError(message, response.status, data)
  }
  return data
}

// =====================================================================
// AUTH   (public endpoints)
// =====================================================================

/** POST /api/auth/register  ->  { id, name, email, role }  (role is always STUDENT) */
export function registerUser({ name, email, password }) {
  return request('/api/auth/register', {
    method: 'POST',
    auth: false,
    body: { name, email, password },
  })
}

/**
 * POST /api/auth/login  ->  { id, name, email, role }
 * The backend returns no token, so on success we remember the Basic header.
 */
export async function loginUser({ email, password }) {
  const user = await request('/api/auth/login', {
    method: 'POST',
    auth: false,
    body: { email, password },
  })
  authHeader = makeBasicHeader(email, password)
  saveSession({ user, authHeader })
  return user
}

// =====================================================================
// STUDENT   (role STUDENT only)
// =====================================================================

/** GET /api/student/quiz/today -> { id, title, topic, questions:[{id,questionText,optionA..D}] } */
export function getTodayQuiz() {
  return request('/api/student/quiz/today')
}

/**
 * POST /api/student/quiz/{quizId}/submit?studentId=
 * answers = { [questionId]: 'A' | 'B' | 'C' | 'D' }
 * -> { score, totalQuestions, message }
 */
export function submitQuiz(quizId, studentId, answers) {
  return request(`/api/student/quiz/${quizId}/submit`, {
    method: 'POST',
    query: { studentId },
    body: answers,
  })
}

/** GET /api/student/attempts?studentId= -> array of QuizAttempt */
export function getMyAttempts(studentId) {
  return request('/api/student/attempts', { query: { studentId } })
}

/** GET /api/student/attempts/{attemptId}?studentId= -> detailed review with questions */
export function getAttemptDetails(attemptId, studentId) {
  return request(`/api/student/attempts/${attemptId}`, {
    query: studentId ? { studentId } : undefined,
  })
}

// =====================================================================
// ADMIN   (role ADMIN only)
// =====================================================================

/** POST /api/admin/quizzes -> Quiz entity (published = false) */
export function createQuiz({ title, topic, quizDate, adminId }) {
  return request('/api/admin/quizzes', {
    method: 'POST',
    body: { title, topic, quizDate, adminId },
  })
}



/** POST /api/admin/questions -> { id } */
export function addQuestion(question) {
  return request('/api/admin/questions', { method: 'POST', body: question })
}

/** POST /api/admin/quizzes/{id}/publish -> { message, quizId } */
export function publishQuiz(quizId) {
  return request(`/api/admin/quizzes/${quizId}/publish`, { method: 'POST' })
}

/** POST /api/admin/quizzes/{id}/unpublish -> { message, quizId } */
export function unpublishQuiz(quizId) {
  return request(`/api/admin/quizzes/${quizId}/unpublish`, { method: 'POST' })
}

export function getAdminQuizzes() {
  return request('/api/admin/quizzes')
}

/** PUT /api/admin/quizzes/{id} -> { message, id, title, topic, quizDate } */
export function updateQuiz(id, { title, topic, quizDate }) {
  return request(`/api/admin/quizzes/${id}`, {
    method: 'PUT',
    body: { title, topic, quizDate },
  })
}

/** DELETE /api/admin/quizzes/{id} -> { message, quizId } */
export function deleteQuiz(id) {
  return request(`/api/admin/quizzes/${id}`, {
    method: 'DELETE',
  })
}

/** GET /api/admin/quizzes/{id}/questions -> array of Question */
export function getQuizQuestions(quizId) {
  return request(`/api/admin/quizzes/${quizId}/questions`)
}

/** GET /api/admin/questions/{id} -> Question */
export function getQuestion(questionId) {
  return request(`/api/admin/questions/${questionId}`)
}

/** PUT /api/admin/questions/{id} -> { message, question } */
export function updateQuestion(questionId, question) {
  return request(`/api/admin/questions/${questionId}`, {
    method: 'PUT',
    body: question,
  })
}

/** DELETE /api/admin/questions/{id} -> { message, questionId } */
export function deleteQuestion(questionId) {
  return request(`/api/admin/questions/${questionId}`, {
    method: 'DELETE',
  })
}

/** POST /api/admin/questions/{id}/archive -> { message, question } */
export function archiveQuestion(questionId) {
  return request(`/api/admin/questions/${questionId}/archive`, {
    method: 'POST',
  })
}

/** POST /api/admin/questions/{id}/unarchive -> { message, question } */
export function unarchiveQuestion(questionId) {
  return request(`/api/admin/questions/${questionId}/unarchive`, {
    method: 'POST',
  })
}

/** GET /api/admin/analytics -> { totalQuizzes, publishedQuizzes, draftQuizzes, totalAttempts, uniqueStudents, averageScore, averagePercentage } */
export function getAdminAnalytics() {
  return request('/api/admin/analytics')
}

/** GET /api/admin/attempts -> array of attempt summaries */
export function getAdminAttempts() {
  return request('/api/admin/attempts')
}

/** GET /api/admin/attempts/{id} -> attempt details with questions */
export function getAdminAttemptDetails(attemptId) {
  return request(`/api/admin/attempts/${attemptId}`)
}

/** POST /api/admin/admins -> { message, id, name, email, role } */
export function createAdminAccount({ name, email, password }) {
  return request('/api/admin/admins', {
    method: 'POST',
    body: { name, email, password },
  })
}

