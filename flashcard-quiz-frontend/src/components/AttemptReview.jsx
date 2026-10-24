import Badge from './Badge'
import Alert from './Alert'

const LETTERS = ['A', 'B', 'C', 'D']

export default function AttemptReview({ review }) {
  if (!review) return null

  const {
    quizTitle,
    quizTopic,
    score,
    totalQuestions,
    percentage,
    hasDetailedReview,
    questions = [],
  } = review

  if (!hasDetailedReview || questions.length === 0) {
    return (
      <div className="review-unavailable">
        <Alert type="warning" title="Detailed review unavailable">
          Question-level review is unavailable for this attempt. This quiz was
          completed before detailed answer tracking was enabled.
        </Alert>
      </div>
    )
  }

  const correctCount = questions.filter((q) => q.correct).length
  const unansweredCount = questions.filter((q) => !q.selectedOption).length
  const incorrectCount = questions.length - correctCount - unansweredCount

  return (
    <div className="attempt-review">
      <div className="review-summary-box">
        <div>
          <h3>{quizTitle}</h3>
          {quizTopic && <span className="muted small">Topic: {quizTopic}</span>}
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <Badge tone={percentage >= 80 ? 'green' : percentage >= 50 ? 'navy' : 'amber'}>
            Score: {score}/{totalQuestions} ({percentage}%)
          </Badge>
          <Badge tone="green">{correctCount} Correct</Badge>
          {incorrectCount > 0 && <Badge tone="red">{incorrectCount} Incorrect</Badge>}
          {unansweredCount > 0 && <Badge tone="amber">{unansweredCount} Unanswered</Badge>}
        </div>
      </div>

      <div className="review-list">
        {questions.map((q, index) => {
          const isUnanswered = !q.selectedOption
          const isCorrect = q.correct

          const borderClass = isUnanswered
            ? 'unanswered-border'
            : isCorrect
            ? 'correct-border'
            : 'incorrect-border'

          return (
            <div key={q.id || index} className={`review-question-card ${borderClass}`}>
              <div className="review-q-header">
                <span className="flashcard-index">
                  Question {index + 1} of {questions.length}
                </span>

                {isUnanswered ? (
                  <Badge tone="amber">Unanswered</Badge>
                ) : isCorrect ? (
                  <Badge tone="green">✓ Correct</Badge>
                ) : (
                  <Badge tone="red">✗ Incorrect</Badge>
                )}
              </div>

              <div className="review-q-title">{q.questionText}</div>

              <div className="review-options">
                {LETTERS.map((letter) => {
                  const optionText = q[`option${letter}`]
                  const isSelected = q.selectedOption === letter
                  const isAnswerCorrect = q.correctOption === letter

                  let itemClass = 'state-normal'
                  let tag = null

                  if (isSelected && isAnswerCorrect) {
                    itemClass = 'state-correct'
                    tag = <span className="review-option-tag tag-correct">Your Answer · Correct</span>
                  } else if (isSelected && !isAnswerCorrect) {
                    itemClass = 'state-incorrect'
                    tag = <span className="review-option-tag tag-incorrect">Your Answer · Incorrect</span>
                  } else if (!isSelected && isAnswerCorrect) {
                    itemClass = 'state-correct'
                    tag = <span className="review-option-tag tag-correct-answer">Correct Answer</span>
                  }

                  return (
                    <div key={letter} className={`review-option-item ${itemClass}`}>
                      <div className="review-option-left">
                        <span className="option-letter">{letter}</span>
                        <span className="option-text">{optionText}</span>
                      </div>
                      {tag}
                    </div>
                  )
                })}
              </div>

              <div
                className="review-answer-summary"
                style={{
                  marginTop: '0.85rem',
                  paddingTop: '0.65rem',
                  borderTop: '1px dashed var(--border)',
                  fontSize: '0.88rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem',
                }}
              >
                <div>
                  <strong>Your answer: </strong>
                  {q.selectedOption ? (
                    <span style={{ color: q.correct ? 'var(--green)' : 'var(--red)' }}>
                      Option {q.selectedOption} ({q.selectedOptionText})
                    </span>
                  ) : (
                    <span style={{ color: 'var(--amber)' }}>Unanswered</span>
                  )}
                </div>
                <div>
                  <strong>Correct answer: </strong>
                  <span style={{ color: 'var(--green)' }}>
                    Option {q.correctOption} ({q.correctOptionText})
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
