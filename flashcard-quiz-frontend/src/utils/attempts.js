import { percent } from './format'
import { toTime } from './time'

// The attempts endpoint returns raw database entities. This turns each one into
// a flat, predictable object so pages don't have to guess the shape.
export function normalizeAttempt(a) {
  const quiz = a && typeof a.quiz === 'object' && a.quiz !== null ? a.quiz : null
  const quizId = quiz?.id ?? (typeof a?.quiz === 'number' ? a.quiz : null)
  const score = Number(a?.score ?? 0)
  const total = Number(a?.totalQuestions ?? 0)
  return {
    id: a?.id,
    quizId,
    title: quiz?.title || (quizId != null ? `Quiz #${quizId}` : 'Quiz'),
    topic: quiz?.topic || '',
    quizDate: quiz?.quizDate || null,
    score,
    total,
    percent: percent(score, total),
    submittedAt: a?.submittedAt || null,
  }
}

/** Normalizes a list and sorts newest first. */
export function normalizeAttempts(list) {
  if (!Array.isArray(list)) return []
  return list
    .map(normalizeAttempt)
    .sort((x, y) => toTime(y.submittedAt) - toTime(x.submittedAt))
}
