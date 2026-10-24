package com.flashcard.flashcard_quiz.service;

import com.flashcard.flashcard_quiz.entity.Question;
import com.flashcard.flashcard_quiz.entity.Quiz;
import com.flashcard.flashcard_quiz.entity.QuizAttempt;
import com.flashcard.flashcard_quiz.entity.User;
import com.flashcard.flashcard_quiz.repository.QuestionRepository;
import com.flashcard.flashcard_quiz.repository.QuizAttemptRepository;
import com.flashcard.flashcard_quiz.repository.QuizRepository;
import com.flashcard.flashcard_quiz.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Transactional
class QuizAttemptServiceTest {

    @Autowired
    private QuizAttemptService quizAttemptService;

    @Autowired
    private QuizRepository quizRepository;

    @Autowired
    private QuestionRepository questionRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private QuizAttemptRepository quizAttemptRepository;

    @Test
    void testSubmitQuizAndGetReview() {
        // Create student
        User student = new User();
        student.setName("Integration Test Student");
        student.setEmail("integration.student." + System.currentTimeMillis() + "@test.com");
        student.setPassword("secret");
        student.setRole(User.Role.STUDENT);
        final User savedStudent = userRepository.save(student);

        // Create quiz
        Quiz quiz = new Quiz();
        quiz.setTitle("Integration Test Quiz");
        quiz.setTopic("Testing");
        quiz.setQuizDate(LocalDate.now().plusDays(100)); // Future unique date
        quiz.setPublished(true);
        final Quiz savedQuiz = quizRepository.save(quiz);

        // Add 2 questions for this test
        Question q1 = new Question();
        q1.setQuiz(savedQuiz);
        q1.setQuestionText("What is 2+2?");
        q1.setOptionA("3");
        q1.setOptionB("4");
        q1.setOptionC("5");
        q1.setOptionD("6");
        q1.setCorrectOption(Question.CorrectOption.B);
        final Question savedQ1 = questionRepository.save(q1);

        Question q2 = new Question();
        q2.setQuiz(savedQuiz);
        q2.setQuestionText("Capital of France?");
        q2.setOptionA("London");
        q2.setOptionB("Berlin");
        q2.setOptionC("Paris");
        q2.setOptionD("Madrid");
        q2.setCorrectOption(Question.CorrectOption.C);
        final Question savedQ2 = questionRepository.save(q2);

        // Submit answers: q1 correct (B), q2 unanswered (null)
        Map<String, String> answers = new HashMap<>();
        answers.put(String.valueOf(savedQ1.getId()), "B");

        QuizAttempt attempt = quizAttemptService.submitQuiz(savedStudent.getId(), savedQuiz.getId(), answers);

        assertNotNull(attempt);
        assertNotNull(attempt.getId());
        assertEquals(1, attempt.getScore());
        assertEquals(2, attempt.getTotalQuestions());

        final Long studentId = savedStudent.getId();
        final Long quizId = savedQuiz.getId();

        // Test duplicate submission is blocked
        assertThrows(RuntimeException.class, () ->
                quizAttemptService.submitQuiz(studentId, quizId, answers));

        // Test retrieving review
        Map<String, Object> review = quizAttemptService.getAttemptReview(attempt.getId(), savedStudent.getId());
        assertNotNull(review);
        assertEquals(1, review.get("score"));
        assertEquals(2, review.get("totalQuestions"));
        assertEquals(50.0, review.get("percentage"));
        assertEquals("Integration Test Quiz", review.get("quizTitle"));
        assertTrue((Boolean) review.get("hasDetailedReview"));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> questions = (List<Map<String, Object>>) review.get("questions");
        assertEquals(2, questions.size());

        Map<String, Object> rev1 = questions.get(0);
        assertEquals("B", rev1.get("selectedOption"));
        assertEquals("4", rev1.get("selectedOptionText"));
        assertEquals("B", rev1.get("correctOption"));
        assertEquals("4", rev1.get("correctOptionText"));
        assertTrue((Boolean) rev1.get("correct"));

        Map<String, Object> rev2 = questions.get(1);
        assertNull(rev2.get("selectedOption"));
        assertNull(rev2.get("selectedOptionText"));
        assertEquals("C", rev2.get("correctOption"));
        assertEquals("Paris", rev2.get("correctOptionText"));
        assertFalse((Boolean) rev2.get("correct"));

        // Test denying access to another student
        User anotherStudent = new User();
        anotherStudent.setName("Another Student");
        anotherStudent.setEmail("another." + System.currentTimeMillis() + "@test.com");
        anotherStudent.setPassword("secret");
        anotherStudent.setRole(User.Role.STUDENT);
        final User savedAnother = userRepository.save(anotherStudent);

        final Long anotherId = savedAnother.getId();
        final Long attemptId = attempt.getId();
        assertThrows(SecurityException.class, () ->
                quizAttemptService.getAttemptReview(attemptId, anotherId));
    }
}
