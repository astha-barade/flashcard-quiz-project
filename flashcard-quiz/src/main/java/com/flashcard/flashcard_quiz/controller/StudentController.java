package com.flashcard.flashcard_quiz.controller;

import com.flashcard.flashcard_quiz.entity.Quiz;
import com.flashcard.flashcard_quiz.entity.QuizAttempt;
import com.flashcard.flashcard_quiz.entity.User;
import com.flashcard.flashcard_quiz.repository.UserRepository;
import com.flashcard.flashcard_quiz.service.QuizAttemptService;
import com.flashcard.flashcard_quiz.service.QuizService;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/student")
@CrossOrigin(origins = "http://localhost:5173")
public class StudentController {

    private final QuizService quizService;
    private final QuizAttemptService attemptService;
    private final UserRepository userRepository;

    public StudentController(
            QuizService quizService,
            QuizAttemptService attemptService,
            UserRepository userRepository) {
        this.quizService = quizService;
        this.attemptService = attemptService;
        this.userRepository = userRepository;
    }

    // Get today's published quiz
    @GetMapping("/quiz/today")
    public ResponseEntity<?> getTodayQuiz() {
        try {
            Quiz quiz = quizService.getTodayQuiz();

            List<Map<String, Object>> questions =
                    quizService.getQuestions(quiz.getId())
                            .stream()
                            .map(q -> {
                                Map<String, Object> question =
                                        new HashMap<>();

                                question.put("id", q.getId());
                                question.put(
                                        "questionText",
                                        q.getQuestionText()
                                );
                                question.put("optionA", q.getOptionA());
                                question.put("optionB", q.getOptionB());
                                question.put("optionC", q.getOptionC());
                                question.put("optionD", q.getOptionD());

                                return question;
                            })
                            .toList();

            Map<String, Object> response = new HashMap<>();
            response.put("id", quiz.getId());
            response.put("title", quiz.getTitle());
            response.put("topic", quiz.getTopic());
            response.put("quizDate", quiz.getQuizDate());
            response.put("questions", questions);

            return ResponseEntity.ok(response);

        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage()));
        }
    }

    // Submit quiz
    @PostMapping("/quiz/{quizId}/submit")
    public ResponseEntity<?> submitQuiz(
            @PathVariable Long quizId,
            @RequestParam Long studentId,
            @RequestBody(required = false) Map<String, Object> answers,
            Principal principal) {
        try {
            if (principal != null) {
                User authUser = userRepository.findByEmail(principal.getName()).orElse(null);
                if (authUser != null && !authUser.getId().equals(studentId)) {
                    return ResponseEntity.status(HttpStatus.FORBIDDEN)
                            .body(Map.of("error", "Access denied: Cannot submit quiz for another student"));
                }
            }

            QuizAttempt attempt = attemptService.submitQuiz(
                    studentId,
                    quizId,
                    answers
            );

            Map<String, Object> response = new HashMap<>();
            response.put("attemptId", attempt.getId());
            response.put("score", attempt.getScore());
            response.put(
                    "totalQuestions",
                    attempt.getTotalQuestions()
            );
            response.put(
                    "message",
                    "Quiz submitted successfully"
            );

            return ResponseEntity.ok(response);

        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage()));
        }
    }

    // Get student's previous attempts
    @GetMapping("/attempts")
    public ResponseEntity<?> getAttempts(
            @RequestParam Long studentId,
            Principal principal) {
        try {
            if (principal != null) {
                User authUser = userRepository.findByEmail(principal.getName()).orElse(null);
                if (authUser != null && !authUser.getId().equals(studentId)) {
                    return ResponseEntity.status(HttpStatus.FORBIDDEN)
                            .body(Map.of("error", "Access denied: Cannot view another student's attempts"));
                }
            }

            return ResponseEntity.ok(
                    attemptService.getStudentAttempts(studentId)
            );

        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage()));
        }
    }

    // Get single attempt details / review
    @GetMapping("/attempts/{attemptId}")
    public ResponseEntity<?> getAttemptDetails(
            @PathVariable Long attemptId,
            @RequestParam(required = false) Long studentId,
            Principal principal) {
        try {
            Long effectiveStudentId = studentId;
            if (principal != null) {
                User authUser = userRepository.findByEmail(principal.getName()).orElse(null);
                if (authUser != null) {
                    if (studentId != null && !studentId.equals(authUser.getId())) {
                        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                                .body(Map.of("error", "Access denied: You cannot view another student's attempt"));
                    }
                    effectiveStudentId = authUser.getId();
                }
            }

            Map<String, Object> details = attemptService.getAttemptReview(attemptId, effectiveStudentId);
            return ResponseEntity.ok(details);

        } catch (SecurityException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", e.getMessage()));
        } catch (RuntimeException e) {
            if (e.getMessage() != null && e.getMessage().toLowerCase().contains("access denied")) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("error", e.getMessage()));
            }
            if (e.getMessage() != null && e.getMessage().toLowerCase().contains("not found")) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("error", e.getMessage()));
            }
            return ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage()));
        }
    }
}
