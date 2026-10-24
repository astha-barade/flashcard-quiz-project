
package com.flashcard.flashcard_quiz.service;

import com.flashcard.flashcard_quiz.entity.Question;
import com.flashcard.flashcard_quiz.entity.Quiz;
import com.flashcard.flashcard_quiz.entity.User;
import com.flashcard.flashcard_quiz.repository.QuestionRepository;
import com.flashcard.flashcard_quiz.repository.QuizRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Service
public class QuizService {

    private final QuizRepository quizRepository;
    private final QuestionRepository questionRepository;

    public QuizService(
            QuizRepository quizRepository,
            QuestionRepository questionRepository) {
        this.quizRepository = quizRepository;
        this.questionRepository = questionRepository;
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

        List<Question> questions = questionRepository.findByQuizId(quizId);

        if (questions.size() != 10) {
            throw new RuntimeException(
                    "A quiz must contain exactly 10 questions before publishing. Current count: "
                            + questions.size()
            );
        }

        quiz.setPublished(true);
        return quizRepository.save(quiz);
    }


    public List<Question> getQuestions(Long quizId) {
        return questionRepository.findByQuizId(quizId);
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
