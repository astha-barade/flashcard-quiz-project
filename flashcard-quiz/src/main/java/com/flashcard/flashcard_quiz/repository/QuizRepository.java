
package com.flashcard.flashcard_quiz.repository;

import com.flashcard.flashcard_quiz.entity.Quiz;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;


public interface QuizRepository extends JpaRepository<Quiz, Long> {

    Optional<Quiz> findByQuizDate(LocalDate quizDate);
    List<Quiz> findAllByOrderByQuizDateDesc();
}
