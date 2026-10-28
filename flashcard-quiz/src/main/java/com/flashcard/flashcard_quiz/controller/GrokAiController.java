
package com.flashcard.flashcard_quiz.controller;

import com.flashcard.flashcard_quiz.service.GrokAiService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/ai")
public class GrokAiController {

    private final GrokAiService grokAiService;

    public GrokAiController(GrokAiService grokAiService) {
        this.grokAiService = grokAiService;
    }

    @PostMapping("/generate")
    public ResponseEntity<?> generate(
            @RequestBody(required = false) Map<String, String> request) {

        if (request == null || request.isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Request body is required"));
        }

        String topic = request.get("topic");

        if (topic == null || topic.isBlank()) {
            topic = request.get("prompt");
        }

        if (topic == null || topic.isBlank()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Topic or prompt is required"));
        }

        try {
            Map<String, Object> result =
                    grokAiService.generateQuizQuestions(topic.trim());

            return ResponseEntity.ok(result);

        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", safeMessage(e)));

        } catch (IllegalStateException e) {
            String msg = safeMessage(e);
            String lowerMsg = msg.toLowerCase();
            HttpStatus status = HttpStatus.BAD_GATEWAY;

            if (lowerMsg.contains("api key missing")
                    || lowerMsg.contains("api key is missing")) {
                status = HttpStatus.SERVICE_UNAVAILABLE;
            } else if (lowerMsg.contains("http 401")
                    || lowerMsg.contains("http 403")) {
                status = HttpStatus.BAD_GATEWAY;

            } else if (lowerMsg.contains("http 402")
                    || lowerMsg.contains("insufficient credits")
                    || lowerMsg.contains("spending limit")) {
                status = HttpStatus.PAYMENT_REQUIRED;
            } else if (lowerMsg.contains("http 429")
                    || lowerMsg.contains("rate limit")
                    || lowerMsg.contains("quota")) {
                status = HttpStatus.TOO_MANY_REQUESTS;
            } else if (lowerMsg.contains("http 400")) {
                status = HttpStatus.BAD_REQUEST;
            }

            return ResponseEntity.status(status)
                    .body(Map.of("error", msg));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of(
                            "error",
                            "Unexpected error generating questions."
                    ));
        }
    }

    private String safeMessage(Exception e) {
        return e.getMessage() != null
                ? e.getMessage()
                : "Gemini API processing failed.";
    }
}
