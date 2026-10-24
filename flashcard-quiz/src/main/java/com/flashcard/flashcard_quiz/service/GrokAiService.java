
package com.flashcard.flashcard_quiz.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;

@Service
public class GrokAiService {

    @Value("${xai.api.key:}")
    private String apiKey;

    @Value("${xai.api.url:https://api.x.ai/v1}")
    private String apiUrl;

    @Value("${xai.api.model:grok-4.7}")
    private String model;

    private final RestClient restClient = RestClient.create();

    public String generateText(String prompt) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException(
                    "Grok API key missing. Set XAI_API_KEY in Run Configuration."
            );
        }

        Map<String, Object> requestBody = Map.of(
                "model", model,
                "messages", List.of(
                        Map.of("role", "user", "content", prompt)
                )
        );

        Map<?, ?> response = restClient.post()
                .uri(apiUrl + "/chat/completions")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                .contentType(MediaType.APPLICATION_JSON)
                .body(requestBody)
                .retrieve()
                .body(Map.class);

        if (response == null) {
            throw new IllegalStateException("Empty response from Grok API.");
        }

        List<?> choices = (List<?>) response.get("choices");
        if (choices == null || choices.isEmpty()) {
            throw new IllegalStateException("Grok returned no choices.");
        }

        Map<?, ?> choice = (Map<?, ?>) choices.get(0);
        Map<?, ?> message = (Map<?, ?>) choice.get("message");
        return String.valueOf(message.get("content"));
    }
}

