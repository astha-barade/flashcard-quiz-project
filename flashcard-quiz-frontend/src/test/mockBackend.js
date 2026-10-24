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
      if (path.startsWith('/api/admin/') && principal.role !== 'ADMIN') { res.writeHead(403, cors); return res.end() }
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
      const questions = db.questions.filter((q) => q.quizId === quiz.id).map((q) => ({
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
      const qs = db.questions.filter((q) => q.quizId === quizId)
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
        questionsAdded: db.questions.filter((x) => x.quizId === q.id).length,
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
      const q = { id: db.seq.question++, quizId: body.quizId, questionText: body.questionText, optionA: body.optionA, optionB: body.optionB, optionC: body.optionC, optionD: body.optionD, correctOption: body.correctOption }
      db.questions.push(q)
      return send(res, 200, { id: q.id }, cors)
    }
    if ((r = m('POST', /^\/api\/admin\/quizzes\/(\d+)\/publish$/))) {
      const quiz = db.quizzes.find((q) => q.id === Number(r[1]))
      if (!quiz) return bad(res, 'Quiz not found')
      if (!db.questions.some((q) => q.quizId === quiz.id)) return bad(res, 'Add questions before publishing')
      quiz.published = true
      return send(res, 200, { message: 'Quiz published successfully', quizId: quiz.id }, cors)
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
