# Daily Flashcard Quiz – Frontend

React + Vite + JavaScript + React Router frontend for the Spring Boot backend
(`http://localhost:8080`). The backend is **not** modified by this project.

## 1. Run it

```bash
# 1) Start MySQL and the Spring Boot backend first (port 8080)

# 2) In this folder
npm install
npm run dev          # opens http://localhost:5173
```

Other commands: `npm run build` (production build into `dist/`), `npm test` (see §6).

### Configuration – `.env`

| Variable | Default | Meaning |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:8080` | Where the backend runs. |
| `VITE_USE_DEV_PROXY` | `true` | In `npm run dev`, send `/api/*` through Vite's proxy to `VITE_API_BASE_URL`. |

**Why the proxy?** The backend's `SecurityConfig` never enables CORS (`http.cors()`), so a browser's
preflight request to protected endpoints (`/api/student/**`, `/api/admin/**`) is likely rejected with 401.
Through the proxy the browser only talks to `localhost:5173`, so CORS never applies.
If you set `VITE_USE_DEV_PROXY=false` (or use a production build) the app calls `VITE_API_BASE_URL`
directly, and that only works once the backend allows CORS for protected URLs.
Restart `npm run dev` after editing `.env`.

## 2. Accounts and roles

* **Register** always creates a `STUDENT`.
* There is **no API to create an admin**. Register normally, then promote the user directly in MySQL:
  ```sql
  UPDATE users SET role = 'ADMIN' WHERE email = 'you@example.com';
  ```
* The backend only lets `ADMIN` use `/api/admin/**` and only `STUDENT` use `/api/student/**`.
  The frontend mirrors that: admins land on `/admin`, students on `/dashboard`, and each role is
  blocked from the other's pages.

## 3. Where files belong

```
.env, .env.example          backend URL settings
vite.config.js              dev proxy + test config
index.html
src/
  main.jsx                  starts React, Router and AuthProvider
  App.jsx                   all routes (which URL shows which page)
  index.css                 the whole navy theme (colours are CSS variables at the top)
  services/api.js           ★ the ONLY file that calls the backend
  context/AuthContext.jsx   who is logged in (login / logout)
  components/               reusable pieces: Button, FormField, Alert, EmptyState,
                            Navbar, ProtectedRoute, StatCard, ProgressBar, ScoreRing ...
  pages/
    Login.jsx  Register.jsx
    StudentDashboard.jsx  DailyQuiz.jsx  QuizResults.jsx  MyAttempts.jsx
    AdminDashboard.jsx  NotFound.jsx
  utils/                    date/percent helpers, attempt normalizer
  test/                     automated tests + a TEST-ONLY mock of the backend
```

**Adding to your existing Vite project instead:** copy `src/`, `index.html`, `.env`,
and merge the `server.proxy` block from `vite.config.js`; then run `npm i react-router-dom`.

## 4. Backend endpoints used (read from the Java source)

| Frontend feature | Endpoint |
|---|---|
| Register | `POST /api/auth/register` |
| Login | `POST /api/auth/login` |
| Today's quiz / dashboard | `GET /api/student/quiz/today` |
| Submit quiz | `POST /api/student/quiz/{id}/submit?studentId=` body `{ "<questionId>": "A".."D" }` |
| My attempts, dashboard stats, result reload | `GET /api/student/attempts?studentId=` |
| Create quiz | `POST /api/admin/quizzes` |
| Add question | `POST /api/admin/questions` |
| Publish quiz | `POST /api/admin/quizzes/{id}/publish` |

**Authentication:** the backend uses HTTP Basic (no token). After login the app keeps the
`Authorization: Basic …` value in `sessionStorage` (cleared when the tab closes) and sends it with every
request. That means the password is held in the browser for the session; that is inherent to Basic auth.

## 5. What is deliberately unavailable (no backend endpoint)

Shown in the UI as unavailable or explained, never faked:

* Per-question answer review on the results page (backend returns only score and total)
* Listing quizzes or questions; editing/deleting them; un-publishing
* Student results/analytics for admins; creating admin accounts
* The admin page's quiz list is **saved in your browser only** (`localStorage`) – it contains quizzes you
  created there or added by ID, because the backend cannot list quizzes.

## 6. Tests – and their limits

`npm test` runs 20 tests (API layer + full page flows: login validation, role guards, admin
create → add questions → publish, student take quiz → results → attempts).

They run against `src/test/mockBackend.js`, a **test-only mock written from the Java source**
(Basic auth, role checks, exact error messages, response shapes). It proves the frontend follows the
contract it was built from; it does **not** prove your real server behaves identically.

## 7. Things to check on your real backend

1. **CORS** – see §1.
2. **`GET /api/student/attempts` returns raw JPA entities** with lazy `student`/`quiz` relations. Depending on
   Jackson/Hibernate configuration this can fail with HTTP 500 or return a different shape. The pages show
   the error with a Retry button instead of crashing. If it fails, the clean fix is a small DTO in the backend.
3. **Today's quiz uses the server's date and time zone** (`LocalDate.now()`), so a quiz dated "today" in your
   browser may not be "today" on the server near midnight or across time zones.
4. `studentId` / `adminId` are sent by the client and trusted by the backend. The frontend sends the logged-in
   user's own id, but the API itself does not verify it matches the authenticated user.
