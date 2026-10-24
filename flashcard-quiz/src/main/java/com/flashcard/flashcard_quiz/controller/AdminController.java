package com.flashcard.flashcard_quiz.controller;

import com.flashcard.flashcard_quiz.entity.Question;
import com.flashcard.flashcard_quiz.entity.Quiz;
import com.flashcard.flashcard_quiz.entity.User;
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
@CrossOrigin(origins = "http://localhost:5173")
public class AdminController {

    private final QuizService quizService;

    public AdminController(QuizService quizService) {
        this.quizService = quizService;
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
                map.put("questionsAdded", quizService.getQuestions(q.getId()).size());
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
}
