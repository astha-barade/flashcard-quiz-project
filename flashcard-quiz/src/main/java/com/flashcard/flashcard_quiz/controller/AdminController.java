package com.flashcard.flashcard_quiz.controller;

import com.flashcard.flashcard_quiz.entity.Question;
import com.flashcard.flashcard_quiz.entity.Quiz;
import com.flashcard.flashcard_quiz.entity.User;
import com.flashcard.flashcard_quiz.service.AuthService;
import com.flashcard.flashcard_quiz.service.QuizAttemptService;
import com.flashcard.flashcard_quiz.service.QuizService;
import lombok.Getter;
import lombok.Setter;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@CrossOrigin(origins = {"http://localhost:5173", "http://localhost:5174", "http://localhost:5175", "http://localhost:5176"})
public class AdminController {

    private final QuizService quizService;
    private final AuthService authService;
    private final QuizAttemptService quizAttemptService;

    public AdminController(
            QuizService quizService,
            AuthService authService,
            QuizAttemptService quizAttemptService) {
        this.quizService = quizService;
        this.authService = authService;
        this.quizAttemptService = quizAttemptService;
    }

    @Getter
    @Setter
    public static class CreateQuizRequest {
        private String title;
        private String topic;
        private LocalDate quizDate;
        private Long adminId;
    }

    @Getter
    @Setter
    public static class CreateQuestionRequest {
        private Long quizId;
        private String questionText;
        private String optionA;
        private String optionB;
        private String optionC;
        private String optionD;
        private Question.CorrectOption correctOption;
    }

    @Getter
    @Setter
    public static class UpdateQuestionRequest {
        private String questionText;
        private String optionA;
        private String optionB;
        private String optionC;
        private String optionD;
        private Question.CorrectOption correctOption;
    }

    @Getter
    @Setter
    public static class UpdateQuizRequest {
        private String title;
        private String topic;
        private LocalDate quizDate;
    }

    @Getter
    @Setter
    public static class CreateAdminRequest {
        private String name;
        private String email;
        private String password;
    }

    private Map<String, Object> questionToMap(Question q) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", q.getId());
        map.put("quizId", q.getQuiz() != null ? q.getQuiz().getId() : null);
        map.put("questionText", q.getQuestionText());
        map.put("optionA", q.getOptionA());
        map.put("optionB", q.getOptionB());
        map.put("optionC", q.getOptionC());
        map.put("optionD", q.getOptionD());
        map.put("correctOption", q.getCorrectOption() != null ? q.getCorrectOption().name() : null);
        map.put("archived", q.isArchived());
        boolean hasAttempts = q.getQuiz() != null && quizService.hasAttempts(q.getQuiz().getId());
        map.put("hasAttempts", hasAttempts);
        return map;
    }

    @GetMapping("/quizzes")
    public ResponseEntity<?> getAllQuizzes() {
        try {
            List<Map<String, Object>> result = quizService.getAllQuizzes().stream().map(q -> {
                Map<String, Object> map = new HashMap<>();
                map.put("id", q.getId());
                map.put("title", q.getTitle());
                map.put("topic", q.getTopic());
                map.put("quizDate", q.getQuizDate());
                map.put("published", q.isPublished());
                map.put("questionsAdded", quizService.getActiveQuestions(q.getId()).size());
                map.put("totalQuestions", quizService.getQuestions(q.getId()).size());
                map.put("hasAttempts", quizService.hasAttempts(q.getId()));
                return map;
            }).toList();

            return ResponseEntity.ok(result);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/quizzes")
    public ResponseEntity<?> createQuiz(
            @RequestBody CreateQuizRequest request) {
        try {
            User admin = new User();
            admin.setId(request.getAdminId());

            Quiz quiz = quizService.createQuiz(
                    request.getTitle(),
                    request.getTopic(),
                    request.getQuizDate(),
                    admin
            );

            return ResponseEntity.ok(quiz);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/questions")
    public ResponseEntity<?> addQuestion(
            @RequestBody CreateQuestionRequest request) {
        try {
            Quiz quiz = new Quiz();
            quiz.setId(request.getQuizId());

            Question question = new Question();
            question.setQuiz(quiz);
            question.setQuestionText(request.getQuestionText());
            question.setOptionA(request.getOptionA());
            question.setOptionB(request.getOptionB());
            question.setOptionC(request.getOptionC());
            question.setOptionD(request.getOptionD());
            question.setCorrectOption(request.getCorrectOption());

            Question saved = quizService.addQuestion(question);
            return ResponseEntity.ok(Map.of("id", saved.getId()));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/quizzes/{id}/questions")
    public ResponseEntity<?> getQuizQuestions(@PathVariable Long id) {
        try {
            if (id == null || id <= 0) {
                return ResponseEntity.badRequest().body(Map.of("error", "Invalid quiz ID"));
            }
            List<Map<String, Object>> questions = quizService.getQuestions(id).stream()
                    .map(this::questionToMap)
                    .toList();
            return ResponseEntity.ok(questions);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/questions/{id}")
    public ResponseEntity<?> getQuestion(@PathVariable Long id) {
        try {
            if (id == null || id <= 0) {
                return ResponseEntity.badRequest().body(Map.of("error", "Invalid question ID"));
            }
            Question question = quizService.getQuestion(id);
            return ResponseEntity.ok(questionToMap(question));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/questions/{id}")
    public ResponseEntity<?> updateQuestion(
            @PathVariable Long id,
            @RequestBody UpdateQuestionRequest request) {
        try {
            if (id == null || id <= 0) {
                return ResponseEntity.badRequest().body(Map.of("error", "Invalid question ID"));
            }
            if (request == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "Request body is required"));
            }
            Question updated = quizService.updateQuestion(
                    id,
                    request.getQuestionText(),
                    request.getOptionA(),
                    request.getOptionB(),
                    request.getOptionC(),
                    request.getOptionD(),
                    request.getCorrectOption()
            );
            return ResponseEntity.ok(Map.of(
                    "message", "Question updated successfully",
                    "question", questionToMap(updated)
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/questions/{id}")
    public ResponseEntity<?> deleteQuestion(@PathVariable Long id) {
        try {
            if (id == null || id <= 0) {
                return ResponseEntity.badRequest().body(Map.of("error", "Invalid question ID"));
            }
            quizService.deleteQuestion(id);
            return ResponseEntity.ok(Map.of(
                    "message", "Question deleted successfully",
                    "questionId", id
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/questions/{id}/archive")
    public ResponseEntity<?> archiveQuestion(@PathVariable Long id) {
        try {
            if (id == null || id <= 0) {
                return ResponseEntity.badRequest().body(Map.of("error", "Invalid question ID"));
            }
            Question question = quizService.archiveQuestion(id);
            return ResponseEntity.ok(Map.of(
                    "message", "Question archived successfully",
                    "question", questionToMap(question)
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/questions/{id}/archive")
    public ResponseEntity<?> archiveQuestionPut(@PathVariable Long id) {
        return archiveQuestion(id);
    }

    @PostMapping("/questions/{id}/unarchive")
    public ResponseEntity<?> unarchiveQuestion(@PathVariable Long id) {
        try {
            if (id == null || id <= 0) {
                return ResponseEntity.badRequest().body(Map.of("error", "Invalid question ID"));
            }
            Question question = quizService.unarchiveQuestion(id);
            return ResponseEntity.ok(Map.of(
                    "message", "Question unarchived successfully",
                    "question", questionToMap(question)
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/quizzes/{id}")
    public ResponseEntity<?> updateQuiz(
            @PathVariable Long id,
            @RequestBody UpdateQuizRequest request) {
        try {
            if (id == null || id <= 0) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "Invalid quiz ID"));
            }
            if (request == null) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "Request body is required"));
            }

            Quiz quiz = quizService.updateQuiz(
                    id,
                    request.getTitle(),
                    request.getTopic(),
                    request.getQuizDate()
            );

            return ResponseEntity.ok(Map.of(
                    "message", "Quiz updated successfully",
                    "id", quiz.getId(),
                    "title", quiz.getTitle(),
                    "topic", quiz.getTopic(),
                    "quizDate", quiz.getQuizDate()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/quizzes/{id}")
    public ResponseEntity<?> deleteQuiz(@PathVariable Long id) {
        try {
            if (id == null || id <= 0) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "Invalid quiz ID"));
            }

            quizService.deleteQuiz(id);

            return ResponseEntity.ok(Map.of(
                    "message", "Quiz deleted successfully",
                    "quizId", id
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/quizzes/{id}/publish")
    public ResponseEntity<?> publishQuiz(@PathVariable Long id) {
        try {
            Quiz quiz = quizService.publishQuiz(id);
            return ResponseEntity.ok(Map.of(
                    "message", "Quiz published successfully",
                    "quizId", quiz.getId()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/quizzes/{id}/unpublish")
    public ResponseEntity<?> unpublishQuiz(@PathVariable Long id) {
        try {
            if (id == null || id <= 0) {
                return ResponseEntity.badRequest().body(Map.of("error", "Invalid quiz ID"));
            }
            Quiz quiz = quizService.unpublishQuiz(id);
            return ResponseEntity.ok(Map.of(
                    "message", "Quiz unpublished successfully",
                    "quizId", quiz.getId()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/analytics")
    public ResponseEntity<?> getAnalytics() {
        try {
            return ResponseEntity.ok(quizAttemptService.getAdminAnalytics());
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/attempts")
    public ResponseEntity<?> getAllAttempts() {
        try {
            return ResponseEntity.ok(quizAttemptService.getAllAttemptsForAdmin());
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/attempts/{id}")
    public ResponseEntity<?> getAttemptReview(@PathVariable Long id) {
        try {
            if (id == null || id <= 0) {
                return ResponseEntity.badRequest().body(Map.of("error", "Invalid attempt ID"));
            }
            return ResponseEntity.ok(quizAttemptService.getAttemptReview(id, null));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/admins")
    public ResponseEntity<?> createAdmin(@RequestBody CreateAdminRequest request) {
        try {
            if (request == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "Request body is required"));
            }
            User admin = authService.createAdmin(
                    request.getName(),
                    request.getEmail(),
                    request.getPassword()
            );
            return ResponseEntity.ok(Map.of(
                    "message", "Admin account created successfully",
                    "id", admin.getId(),
                    "name", admin.getName(),
                    "email", admin.getEmail(),
                    "role", admin.getRole().name()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}

