package com.flashcard.flashcard_quiz.repository;

import com.flashcard.flashcard_quiz.entity.StudentAnswer;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface StudentAnswerRepository extends JpaRepository<StudentAnswer, Long> {

    List<StudentAnswer> findByAttemptId(Long attemptId);

    List<StudentAnswer> findByAttemptIdOrderByIdAsc(Long attemptId);
}
