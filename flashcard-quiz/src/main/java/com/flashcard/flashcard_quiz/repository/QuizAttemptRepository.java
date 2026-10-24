
package com.flashcard.flashcard_quiz.repository;

import com.flashcard.flashcard_quiz.entity.QuizAttempt;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface QuizAttemptRepository extends JpaRepository<QuizAttempt, Long> {

    List<QuizAttempt> findByStudentId(Long studentId);

    Optional<QuizAttempt> findByStudentIdAndQuizId(Long studentId, Long quizId);
}
