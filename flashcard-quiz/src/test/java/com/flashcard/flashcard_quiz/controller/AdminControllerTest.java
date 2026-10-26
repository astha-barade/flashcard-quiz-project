package com.flashcard.flashcard_quiz.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.flashcard.flashcard_quiz.entity.Question;
import com.flashcard.flashcard_quiz.entity.Quiz;
import com.flashcard.flashcard_quiz.entity.User;
import com.flashcard.flashcard_quiz.service.AuthService;
import com.flashcard.flashcard_quiz.service.QuizAttemptService;
import com.flashcard.flashcard_quiz.service.QuizService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class AdminControllerTest {

    @Mock
    private QuizService quizService;

    @Mock
    private AuthService authService;

    @Mock
    private QuizAttemptService quizAttemptService;

    @InjectMocks
    private AdminController adminController;

    private MockMvc mockMvc;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(adminController).build();
        objectMapper = new ObjectMapper();
        objectMapper.registerModule(new JavaTimeModule());
    }

    @Test
    void testUpdateQuiz_success() throws Exception {
        Quiz quiz = new Quiz();
        quiz.setId(1L);
        quiz.setTitle("Updated Title");
        quiz.setTopic("Updated Topic");
        quiz.setQuizDate(LocalDate.of(2026, 10, 26));

        when(quizService.updateQuiz(eq(1L), eq("Updated Title"), eq("Updated Topic"), eq(LocalDate.of(2026, 10, 26))))
                .thenReturn(quiz);

        Map<String, Object> body = Map.of(
                "title", "Updated Title",
                "topic", "Updated Topic",
                "quizDate", "2026-10-26"
        );

        mockMvc.perform(put("/api/admin/quizzes/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Quiz updated successfully"))
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.title").value("Updated Title"))
                .andExpect(jsonPath("$.topic").value("Updated Topic"));

        verify(quizService).updateQuiz(eq(1L), eq("Updated Title"), eq("Updated Topic"), eq(LocalDate.of(2026, 10, 26)));
    }

    @Test
    void testDeleteQuiz_success() throws Exception {
        doNothing().when(quizService).deleteQuiz(1L);

        mockMvc.perform(delete("/api/admin/quizzes/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Quiz deleted successfully"))
                .andExpect(jsonPath("$.quizId").value(1));

        verify(quizService).deleteQuiz(1L);
    }

    @Test
    void testUnpublishQuiz_success() throws Exception {
        Quiz quiz = new Quiz();
        quiz.setId(1L);
        quiz.setPublished(false);
        when(quizService.unpublishQuiz(1L)).thenReturn(quiz);

        mockMvc.perform(post("/api/admin/quizzes/1/unpublish"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Quiz unpublished successfully"))
                .andExpect(jsonPath("$.quizId").value(1));

        verify(quizService).unpublishQuiz(1L);
    }

    @Test
    void testGetQuizQuestions_success() throws Exception {
        Question q = new Question();
        q.setId(10L);
        q.setQuestionText("What is Java?");
        q.setOptionA("A language");
        q.setOptionB("An OS");
        q.setOptionC("Coffee");
        q.setOptionD("Island");
        q.setCorrectOption(Question.CorrectOption.A);

        when(quizService.getQuestions(1L)).thenReturn(List.of(q));

        mockMvc.perform(get("/api/admin/quizzes/1/questions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(10))
                .andExpect(jsonPath("$[0].questionText").value("What is Java?"))
                .andExpect(jsonPath("$[0].correctOption").value("A"));

        verify(quizService).getQuestions(1L);
    }

    @Test
    void testUpdateQuestion_success() throws Exception {
        Question q = new Question();
        q.setId(10L);
        q.setQuestionText("Updated text");
        q.setOptionA("1");
        q.setOptionB("2");
        q.setOptionC("3");
        q.setOptionD("4");
        q.setCorrectOption(Question.CorrectOption.B);

        when(quizService.updateQuestion(eq(10L), eq("Updated text"), eq("1"), eq("2"), eq("3"), eq("4"), eq(Question.CorrectOption.B)))
                .thenReturn(q);

        Map<String, Object> body = Map.of(
                "questionText", "Updated text",
                "optionA", "1",
                "optionB", "2",
                "optionC", "3",
                "optionD", "4",
                "correctOption", "B"
        );

        mockMvc.perform(put("/api/admin/questions/10")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Question updated successfully"))
                .andExpect(jsonPath("$.question.questionText").value("Updated text"));

        verify(quizService).updateQuestion(eq(10L), eq("Updated text"), eq("1"), eq("2"), eq("3"), eq("4"), eq(Question.CorrectOption.B));
    }

    @Test
    void testDeleteQuestion_success() throws Exception {
        doNothing().when(quizService).deleteQuestion(10L);

        mockMvc.perform(delete("/api/admin/questions/10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Question deleted successfully"))
                .andExpect(jsonPath("$.questionId").value(10));

        verify(quizService).deleteQuestion(10L);
    }

    @Test
    void testGetAnalytics_success() throws Exception {
        when(quizAttemptService.getAdminAnalytics()).thenReturn(Map.of(
                "totalQuizzes", 5,
                "publishedQuizzes", 3,
                "draftQuizzes", 2,
                "totalAttempts", 12
        ));

        mockMvc.perform(get("/api/admin/analytics"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalQuizzes").value(5))
                .andExpect(jsonPath("$.totalAttempts").value(12));

        verify(quizAttemptService).getAdminAnalytics();
    }

    @Test
    void testGetAllAttempts_success() throws Exception {
        when(quizAttemptService.getAllAttemptsForAdmin()).thenReturn(List.of(
                Map.of("attemptId", 1, "studentName", "Student 1", "score", 8, "totalQuestions", 10)
        ));

        mockMvc.perform(get("/api/admin/attempts"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].attemptId").value(1))
                .andExpect(jsonPath("$[0].studentName").value("Student 1"));

        verify(quizAttemptService).getAllAttemptsForAdmin();
    }

    @Test
    void testCreateAdmin_success() throws Exception {
        User admin = new User();
        admin.setId(5L);
        admin.setName("New Admin");
        admin.setEmail("newadmin@test.com");
        admin.setRole(User.Role.ADMIN);

        when(authService.createAdmin("New Admin", "newadmin@test.com", "pass123"))
                .thenReturn(admin);

        Map<String, String> body = Map.of(
                "name", "New Admin",
                "email", "newadmin@test.com",
                "password", "pass123"
        );

        mockMvc.perform(post("/api/admin/admins")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Admin account created successfully"))
                .andExpect(jsonPath("$.id").value(5))
                .andExpect(jsonPath("$.role").value("ADMIN"));

        verify(authService).createAdmin("New Admin", "newadmin@test.com", "pass123");
    }

    @Test
    void testArchiveQuestion_success() throws Exception {
        Question q = new Question();
        q.setId(10L);
        q.setQuestionText("Archived Q");
        q.setArchived(true);

        when(quizService.archiveQuestion(10L)).thenReturn(q);

        mockMvc.perform(post("/api/admin/questions/10/archive"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Question archived successfully"))
                .andExpect(jsonPath("$.question.id").value(10))
                .andExpect(jsonPath("$.question.archived").value(true));

        verify(quizService).archiveQuestion(10L);
    }

    @Test
    void testUnarchiveQuestion_success() throws Exception {
        Question q = new Question();
        q.setId(10L);
        q.setQuestionText("Unarchived Q");
        q.setArchived(false);

        when(quizService.unarchiveQuestion(10L)).thenReturn(q);

        mockMvc.perform(post("/api/admin/questions/10/unarchive"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Question unarchived successfully"))
                .andExpect(jsonPath("$.question.id").value(10))
                .andExpect(jsonPath("$.question.archived").value(false));

        verify(quizService).unarchiveQuestion(10L);
    }

    @Test
    void testDeleteQuestion_blockedWhenAttemptsExist() throws Exception {
        doThrow(new RuntimeException("Cannot delete question because students have submitted attempts for this quiz. Please archive the question instead."))
                .when(quizService).deleteQuestion(10L);

        mockMvc.perform(delete("/api/admin/questions/10"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Cannot delete question because students have submitted attempts for this quiz. Please archive the question instead."));

        verify(quizService).deleteQuestion(10L);
    }
}
