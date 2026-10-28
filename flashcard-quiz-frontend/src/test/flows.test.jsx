import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'
import { AuthProvider } from '../context/AuthContext'
import * as api from '../services/api'
import { todayISO } from '../utils/format'
import { createMockBackend } from './mockBackend'

const mock = createMockBackend()
beforeAll(() => mock.start(18080))
afterAll(() => mock.stop())
beforeEach(() => {
  mock.reset()
  sessionStorage.clear()
  localStorage.clear()
  api.clearSession()
})

function renderApp(route = '/') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  )
}

const asStudent = () => api.loginUser({ email: 'student@test.com', password: 'studentpass' })
const asAdmin = () => api.loginUser({ email: 'admin@test.com', password: 'adminpass' })

describe('authentication pages', () => {
  it('redirects logged-out visitors to the login page', async () => {
    renderApp('/dashboard')
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
  })

  it('validates the login form without calling the backend', async () => {
    const user = userEvent.setup()
    renderApp('/login')
    await user.click(screen.getByRole('button', { name: 'Log in' }))
    expect(screen.getByText('Email is required.')).toBeInTheDocument()
    expect(screen.getByText('Password is required.')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Email'), 'not-an-email')
    await user.type(screen.getByLabelText('Password'), 'x')
    await user.click(screen.getByRole('button', { name: 'Log in' }))
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument()
    expect(mock.calls).toHaveLength(0)
  })

  it('shows the backend error for wrong credentials', async () => {
    const user = userEvent.setup()
    renderApp('/login')
    await user.type(screen.getByLabelText('Email'), 'student@test.com')
    await user.type(screen.getByLabelText('Password'), 'wrong')
    await user.click(screen.getByRole('button', { name: 'Log in' }))
    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument()
  })

  it('sends a student to the dashboard and an admin to the admin page', async () => {
    const user = userEvent.setup()
    const { unmount } = renderApp('/login')
    await user.type(screen.getByLabelText('Email'), 'student@test.com')
    await user.type(screen.getByLabelText('Password'), 'studentpass')
    await user.click(screen.getByRole('button', { name: 'Log in' }))
    expect(await screen.findByRole('heading', { name: /Hello, Sam Student/ })).toBeInTheDocument()
    unmount()

    sessionStorage.clear()
    api.clearSession()
    renderApp('/login')
    await user.type(screen.getByLabelText('Email'), 'admin@test.com')
    await user.type(screen.getByLabelText('Password'), 'adminpass')
    await user.click(screen.getByRole('button', { name: 'Log in' }))
    expect(await screen.findByRole('heading', { name: 'Admin dashboard' })).toBeInTheDocument()
  })

  it('registers a student, returns to login, and reports duplicate emails', async () => {
    const user = userEvent.setup()
    renderApp('/register')

    await user.type(screen.getByLabelText('Full name'), 'New Person')
    await user.type(screen.getByLabelText('Email'), 'new@test.com')
    await user.type(screen.getByLabelText('Password'), 'secret1')
    await user.type(screen.getByLabelText('Confirm password'), 'different')
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(screen.getByText('Passwords do not match.')).toBeInTheDocument()

    await user.clear(screen.getByLabelText('Confirm password'))
    await user.type(screen.getByLabelText('Confirm password'), 'secret1')
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByText(/Account created!/)).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveValue('new@test.com')
    expect(mock.db.users.at(-1)).toMatchObject({ email: 'new@test.com', role: 'STUDENT' })
  })

  it('shows "Email already registered" from the backend', async () => {
    const user = userEvent.setup()
    renderApp('/register')
    await user.type(screen.getByLabelText('Full name'), 'Dup')
    await user.type(screen.getByLabelText('Email'), 'student@test.com')
    await user.type(screen.getByLabelText('Password'), 'secret1')
    await user.type(screen.getByLabelText('Confirm password'), 'secret1')
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByText('Email already registered')).toBeInTheDocument()
  })
})

describe('role restrictions', () => {
  it('blocks students from the admin page', async () => {
    await asStudent()
    renderApp('/admin')
    expect(await screen.findByText("You can't open this page")).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Admin dashboard' })).not.toBeInTheDocument()
  })

  it('blocks admins from student pages', async () => {
    await asAdmin()
    renderApp('/dashboard')
    expect(await screen.findByText("You can't open this page")).toBeInTheDocument()
    // and no student API call was made
    expect(mock.calls.some((c) => c.path.startsWith('/api/student'))).toBe(false)
  })
})

describe('student pages - empty states', () => {
  it('dashboard shows "no quiz" and "no attempts" when the backend has none', async () => {
    await asStudent()
    renderApp('/dashboard')
    expect(await screen.findByText('No quiz available right now')).toBeInTheDocument()
    expect(screen.getByText(/Today's quiz is not available/)).toBeInTheDocument()
    expect(await screen.findByText('No attempts yet')).toBeInTheDocument()
  })

  it('quiz page explains an unpublished quiz using the backend message', async () => {
    mock.db.quizzes.push({ id: 1, quizDate: todayISO(), title: 'Draft', topic: 'x', published: false, createdAt: '2026-01-01T00:00:00', createdBy: 1 })
    await asStudent()
    renderApp('/quiz')
    expect(await screen.findByText('No quiz available right now')).toBeInTheDocument()
    expect(screen.getByText(/not published/)).toBeInTheDocument()
  })

  it('attempts page shows an empty state', async () => {
    await asStudent()
    renderApp('/attempts')
    expect(await screen.findByText('No attempts yet')).toBeInTheDocument()
  })
})

describe('full journey: admin builds a quiz, student takes it', () => {
  it('works end to end', async () => {
    const user = userEvent.setup()

    // ---------------- admin ----------------
    await asAdmin()
    const adminView = renderApp('/admin')
    await screen.findByRole('heading', { name: 'Admin dashboard' })

    // validation
    await user.click(screen.getByRole('button', { name: 'Create quiz' }))
    expect(screen.getByText('Title is required.')).toBeInTheDocument()
    expect(screen.getByText('Topic is required.')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Title'), 'Daily Mix')
    await user.type(screen.getByLabelText('Topic'), 'General')
    await user.click(screen.getByRole('button', { name: 'Create quiz' }))
    expect(await screen.findByText(/Quiz "Daily Mix" created \(ID 1\)/)).toBeInTheDocument()
    expect(mock.calls.find((c) => c.path === '/api/admin/quizzes' && c.method === 'POST').body).toEqual({
      title: 'Daily Mix', topic: 'General', quizDate: todayISO(), adminId: 1,
    })
    expect(screen.getByText('Draft')).toBeInTheDocument()

    // publishing with no questions is rejected by the backend rule
    await user.click(screen.getByRole('button', { name: 'Publish' }))
    await user.click(screen.getByRole('button', { name: 'Confirm publish' }))
    expect(await screen.findByText(/Add questions before publishing/)).toBeInTheDocument()
    expect(screen.getByText('Draft')).toBeInTheDocument()

    // add two questions (quiz is pre-selected after creation)
    async function addQuestion(text, opts, correct) {
      await user.type(screen.getByLabelText('Question'), text)
      await user.type(screen.getByLabelText('Option A'), opts[0])
      await user.type(screen.getByLabelText('Option B'), opts[1])
      await user.type(screen.getByLabelText('Option C'), opts[2])
      await user.type(screen.getByLabelText('Option D'), opts[3])
      await user.click(within(screen.getByRole('group', { name: 'Correct option' })).getByRole('radio', { name: correct }))
      await user.click(screen.getByRole('button', { name: 'Add question' }))
      await screen.findByText(/Question saved/)
    }

    // question validation first
    await user.click(screen.getByRole('button', { name: 'Add question' }))
    expect(screen.getByText('Question text is required.')).toBeInTheDocument()
    expect(screen.getByText('Select the correct option.')).toBeInTheDocument()

    await addQuestion('Capital of France?', ['Berlin', 'Paris', 'Rome', 'Madrid'], 'B')
    await addQuestion('What is 2 + 2?', ['three', 'five', 'four', 'six'], 'C')
    expect(mock.db.questions).toHaveLength(2)
    expect(mock.db.questions[0]).toMatchObject({ quizId: 1, correctOption: 'B', optionB: 'Paris' })
    expect(screen.getByText('2 questions in database')).toBeInTheDocument()

    // publish
    await user.click(screen.getByRole('button', { name: 'Publish' }))
    await user.click(screen.getByRole('button', { name: 'Confirm publish' }))
    expect(await screen.findByText(/"Daily Mix" is published/)).toBeInTheDocument()
    expect(screen.getByText('Published')).toBeInTheDocument()
    expect(mock.db.quizzes[0].published).toBe(true)
    adminView.unmount()

    // ---------------- student ----------------
    sessionStorage.clear()
    api.clearSession()
    await asStudent()
    renderApp('/dashboard')

    expect(await screen.findByText('Daily Mix')).toBeInTheDocument()
    expect(screen.getByText(/2 questions/)).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: /Start quiz/ }))

    // quiz: answer Q1 correctly, leave Q2 blank
    expect(await screen.findByText('Capital of France?')).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: /Paris/ }))
    await user.click(screen.getByRole('button', { name: /Next/ }))
    expect(await screen.findByText('What is 2 + 2?')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Review & submit/ }))
    expect(screen.getByText(/1 question is unanswered/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Submit quiz' }))

    // results
    expect(await screen.findByText('Quiz results')).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()
    expect(await screen.findByText(/Question Review/)).toBeInTheDocument()
    const submit = mock.calls.find((c) => c.path === '/api/student/quiz/1/submit')
    expect(submit.query).toEqual({ studentId: '2' })
    expect(submit.body).toEqual({ 1: 'B' })

    // attempts page lists it with the real score and allows viewing details
    await user.click(screen.getByRole('link', { name: 'My attempts' }))
    expect(await screen.findByText('1 / 2')).toBeInTheDocument()
    expect(screen.getByText('Daily Mix')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /View details/i }))
    expect(await screen.findByText('Question-wise Review')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Close' }))

    // can't take it twice: quiz page reports completion, backend would also refuse
    await user.click(screen.getByRole('link', { name: 'Dashboard' }))
    expect(await screen.findByText('Already completed')).toBeInTheDocument()
    await expect(api.submitQuiz(1, 2, { 1: 'B' })).rejects.toMatchObject({ message: 'Quiz already submitted' })
  })

  it('results page can reload from the backend when opened directly', async () => {
    mock.db.quizzes.push({ id: 1, quizDate: todayISO(), title: 'Daily Mix', topic: 'General', published: true, createdAt: '2026-01-01T00:00:00', createdBy: 1 })
    mock.db.attempts.push({ id: 1, studentId: 2, quizId: 1, score: 3, totalQuestions: 4, submittedAt: '2026-10-23T09:30:00' })
    await asStudent()
    renderApp('/results/1')
    expect(await screen.findByText('75%')).toBeInTheDocument()
    expect(screen.getByText('Daily Mix')).toBeInTheDocument()
  })

  it('results page says so when there is no attempt', async () => {
    await asStudent()
    renderApp('/results/99')
    expect(await screen.findByText('No result found')).toBeInTheDocument()
  })

  it('admin can edit and delete quizzes through modals with real-time list updates and safety checks', async () => {
    const user = userEvent.setup()
    mock.db.quizzes.push(
      { id: 1, quizDate: '2030-05-01', title: 'Original Quiz Title', topic: 'Original Topic', published: false, createdAt: '2026-01-01T00:00:00', createdBy: 1 },
      { id: 2, quizDate: '2030-05-02', title: 'Quiz With Attempt', topic: 'Active', published: true, createdAt: '2026-01-01T00:00:00', createdBy: 1 }
    )
    mock.db.questions.push(
      { id: 1, quizId: 1, questionText: 'Q1', optionA: 'a', optionB: 'b', optionC: 'c', optionD: 'd', correctOption: 'A' },
      { id: 2, quizId: 2, questionText: 'Q2', optionA: '1', optionB: '2', optionC: '3', optionD: '4', correctOption: 'B' }
    )
    mock.db.attempts.push({ id: 1, studentId: 2, quizId: 2, score: 1, totalQuestions: 1, submittedAt: '2026-01-01T00:00:00' })

    await asAdmin()
    renderApp('/admin')

    expect(await screen.findByText('Original Quiz Title')).toBeInTheDocument()
    expect(screen.getByText('Quiz With Attempt')).toBeInTheDocument()

    // 1. Edit Quiz
    const quiz1Item = screen.getByText('Original Quiz Title').closest('li')
    await user.click(within(quiz1Item).getByRole('button', { name: 'Edit' }))

    const editModal = screen.getByRole('dialog', { name: /Edit quiz/i })
    expect(editModal).toBeInTheDocument()

    const titleInput = within(editModal).getByLabelText('Title')
    expect(titleInput).toHaveValue('Original Quiz Title')
    await user.clear(titleInput)
    await user.type(titleInput, 'Renamed Quiz Title')

    await user.click(within(editModal).getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText(/Quiz "Renamed Quiz Title" \(ID 1\) updated successfully/)).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('Renamed Quiz Title')).toBeInTheDocument()
    expect(mock.db.quizzes.find((q) => q.id === 1).title).toBe('Renamed Quiz Title')

    // 2. Unpublish a published quiz
    const quiz2Item = screen.getByText('Quiz With Attempt').closest('li')
    expect(within(quiz2Item).getByText('Published')).toBeInTheDocument()
    await user.click(within(quiz2Item).getByRole('button', { name: 'Unpublish' }))
    await user.click(within(quiz2Item).getByRole('button', { name: 'Confirm unpublish' }))
    expect(await screen.findByText(/"Quiz With Attempt" has been unpublished/)).toBeInTheDocument()
    expect(mock.db.quizzes.find((q) => q.id === 2).published).toBe(false)

    // 3. Delete Question & Edit Question
    // Questions for Quiz 1 are displayed in the questions card
    expect(await screen.findByText(/Questions in Quiz 1/)).toBeInTheDocument()
    expect(screen.getByText(/1\. Q1/)).toBeInTheDocument()

    // Edit Question
    const qItem = screen.getByText(/1\. Q1/).closest('li')
    await user.click(within(qItem).getByRole('button', { name: 'Edit' }))
    const editQModal = screen.getByRole('dialog', { name: /Edit Question/i })
    const qTextInput = within(editQModal).getByLabelText('Question text')
    await user.clear(qTextInput)
    await user.type(qTextInput, 'Updated Q1 text')
    await user.click(within(editQModal).getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText(/Question 1 updated successfully/)).toBeInTheDocument()
    expect(mock.db.questions.find((q) => q.id === 1).questionText).toBe('Updated Q1 text')

    // Verify Delete Question button is removed from Admin Dashboard
    const updatedQItem = screen.getByText(/1\. Updated Q1 text/).closest('li')
    expect(within(updatedQItem).queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
    expect(within(updatedQItem).getByRole('button', { name: 'Edit' })).toBeInTheDocument()

    // 4. Delete Quiz (successful when no attempts)
    const renamedQuizItem = screen.getByText('Renamed Quiz Title').closest('li')
    await user.click(within(renamedQuizItem).getByRole('button', { name: 'Delete' }))

    const deleteModal = screen.getByRole('dialog', { name: /Delete quiz/i })
    expect(deleteModal).toBeInTheDocument()
    expect(within(deleteModal).getByText(/Renamed Quiz Title/)).toBeInTheDocument()

    await user.click(within(deleteModal).getByRole('button', { name: 'Confirm delete' }))

    expect(await screen.findByText(/Quiz "Renamed Quiz Title" \(ID 1\) deleted successfully/)).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByText('Renamed Quiz Title')).not.toBeInTheDocument()
    expect(mock.db.quizzes.some((q) => q.id === 1)).toBe(false)

    // 5. Delete Quiz (blocked when attempts exist)
    const quiz2ItemNow = screen.getByText('Quiz With Attempt').closest('li')
    await user.click(within(quiz2ItemNow).getByRole('button', { name: 'Delete' }))

    const blockDeleteModal = screen.getByRole('dialog', { name: /Delete quiz/i })
    await user.click(within(blockDeleteModal).getByRole('button', { name: 'Confirm delete' }))

    expect(await within(blockDeleteModal).findByText('Cannot delete quiz because students have submitted attempts')).toBeInTheDocument()
    expect(mock.db.quizzes.some((q) => q.id === 2)).toBe(true)

    // Close the blocked delete dialog
    await user.click(within(blockDeleteModal).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('Quiz With Attempt')).toBeInTheDocument()

    // 6. Create another admin account
    await user.type(screen.getByLabelText('Full name'), 'Bob Admin')
    await user.type(screen.getByLabelText('Email address'), 'bob.admin@test.com')
    await user.type(screen.getByLabelText('Password'), 'adminpass123')
    await user.click(screen.getByRole('button', { name: 'Create admin account' }))

    expect(await screen.findByText(/Admin account for "Bob Admin" \(bob\.admin@test\.com\) created successfully/)).toBeInTheDocument()
    expect(mock.db.users.some((u) => u.email === 'bob.admin@test.com' && u.role === 'ADMIN')).toBe(true)
  })
})

