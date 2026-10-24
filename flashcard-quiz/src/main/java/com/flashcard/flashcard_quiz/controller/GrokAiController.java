
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
    public ResponseEntity<?> generate(@RequestBody Map<String, String> request) {
        String prompt = request.get("prompt");

        if (prompt == null || prompt.isBlank()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Prompt is required"));
        }

        try {
            String answer = grokAiService.generateText(prompt);
            return ResponseEntity.ok(Map.of("answer", answer));
        } catch (Exception e) {
            e.printStackTrace();

            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body(Map.of(
                            "error",
                            "Grok AI request failed. Check backend console."
                    ));
        }
    }
}