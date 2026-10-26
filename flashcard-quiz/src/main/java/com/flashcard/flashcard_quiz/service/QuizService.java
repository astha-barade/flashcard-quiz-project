
package com.flashcard.flashcard_quiz.service;

import com.flashcard.flashcard_quiz.entity.Question;
import com.flashcard.flashcard_quiz.entity.Quiz;
import com.flashcard.flashcard_quiz.entity.User;
import com.flashcard.flashcard_quiz.repository.QuestionRepository;
import com.flashcard.flashcard_quiz.repository.QuizRepository;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.stereotype.Service;
import com.flashcard.flashcard_quiz.repository.QuizAttemptRepository;

import java.time.LocalDate;
import java.util.List;


@Service
public class QuizService {

    private final QuizRepository quizRepository;
    private final QuestionRepository questionRepository;
    private final QuizAttemptRepository quizAttemptRepository;

    public QuizService(
            QuizRepository quizRepository,
            QuestionRepository questionRepository,
            QuizAttemptRepository quizAttemptRepository) {

        this.quizRepository = quizRepository;
        this.questionRepository = questionRepository;
        this.quizAttemptRepository = quizAttemptRepository;
    }

    public Quiz createQuiz(String title, String topic,
                           LocalDate quizDate, User admin) {
        if (quizRepository.findByQuizDate(quizDate).isPresent()) {
            throw new RuntimeException("Quiz already exists for this date");
        }

        Quiz quiz = new Quiz();
        quiz.setTitle(title);
        quiz.setTopic(topic);
        quiz.setQuizDate(quizDate);
        quiz.setCreatedBy(admin);
        quiz.setPublished(false);

        return quizRepository.save(quiz);
    }

    public Question addQuestion(Question question) {
        if (question.getQuiz() == null ||
                question.getQuiz().getId() == null) {
            throw new RuntimeException("A valid quiz is required");
        }

        return questionRepository.save(question);
    }


    public Quiz publishQuiz(Long quizId) {
        Quiz quiz = quizRepository.findById(quizId)
                .orElseThrow(() -> new RuntimeException("Quiz not found"));

        List<Question> questions = questionRepository.findByQuizIdAndArchivedFalse(quizId);

        if (questions.size() != 10) {
            throw new RuntimeException(
                    "A quiz must contain exactly 10 questions before publishing. Current count: "
                            + questions.size()
            );
        }

        quiz.setPublished(true);
        return quizRepository.save(quiz);
    }

    @Transactional
    public Quiz unpublishQuiz(Long quizId) {
        if (quizId == null || quizId <= 0) {
            throw new RuntimeException("Invalid quiz ID");
        }

        Quiz quiz = quizRepository.findById(quizId)
                .orElseThrow(() -> new RuntimeException("Quiz not found"));

        quiz.setPublished(false);
        return quizRepository.save(quiz);
    }

    public List<Question> getQuestions(Long quizId) {
        return questionRepository.findByQuizId(quizId);
    }

    public List<Question> getActiveQuestions(Long quizId) {
        if (quizId == null || quizId <= 0) {
            return List.of();
        }
        return questionRepository.findByQuizIdAndArchivedFalse(quizId);
    }

    public boolean hasAttempts(Long quizId) {
        if (quizId == null || quizId <= 0) {
            return false;
        }
        return quizAttemptRepository.existsByQuizId(quizId);
    }

    public Question getQuestion(Long questionId) {
        if (questionId == null || questionId <= 0) {
            throw new RuntimeException("Invalid question ID");
        }
        return questionRepository.findById(questionId)
                .orElseThrow(() -> new RuntimeException("Question not found"));
    }

    @Transactional
    public Question updateQuestion(Long questionId, String questionText,
                                   String optionA, String optionB, String optionC, String optionD,
                                   Question.CorrectOption correctOption) {
        if (questionId == null || questionId <= 0) {
            throw new RuntimeException("Invalid question ID");
        }
        Question question = questionRepository.findById(questionId)
                .orElseThrow(() -> new RuntimeException("Question not found"));

        if (questionText == null || questionText.isBlank()) {
            throw new RuntimeException("Question text is required");
        }
        if (optionA == null || optionA.isBlank()) {
            throw new RuntimeException("Option A is required");
        }
        if (optionB == null || optionB.isBlank()) {
            throw new RuntimeException("Option B is required");
        }
        if (optionC == null || optionC.isBlank()) {
            throw new RuntimeException("Option C is required");
        }
        if (optionD == null || optionD.isBlank()) {
            throw new RuntimeException("Option D is required");
        }
        if (correctOption == null) {
            throw new RuntimeException("Correct option is required");
        }

        question.setQuestionText(questionText.trim());
        question.setOptionA(optionA.trim());
        question.setOptionB(optionB.trim());
        question.setOptionC(optionC.trim());
        question.setOptionD(optionD.trim());
        question.setCorrectOption(correctOption);

        return questionRepository.save(question);
    }

    @Transactional
    public Question archiveQuestion(Long questionId) {
        if (questionId == null || questionId <= 0) {
            throw new RuntimeException("Invalid question ID");
        }
        Question question = questionRepository.findById(questionId)
                .orElseThrow(() -> new RuntimeException("Question not found"));

        question.setArchived(true);
        return questionRepository.save(question);
    }

    @Transactional
    public Question unarchiveQuestion(Long questionId) {
        if (questionId == null || questionId <= 0) {
            throw new RuntimeException("Invalid question ID");
        }
        Question question = questionRepository.findById(questionId)
                .orElseThrow(() -> new RuntimeException("Question not found"));

        question.setArchived(false);
        return questionRepository.save(question);
    }

    @Transactional
    public void deleteQuestion(Long questionId) {
        if (questionId == null || questionId <= 0) {
            throw new RuntimeException("Invalid question ID");
        }
        Question question = questionRepository.findById(questionId)
                .orElseThrow(() -> new RuntimeException("Question not found"));

        if (question.getQuiz() != null && quizAttemptRepository.existsByQuizId(question.getQuiz().getId())) {
            throw new RuntimeException("Cannot delete question because students have submitted attempts for this quiz. Please archive the question instead.");
        }

        questionRepository.delete(question);
    }


    @Transactional
    public Quiz updateQuiz(Long quizId, String title, String topic,
                           LocalDate quizDate) {

        if (quizId == null || quizId <= 0) {
            throw new RuntimeException("Invalid quiz ID");
        }

        Quiz quiz = quizRepository.findById(quizId)
                .orElseThrow(() -> new RuntimeException("Quiz not found"));

        if (title == null || title.isBlank()) {
            throw new RuntimeException("Quiz title is required");
        }

        if (topic == null || topic.isBlank()) {
            throw new RuntimeException("Quiz topic is required");
        }

        if (quizDate == null) {
            throw new RuntimeException("Quiz date is required");
        }

        quizRepository.findByQuizDate(quizDate).ifPresent(existingQuiz -> {
            if (!existingQuiz.getId().equals(quizId)) {
                throw new RuntimeException("Quiz already exists for this date");
            }
        });

        quiz.setTitle(title.trim());
        quiz.setTopic(topic.trim());
        quiz.setQuizDate(quizDate);

        return quizRepository.save(quiz);
    }

    @Transactional
    public void deleteQuiz(Long quizId) {

        if (quizId == null || quizId <= 0) {
            throw new RuntimeException("Invalid quiz ID");
        }

        Quiz quiz = quizRepository.findById(quizId)
                .orElseThrow(() ->
                        new RuntimeException("Quiz not found"));

        if (quizAttemptRepository.existsByQuizId(quizId)) {
            throw new RuntimeException(
                    "Cannot delete quiz because students have submitted attempts"
            );
        }

        questionRepository.deleteAll(
                questionRepository.findByQuizId(quizId)
        );

        quizRepository.delete(quiz);
    }

    public List<Quiz> getAllQuizzes() {
        return quizRepository.findAllByOrderByQuizDateDesc();
    }

    @Transactional(readOnly = true)
    public Quiz getTodayQuiz() {
        Quiz quiz = quizRepository.findByQuizDate(LocalDate.now())
                .orElseThrow(() ->
                        new RuntimeException("Today's quiz is not available"));

        if (!quiz.isPublished()) {
            throw new RuntimeException("Today's quiz is not published");
        }

        return quiz;
    }
}
