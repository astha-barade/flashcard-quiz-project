// =====================================================================
// TEST-ONLY mock of the Spring Boot backend.
//
// It re-implements the behaviour READ FROM THE JAVA SOURCE (controllers,
// services, SecurityConfig) so the frontend can be exercised with real HTTP
// requests. It is NOT the real backend and is never used by the app itself.
// Anything the real server does that isn't in the Java code isn't covered here.
// =====================================================================
import http from 'node:http'

const ALLOWED_ORIGIN = 'http://localhost:5173' // from @CrossOrigin on the controllers

function today() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function createMockBackend() {
  let db
  const calls = [] // every request seen: { method, path, auth, body }

  function reset() {
    db = {
      users: [
        { id: 1, name: 'Ada Admin', email: 'admin@test.com', password: 'adminpass', role: 'ADMIN', createdAt: '2026-01-01T10:00:00' },
        { id: 2, name: 'Sam Student', email: 'student@test.com', password: 'studentpass', role: 'STUDENT', createdAt: '2026-01-02T10:00:00' },
      ],
      quizzes: [],
      questions: [],
      attempts: [],
      seq: { user: 3, quiz: 1, question: 1, attempt: 1 },
    }
    calls.length = 0
  }
  reset()

  const userJson = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role })
  const entityUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, createdAt: u.createdAt })
  const entityQuiz = (q) => ({
    id: q.id, quizDate: q.quizDate, title: q.title, topic: q.topic,
    published: q.published, createdAt: q.createdAt, createdBy: entityUser(db.users.find((u) => u.id === q.createdBy)),
  })

  function send(res, status, body, extra = {}) {
    const text = body === undefined ? '' : JSON.stringify(body)
    res.writeHead(status, { 'Content-Type': 'application/json', ...extra })
    res.end(text)
  }
  const bad = (res, message) => send(res, 400, { error: message })

  async function readBody(req) {
    const chunks = []
    for await (const c of req) chunks.push(c)
    const raw = Buffer.concat(chunks).toString()
    return raw ? JSON.parse(raw) : undefined
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x')
    const path = url.pathname
    const origin = req.headers.origin
    const cors = origin === ALLOWED_ORIGIN ? { 'Access-Control-Allow-Origin': origin } : {}

    // SecurityConfig has no http.cors(): preflight to protected URLs is rejected (401),
    // preflight to /api/auth/** (permitAll) reaches @CrossOrigin and succeeds.
    if (req.method === 'OPTIONS') {
      if (path.startsWith('/api/auth/') && origin === ALLOWED_ORIGIN) {
        res.writeHead(200, { ...cors, 'Access-Control-Allow-Methods': 'GET,POST', 'Access-Control-Allow-Headers': '*' })
        return res.end()
      }
      res.writeHead(401)
      return res.end()
    }

    let body
    try {
      body = await readBody(req)
    } catch {
      return send(res, 400, { error: 'Malformed JSON' }, cors)
    }

    // ---- authentication (Basic) ----
    let principal = null
    let badCredentials = false
    const header = req.headers.authorization
    if (header?.startsWith('Basic ')) {
      const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8')
      const i = decoded.indexOf(':')
      const user = db.users.find((u) => u.email === decoded.slice(0, i))
      if (user && user.password === decoded.slice(i + 1)) principal = user
      else badCredentials = true
    }
    calls.push({ method: req.method, path, query: Object.fromEntries(url.searchParams), auth: header || null, body, xrw: req.headers['x-requested-with'] || null })

    const deny401 = () => {
      const h = { ...cors }
      // Spring omits WWW-Authenticate for X-Requested-With: XMLHttpRequest
      if (req.headers['x-requested-with'] !== 'XMLHttpRequest') h['WWW-Authenticate'] = 'Basic realm="Realm"'
      res.writeHead(401, h)
      res.end()
    }

    const isAuth = path.startsWith('/api/auth/')
    if (!isAuth) {
      if (badCredentials || !principal) return deny401()
      if ((path.startsWith('/api/admin/') || path.startsWith('/api/ai/')) && principal.role !== 'ADMIN') { res.writeHead(403, cors); return res.end() }
      if (path.startsWith('/api/student/') && principal.role !== 'STUDENT') { res.writeHead(403, cors); return res.end() }
    }

    const m = (method, re) => req.method === method && re.exec(path)
    let r

    // ---------------- AuthController ----------------
    if (m('POST', /^\/api\/auth\/register$/)) {
      if (db.users.some((u) => u.email === body.email)) return bad(res, 'Email already registered')
      const u = { id: db.seq.user++, name: body.name, email: body.email, password: body.password, role: 'STUDENT', createdAt: new Date().toISOString() }
      db.users.push(u)
      return send(res, 200, userJson(u), cors)
    }
    if (m('POST', /^\/api\/auth\/login$/)) {
      const u = db.users.find((x) => x.email === body.email)
      if (!u || u.password !== body.password) return bad(res, 'Invalid email or password')
      return send(res, 200, userJson(u), cors)
    }

    // ---------------- StudentController ----------------
    if (m('GET', /^\/api\/student\/quiz\/today$/)) {
      const quiz = db.quizzes.find((q) => q.quizDate === today())
      if (!quiz) return bad(res, "Today's quiz is not available")
      if (!quiz.published) return bad(res, "Today's quiz is not published")
      const questions = db.questions.filter((q) => q.quizId === quiz.id && !q.archived).map((q) => ({
        id: q.id, questionText: q.questionText, optionA: q.optionA, optionB: q.optionB, optionC: q.optionC, optionD: q.optionD,
      }))
      return send(res, 200, { id: quiz.id, title: quiz.title, topic: quiz.topic, questions }, cors)
    }
    if ((r = m('POST', /^\/api\/student\/quiz\/(\d+)\/submit$/))) {
      const quizId = Number(r[1])
      const studentId = Number(url.searchParams.get('studentId'))
      const quiz = db.quizzes.find((q) => q.id === quizId)
      if (!quiz) return bad(res, 'Quiz not found')
      if (!quiz.published) return bad(res, 'Quiz is not published')
      if (db.attempts.some((a) => a.studentId === studentId && a.quizId === quizId)) return bad(res, 'Quiz already submitted')
      const qs = db.questions.filter((q) => q.quizId === quizId && !q.archived)
      if (qs.length === 0) return bad(res, 'Quiz has no questions')
      let score = 0
      for (const q of qs) {
        const ans = body?.[q.id]
        if (ans != null && q.correctOption.toLowerCase() === String(ans).trim().toLowerCase()) score++
      }
      const attempt = { id: db.seq.attempt++, studentId, quizId, score, totalQuestions: qs.length, submittedAt: new Date().toISOString(), answers: body }
      db.attempts.push(attempt)
      return send(res, 200, { score, totalQuestions: qs.length, message: 'Quiz submitted successfully', attemptId: attempt.id }, cors)
    }
    if ((r = m('GET', /^\/api\/student\/attempts\/(\d+)$/))) {
      const attemptId = Number(r[1])
      const attempt = db.attempts.find((a) => a.id === attemptId)
      if (!attempt) return send(res, 404, { error: 'Attempt not found' }, cors)
      if (attempt.studentId !== principal.id) return send(res, 403, { error: "Access denied: You cannot view another student's attempt" }, cors)
      const quiz = db.quizzes.find((q) => q.id === attempt.quizId) || {}
      const qs = db.questions.filter((q) => q.quizId === attempt.quizId)
      const answers = attempt.answers || {}
      const questionsReview = qs.map((q) => {
        const sel = answers[q.id] || null
        const optText = (l) => (l ? q[`option${l}`] : null)
        return {
          id: q.id,
          questionText: q.questionText,
          optionA: q.optionA,
          optionB: q.optionB,
          optionC: q.optionC,
          optionD: q.optionD,
          selectedOption: sel,
          selectedOptionText: optText(sel),
          correctOption: q.correctOption,
          correctOptionText: optText(q.correctOption),
          correct: sel != null && String(sel).toUpperCase() === String(q.correctOption).toUpperCase(),
        }
      })
      const pct = attempt.totalQuestions > 0 ? Math.round((attempt.score * 1000) / attempt.totalQuestions) / 10 : 0
      return send(res, 200, {
        id: attempt.id,
        attemptId: attempt.id,
        quizId: quiz.id,
        quizTitle: quiz.title,
        quizTopic: quiz.topic,
        quizDate: quiz.quizDate,
        score: attempt.score,
        totalQuestions: attempt.totalQuestions,
        percentage: pct,
        submittedAt: attempt.submittedAt,
        hasDetailedReview: questionsReview.length > 0,
        questions: questionsReview,
      }, cors)
    }
    if (m('GET', /^\/api\/student\/attempts$/)) {
      const studentId = Number(url.searchParams.get('studentId'))
      const list = db.attempts.filter((a) => a.studentId === studentId).map((a) => ({
        id: a.id,
        student: entityUser(db.users.find((u) => u.id === a.studentId)),
        quiz: entityQuiz(db.quizzes.find((q) => q.id === a.quizId)),
        score: a.score, totalQuestions: a.totalQuestions, submittedAt: a.submittedAt,
      }))
      return send(res, 200, list, cors)
    }

    // ---------------- AdminController ----------------
    if (m('GET', /^\/api\/admin\/quizzes$/)) {
      const list = db.quizzes.map((q) => ({
        id: q.id,
        title: q.title,
        topic: q.topic,
        quizDate: q.quizDate,
        published: q.published,
        questionsAdded: db.questions.filter((x) => x.quizId === q.id && !x.archived).length,
        totalQuestions: db.questions.filter((x) => x.quizId === q.id).length,
        hasAttempts: db.attempts.some((a) => a.quizId === q.id),
      }))
      return send(res, 200, list, cors)
    }
    if (m('POST', /^\/api\/admin\/quizzes$/)) {
      if (db.quizzes.some((q) => q.quizDate === body.quizDate)) return bad(res, 'Quiz already exists for this date')
      if (!body.title || !body.topic || !body.quizDate) return bad(res, 'could not execute statement (NOT NULL constraint)')
      const quiz = { id: db.seq.quiz++, quizDate: body.quizDate, title: body.title, topic: body.topic, published: false, createdAt: new Date().toISOString(), createdBy: body.adminId }
      db.quizzes.push(quiz)
      return send(res, 200, entityQuiz(quiz), cors)
    }
    if (m('POST', /^\/api\/admin\/questions$/)) {
      if (!body.quizId) return bad(res, 'A valid quiz is required')
      if (!db.quizzes.some((q) => q.id === body.quizId)) return bad(res, 'Referential integrity constraint violation')
      if (!['A', 'B', 'C', 'D'].includes(body.correctOption)) return send(res, 400, { timestamp: 'x', status: 400, error: 'Bad Request' })
      const q = { id: db.seq.question++, quizId: body.quizId, questionText: body.questionText, optionA: body.optionA, optionB: body.optionB, optionC: body.optionC, optionD: body.optionD, correctOption: body.correctOption, archived: false }
      db.questions.push(q)
      return send(res, 200, { id: q.id }, cors)
    }
    if ((r = m('POST', /^\/api\/admin\/quizzes\/(\d+)\/publish$/))) {
      const quiz = db.quizzes.find((q) => q.id === Number(r[1]))
      if (!quiz) return bad(res, 'Quiz not found')
      if (!db.questions.some((q) => q.quizId === quiz.id && !q.archived)) return bad(res, 'Add questions before publishing')
      quiz.published = true
      return send(res, 200, { message: 'Quiz published successfully', quizId: quiz.id }, cors)
    }
    if ((r = m('PUT', /^\/api\/admin\/quizzes\/(\d+)$/))) {
      const quizId = Number(r[1])
      if (!quizId || quizId <= 0) return bad(res, 'Invalid quiz ID')
      const quiz = db.quizzes.find((q) => q.id === quizId)
      if (!quiz) return bad(res, 'Quiz not found')
      if (!body?.title || !body.title.trim()) return bad(res, 'Quiz title is required')
      if (!body?.topic || !body.topic.trim()) return bad(res, 'Quiz topic is required')
      if (!body?.quizDate) return bad(res, 'Quiz date is required')
      if (db.quizzes.some((q) => q.id !== quizId && q.quizDate === body.quizDate)) {
        return bad(res, 'Quiz already exists for this date')
      }
      quiz.title = body.title.trim()
      quiz.topic = body.topic.trim()
      quiz.quizDate = body.quizDate
      return send(res, 200, {
        message: 'Quiz updated successfully',
        id: quiz.id,
        title: quiz.title,
        topic: quiz.topic,
        quizDate: quiz.quizDate,
      }, cors)
    }
    if ((r = m('DELETE', /^\/api\/admin\/quizzes\/(\d+)$/))) {
      const quizId = Number(r[1])
      if (!quizId || quizId <= 0) return bad(res, 'Invalid quiz ID')
      const quizIndex = db.quizzes.findIndex((q) => q.id === quizId)
      if (quizIndex === -1) return bad(res, 'Quiz not found')
      if (db.attempts.some((a) => a.quizId === quizId)) {
        return bad(res, 'Cannot delete quiz because students have submitted attempts')
      }
      db.questions = db.questions.filter((q) => q.quizId !== quizId)
      db.quizzes.splice(quizIndex, 1)
      return send(res, 200, { message: 'Quiz deleted successfully', quizId }, cors)
    }
    if ((r = m('POST', /^\/api\/admin\/quizzes\/(\d+)\/unpublish$/))) {
      const quiz = db.quizzes.find((q) => q.id === Number(r[1]))
      if (!quiz) return bad(res, 'Quiz not found')
      quiz.published = false
      return send(res, 200, { message: 'Quiz unpublished successfully', quizId: quiz.id }, cors)
    }
    if ((r = m('GET', /^\/api\/admin\/quizzes\/(\d+)\/questions$/))) {
      const quizId = Number(r[1])
      const hasAttempts = db.attempts.some((a) => a.quizId === quizId)
      const qs = db.questions.filter((q) => q.quizId === quizId).map((q) => ({
        ...q,
        archived: Boolean(q.archived),
        hasAttempts,
      }))
      return send(res, 200, qs, cors)
    }
    if ((r = m('GET', /^\/api\/admin\/questions\/(\d+)$/))) {
      const q = db.questions.find((x) => x.id === Number(r[1]))
      if (!q) return bad(res, 'Question not found')
      const hasAttempts = db.attempts.some((a) => a.quizId === q.quizId)
      return send(res, 200, { ...q, archived: Boolean(q.archived), hasAttempts }, cors)
    }
    if ((r = m('PUT', /^\/api\/admin\/questions\/(\d+)$/))) {
      const q = db.questions.find((x) => x.id === Number(r[1]))
      if (!q) return bad(res, 'Question not found')
      if (!body?.questionText?.trim()) return bad(res, 'Question text is required')
      if (!body?.optionA?.trim() || !body?.optionB?.trim() || !body?.optionC?.trim() || !body?.optionD?.trim()) {
        return bad(res, 'All options are required')
      }
      if (!['A', 'B', 'C', 'D'].includes(body?.correctOption)) return bad(res, 'Correct option is required')
      q.questionText = body.questionText.trim()
      q.optionA = body.optionA.trim()
      q.optionB = body.optionB.trim()
      q.optionC = body.optionC.trim()
      q.optionD = body.optionD.trim()
      q.correctOption = body.correctOption
      const hasAttempts = db.attempts.some((a) => a.quizId === q.quizId)
      return send(res, 200, { message: 'Question updated successfully', question: { ...q, archived: Boolean(q.archived), hasAttempts } }, cors)
    }
    if ((r = m('POST', /^\/api\/admin\/questions\/(\d+)\/archive$/)) || (r = m('PUT', /^\/api\/admin\/questions\/(\d+)\/archive$/))) {
      const q = db.questions.find((x) => x.id === Number(r[1]))
      if (!q) return bad(res, 'Question not found')
      q.archived = true
      const hasAttempts = db.attempts.some((a) => a.quizId === q.quizId)
      return send(res, 200, { message: 'Question archived successfully', question: { ...q, archived: true, hasAttempts } }, cors)
    }
    if ((r = m('POST', /^\/api\/admin\/questions\/(\d+)\/unarchive$/))) {
      const q = db.questions.find((x) => x.id === Number(r[1]))
      if (!q) return bad(res, 'Question not found')
      q.archived = false
      const hasAttempts = db.attempts.some((a) => a.quizId === q.quizId)
      return send(res, 200, { message: 'Question unarchived successfully', question: { ...q, archived: false, hasAttempts } }, cors)
    }
    if ((r = m('DELETE', /^\/api\/admin\/questions\/(\d+)$/))) {
      const qId = Number(r[1])
      const qIdx = db.questions.findIndex((x) => x.id === qId)
      if (qIdx === -1) return bad(res, 'Question not found')
      const quizId = db.questions[qIdx].quizId
      if (db.attempts.some((a) => a.quizId === quizId)) {
        return bad(res, 'Cannot delete question because students have submitted attempts for this quiz. Please archive the question instead.')
      }
      db.questions.splice(qIdx, 1)
      return send(res, 200, { message: 'Question deleted successfully', questionId: qId }, cors)
    }
    if (m('GET', /^\/api\/admin\/analytics$/)) {
      const totalQuizzes = db.quizzes.length
      const publishedQuizzes = db.quizzes.filter((q) => q.published).length
      const draftQuizzes = totalQuizzes - publishedQuizzes
      const totalAttempts = db.attempts.length
      const avgScore = totalAttempts === 0 ? 0 : db.attempts.reduce((acc, a) => acc + a.score, 0) / totalAttempts
      const avgPct = totalAttempts === 0 ? 0 : db.attempts.reduce((acc, a) => acc + (a.totalQuestions > 0 ? (a.score * 100) / a.totalQuestions : 0), 0) / totalAttempts
      const uniqueStudents = new Set(db.attempts.map((a) => a.studentId)).size
      return send(res, 200, {
        totalQuizzes,
        publishedQuizzes,
        draftQuizzes,
        totalAttempts,
        uniqueStudents,
        averageScore: Math.round(avgScore * 10) / 10,
        averagePercentage: Math.round(avgPct * 10) / 10,
      }, cors)
    }
    if (m('GET', /^\/api\/admin\/attempts$/)) {
      const list = db.attempts.map((a) => {
        const student = db.users.find((u) => u.id === a.studentId) || {}
        const quiz = db.quizzes.find((q) => q.id === a.quizId) || {}
        const pct = a.totalQuestions > 0 ? Math.round((a.score * 1000) / a.totalQuestions) / 10 : 0
        return {
          id: a.id,
          attemptId: a.id,
          studentId: a.studentId,
          studentName: student.name || 'Unknown',
          studentEmail: student.email || '',
          quizId: a.quizId,
          quizTitle: quiz.title || 'Untitled',
          quizTopic: quiz.topic || '',
          quizDate: quiz.quizDate || '',
          score: a.score,
          totalQuestions: a.totalQuestions,
          percentage: pct,
          submittedAt: a.submittedAt,
        }
      })
      return send(res, 200, list, cors)
    }
    if ((r = m('GET', /^\/api\/admin\/attempts\/(\d+)$/))) {
      const attemptId = Number(r[1])
      const attempt = db.attempts.find((a) => a.id === attemptId)
      if (!attempt) return send(res, 404, { error: 'Attempt not found' }, cors)
      const quiz = db.quizzes.find((q) => q.id === attempt.quizId) || {}
      const qs = db.questions.filter((q) => q.quizId === attempt.quizId)
      const answers = attempt.answers || {}
      const questionsReview = qs.map((q) => {
        const sel = answers[q.id] || null
        const optText = (l) => (l ? q[`option${l}`] : null)
        return {
          id: q.id,
          questionText: q.questionText,
          optionA: q.optionA,
          optionB: q.optionB,
          optionC: q.optionC,
          optionD: q.optionD,
          selectedOption: sel,
          selectedOptionText: optText(sel),
          correctOption: q.correctOption,
          correctOptionText: optText(q.correctOption),
          correct: sel != null && String(sel).toUpperCase() === String(q.correctOption).toUpperCase(),
        }
      })
      const pct = attempt.totalQuestions > 0 ? Math.round((attempt.score * 1000) / attempt.totalQuestions) / 10 : 0
      return send(res, 200, {
        id: attempt.id,
        attemptId: attempt.id,
        quizId: quiz.id,
        quizTitle: quiz.title,
        quizTopic: quiz.topic,
        quizDate: quiz.quizDate,
        score: attempt.score,
        totalQuestions: attempt.totalQuestions,
        percentage: pct,
        submittedAt: attempt.submittedAt,
        hasDetailedReview: questionsReview.length > 0,
        questions: questionsReview,
      }, cors)
    }
    if (m('POST', /^\/api\/admin\/admins$/)) {
      if (!body?.name?.trim()) return bad(res, 'Name is required')
      if (!body?.email?.trim()) return bad(res, 'Email is required')
      if (!body?.password || body.password.length < 6) return bad(res, 'Password must be at least 6 characters')
      const cleanEmail = body.email.trim().toLowerCase()
      if (db.users.some((u) => u.email.toLowerCase() === cleanEmail)) {
        return bad(res, 'Email already registered')
      }
      const admin = {
        id: db.seq.user++,
        name: body.name.trim(),
        email: cleanEmail,
        password: body.password,
        role: 'ADMIN',
        createdAt: new Date().toISOString(),
      }
      db.users.push(admin)
      return send(res, 200, {
        message: 'Admin account created successfully',
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      }, cors)
    }

    if (m('POST', /^\/api\/ai\/generate$/)) {
      const topic = body?.topic || body?.prompt
      if (!topic || !topic.trim()) return bad(res, 'Topic or prompt is required')
      const sanitized = topic.trim()
      const questions = Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        questionText: `What is a key concept of ${sanitized} (Question ${i + 1})?`,
        optionA: `Primary option A for ${sanitized}`,
        optionB: `Secondary option B for ${sanitized}`,
        optionC: `Tertiary option C for ${sanitized}`,
        optionD: `Alternative option D for ${sanitized}`,
        correctOption: ['A', 'B', 'C', 'D'][i % 4],
        correctAnswer: ['A', 'B', 'C', 'D'][i % 4],
        explanation: `Explanation for question ${i + 1} regarding ${sanitized}`,
      }))
      return send(res, 200, {
        topic: sanitized,
        count: 10,
        questions,
        answer: `Generated 10 MCQs for topic: ${sanitized}`,
      }, cors)
    }

    res.writeHead(404)
    res.end()
  })

  return {
    calls,
    reset,
    get db() { return db },
    start: (port = 18080) => new Promise((resolve) => server.listen(port, '127.0.0.1', resolve)),
    stop: () => new Promise((resolve) => server.close(resolve)),
  }
}

// Allow `node src/test/mockBackend.js` to run it standalone (used to check the Vite proxy).
if (import.meta.url === `file://${process.argv[1]}`) {
  const mock = createMockBackend()
  mock.start(Number(process.env.PORT) || 18080).then(() => console.log('mock backend on', process.env.PORT || 18080))
}
