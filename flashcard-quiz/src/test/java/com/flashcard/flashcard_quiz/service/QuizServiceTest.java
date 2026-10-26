package com.flashcard.flashcard_quiz.service;

import com.flashcard.flashcard_quiz.entity.Question;
import com.flashcard.flashcard_quiz.entity.Quiz;
import com.flashcard.flashcard_quiz.repository.QuestionRepository;
import com.flashcard.flashcard_quiz.repository.QuizAttemptRepository;
import com.flashcard.flashcard_quiz.repository.QuizRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class QuizServiceTest {

    @Mock
    private QuizRepository quizRepository;

    @Mock
    private QuestionRepository questionRepository;

    @Mock
    private QuizAttemptRepository quizAttemptRepository;

    @InjectMocks
    private QuizService quizService;

    private Quiz sampleQuiz;

    @BeforeEach
    void setUp() {
        sampleQuiz = new Quiz();
        sampleQuiz.setId(1L);
        sampleQuiz.setTitle("Original Title");
        sampleQuiz.setTopic("Original Topic");
        sampleQuiz.setQuizDate(LocalDate.of(2026, 10, 26));
        sampleQuiz.setPublished(false);
    }

    @Test
    void testUpdateQuiz_success() {
        when(quizRepository.findById(1L)).thenReturn(Optional.of(sampleQuiz));
        when(quizRepository.findByQuizDate(LocalDate.of(2026, 10, 27))).thenReturn(Optional.empty());
        when(quizRepository.save(any(Quiz.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Quiz updated = quizService.updateQuiz(1L, "New Title", "New Topic", LocalDate.of(2026, 10, 27));

        assertNotNull(updated);
        assertEquals("New Title", updated.getTitle());
        assertEquals("New Topic", updated.getTopic());
        assertEquals(LocalDate.of(2026, 10, 27), updated.getQuizDate());
        verify(quizRepository).save(sampleQuiz);
    }

    @Test
    void testUpdateQuiz_sameDate_success() {
        when(quizRepository.findById(1L)).thenReturn(Optional.of(sampleQuiz));
        when(quizRepository.findByQuizDate(LocalDate.of(2026, 10, 26))).thenReturn(Optional.of(sampleQuiz));
        when(quizRepository.save(any(Quiz.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Quiz updated = quizService.updateQuiz(1L, "Updated Title", "Updated Topic", LocalDate.of(2026, 10, 26));

        assertNotNull(updated);
        assertEquals("Updated Title", updated.getTitle());
        assertEquals(LocalDate.of(2026, 10, 26), updated.getQuizDate());
        verify(quizRepository).save(sampleQuiz);
    }

    @Test
    void testUpdateQuiz_dateConflict_throwsException() {
        Quiz conflictingQuiz = new Quiz();
        conflictingQuiz.setId(2L);
        conflictingQuiz.setQuizDate(LocalDate.of(2026, 10, 27));

        when(quizRepository.findById(1L)).thenReturn(Optional.of(sampleQuiz));
        when(quizRepository.findByQuizDate(LocalDate.of(2026, 10, 27))).thenReturn(Optional.of(conflictingQuiz));

        RuntimeException ex = assertThrows(RuntimeException.class, () ->
                quizService.updateQuiz(1L, "New Title", "New Topic", LocalDate.of(2026, 10, 27)));

        assertEquals("Quiz already exists for this date", ex.getMessage());
        verify(quizRepository, never()).save(any());
    }

    @Test
    void testUpdateQuiz_blankTitle_throwsException() {
        when(quizRepository.findById(1L)).thenReturn(Optional.of(sampleQuiz));

        RuntimeException ex = assertThrows(RuntimeException.class, () ->
                quizService.updateQuiz(1L, "   ", "New Topic", LocalDate.of(2026, 10, 26)));

        assertEquals("Quiz title is required", ex.getMessage());
        verify(quizRepository, never()).save(any());
    }

    @Test
    void testUpdateQuiz_notFound_throwsException() {
        when(quizRepository.findById(99L)).thenReturn(Optional.empty());

        RuntimeException ex = assertThrows(RuntimeException.class, () ->
                quizService.updateQuiz(99L, "Title", "Topic", LocalDate.of(2026, 10, 26)));

        assertEquals("Quiz not found", ex.getMessage());
    }

    @Test
    void testDeleteQuiz_success() {
        when(quizRepository.findById(1L)).thenReturn(Optional.of(sampleQuiz));
        when(quizAttemptRepository.existsByQuizId(1L)).thenReturn(false);

        Question q1 = new Question();
        q1.setId(10L);
        q1.setQuiz(sampleQuiz);
        List<Question> questions = List.of(q1);
        when(questionRepository.findByQuizId(1L)).thenReturn(questions);

        quizService.deleteQuiz(1L);

        verify(questionRepository).deleteAll(questions);
        verify(quizRepository).delete(sampleQuiz);
    }

    @Test
    void testDeleteQuiz_blockedWhenStudentAttemptsExist() {
        when(quizRepository.findById(1L)).thenReturn(Optional.of(sampleQuiz));
        when(quizAttemptRepository.existsByQuizId(1L)).thenReturn(true);

        RuntimeException ex = assertThrows(RuntimeException.class, () ->
                quizService.deleteQuiz(1L));

        assertEquals("Cannot delete quiz because students have submitted attempts", ex.getMessage());
        verify(questionRepository, never()).deleteAll(any());
        verify(quizRepository, never()).delete(any());
    }

    @Test
    void testDeleteQuiz_notFound_throwsException() {
        when(quizRepository.findById(99L)).thenReturn(Optional.empty());

        RuntimeException ex = assertThrows(RuntimeException.class, () ->
                quizService.deleteQuiz(99L));

        assertEquals("Quiz not found", ex.getMessage());
    }

    @Test
    void testUnpublishQuiz_success() {
        sampleQuiz.setPublished(true);
        when(quizRepository.findById(1L)).thenReturn(Optional.of(sampleQuiz));
        when(quizRepository.save(any(Quiz.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Quiz unpublished = quizService.unpublishQuiz(1L);

        assertNotNull(unpublished);
        assertFalse(unpublished.isPublished());
        verify(quizRepository).save(sampleQuiz);
    }

    @Test
    void testGetQuestion_success() {
        Question q = new Question();
        q.setId(10L);
        when(questionRepository.findById(10L)).thenReturn(Optional.of(q));

        Question res = quizService.getQuestion(10L);
        assertNotNull(res);
        assertEquals(10L, res.getId());
    }

    @Test
    void testUpdateQuestion_success() {
        Question q = new Question();
        q.setId(10L);
        q.setQuestionText("Old");
        when(questionRepository.findById(10L)).thenReturn(Optional.of(q));
        when(questionRepository.save(any(Question.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Question updated = quizService.updateQuestion(10L, "New Q", "A1", "B1", "C1", "D1", Question.CorrectOption.C);

        assertNotNull(updated);
        assertEquals("New Q", updated.getQuestionText());
        assertEquals("A1", updated.getOptionA());
        assertEquals(Question.CorrectOption.C, updated.getCorrectOption());
        verify(questionRepository).save(q);
    }

    @Test
    void testDeleteQuestion_success() {
        Question q = new Question();
        q.setId(10L);
        q.setQuiz(sampleQuiz);
        when(questionRepository.findById(10L)).thenReturn(Optional.of(q));
        when(quizAttemptRepository.existsByQuizId(1L)).thenReturn(false);

        quizService.deleteQuestion(10L);

        verify(questionRepository).delete(q);
    }

    @Test
    void testDeleteQuestion_blockedWhenAttemptsExist() {
        Question q = new Question();
        q.setId(10L);
        q.setQuiz(sampleQuiz);
        when(questionRepository.findById(10L)).thenReturn(Optional.of(q));
        when(quizAttemptRepository.existsByQuizId(1L)).thenReturn(true);

        RuntimeException ex = assertThrows(RuntimeException.class, () ->
                quizService.deleteQuestion(10L));

        assertTrue(ex.getMessage().contains("Cannot delete question because students have submitted attempts for this quiz"));
        verify(questionRepository, never()).delete(any());
    }

    @Test
    void testArchiveQuestion_success() {
        Question q = new Question();
        q.setId(10L);
        q.setArchived(false);
        when(questionRepository.findById(10L)).thenReturn(Optional.of(q));
        when(questionRepository.save(any(Question.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Question archived = quizService.archiveQuestion(10L);

        assertNotNull(archived);
        assertTrue(archived.isArchived());
        verify(questionRepository).save(q);
    }

    @Test
    void testUnarchiveQuestion_success() {
        Question q = new Question();
        q.setId(10L);
        q.setArchived(true);
        when(questionRepository.findById(10L)).thenReturn(Optional.of(q));
        when(questionRepository.save(any(Question.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Question unarchived = quizService.unarchiveQuestion(10L);

        assertNotNull(unarchived);
        assertFalse(unarchived.isArchived());
        verify(questionRepository).save(q);
    }

    @Test
    void testGetActiveQuestions_excludesArchived() {
        Question q1 = new Question();
        q1.setId(1L);
        q1.setArchived(false);

        when(questionRepository.findByQuizIdAndArchivedFalse(1L)).thenReturn(List.of(q1));

        List<Question> active = quizService.getActiveQuestions(1L);
        assertEquals(1, active.size());
        assertEquals(1L, active.get(0).getId());
    }
}

