
package com.flashcard.flashcard_quiz.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import java.time.Duration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;

import java.util.*;

@Service
public class GrokAiService {

    private static final Logger log =
            LoggerFactory.getLogger(GrokAiService.class);

    @Value("${gemini.api.key:}")
    private String apiKey;

    @Value("${gemini.api.url:https://generativelanguage.googleapis.com/v1beta}")
    private String apiUrl;

    @Value("${gemini.api.model:gemini-2.5-flash}")
    private String model;

    private final RestClient restClient;
    private final ObjectMapper objectMapper;

    public GrokAiService() {
        SimpleClientHttpRequestFactory factory =
                new SimpleClientHttpRequestFactory();

        factory.setConnectTimeout(Duration.ofSeconds(10));
        factory.setReadTimeout(Duration.ofSeconds(45));

        this.restClient = RestClient.builder()
                .requestFactory(factory)
                .build();

        this.objectMapper = new ObjectMapper();
    }

    public GrokAiService(
            RestClient restClient,
            ObjectMapper objectMapper,
            String apiKey,
            String apiUrl,
            String model
    ) {
        this.restClient = restClient != null
                ? restClient : RestClient.create();
        this.objectMapper = objectMapper != null
                ? objectMapper : new ObjectMapper();
        this.apiKey = apiKey;
        this.apiUrl = apiUrl;
        this.model = model;
    }

    public String generateText(String prompt) {
        if (prompt == null || prompt.isBlank()) {
            throw new IllegalArgumentException("Prompt is required.");
        }
        return callGemini(prompt);
    }

    private String callGemini(String prompt) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException(
                    "Gemini API key missing. Set GEMINI_API_KEY."
            );
        }

        Map<String, Object> requestBody = Map.of(
                "contents", List.of(
                        Map.of(
                                "parts", List.of(
                                        Map.of("text", prompt)
                                )
                        )
                ),
                "generationConfig", Map.of(
                        "temperature", 0.7,
                        "responseMimeType", "application/json"
                )
        );

        try {
            Map<?, ?> response = restClient.post()
                    .uri(apiUrl + "/models/" + model + ":generateContent")
                    .header("x-goog-api-key", apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(requestBody)
                    .retrieve()
                    .body(Map.class);

            if (response == null) {
                throw new IllegalStateException(
                        "Empty response from Gemini API."
                );
            }

            List<?> candidates =
                    (List<?>) response.get("candidates");

            if (candidates == null || candidates.isEmpty()) {
                throw new IllegalStateException(
                        "Gemini returned no candidates."
                );
            }

            Map<?, ?> candidate = (Map<?, ?>) candidates.get(0);
            Map<?, ?> content = (Map<?, ?>) candidate.get("content");

            if (content == null) {
                throw new IllegalStateException(
                        "Gemini response content is missing."
                );
            }

            List<?> parts = (List<?>) content.get("parts");

            if (parts == null || parts.isEmpty()) {
                throw new IllegalStateException(
                        "Gemini response parts are missing."
                );
            }

            StringBuilder result = new StringBuilder();

            for (Object item : parts) {
                if (item instanceof Map<?, ?> part
                        && part.get("text") != null) {
                    result.append(part.get("text"));
                }
            }

            if (result.isEmpty()) {
                throw new IllegalStateException(
                        "Gemini returned empty text."
                );
            }

            return result.toString();

        }
    catch (RestClientResponseException e) {
        int status = e.getStatusCode().value();
        String responseBody = e.getResponseBodyAsString();

        // Gemini ka original error backend terminal mein log karein.
        log.error(
                "Gemini API HTTP error: {}. Response body: {}",
                status,
                responseBody.length() > 2000
                        ? responseBody.substring(0, 2000)
                        : responseBody
        );

        if (status == 401 || status == 403) {
            throw new IllegalStateException(
                    "Gemini authentication failed. Check API key and access."
            );
        }

        if (status == 429) {
            throw new IllegalStateException(
                    "Gemini quota or rate limit exceeded (HTTP 429)."
            );
        }

        throw new IllegalStateException(
                "Gemini API request failed (HTTP " + status + ")."
        );


    } catch (IllegalStateException e) {
            throw e;
        } catch (Exception e) {
            log.error("Gemini request failed: {}", e.getMessage());
            throw new IllegalStateException(
                    "Failed to connect to Gemini API.", e
            );
        }
    }

    public Map<String, Object> generateQuizQuestions(String topic) {
        if (topic == null || topic.isBlank()) {
            throw new IllegalArgumentException("Topic is required.");
        }

        String cleanTopic = topic.trim();

        String prompt = """
                You are an expert educational assessment designer.
                Generate exactly 10 multiple-choice questions about the topic:
                %s

                Return ONLY a valid JSON object with this structure:
                {
                  "topic": "topic name",
                  "questions": [
                    {
                      "questionText": "Question text",
                      "optionA": "Option one",
                      "optionB": "Option two",
                      "optionC": "Option three",
                      "optionD": "Option four",
                      "correctOption": "A",
                      "explanation": "Short explanation"
                    }
                  ]
                }

                Rules:
                - Exactly 10 questions.
                - Each question has four distinct, non-empty options.
                - Exactly one correct option per question.
                - correctOption must be A, B, C, or D.
                - Questions must be accurate and relevant.
                - Return valid JSON only, without markdown fences.
                """.formatted(cleanTopic);

        String raw = callGemini(prompt);
        return parseAndValidateQuestions(cleanTopic, raw);
    }

    public Map<String, Object> parseAndValidateQuestions(
            String topic, String rawContent
    ) {
        try {
            JsonNode root = objectMapper.readTree(cleanJsonText(rawContent));
            JsonNode questions = root.has("questions")
                    ? root.get("questions") : root;

            if (questions == null || !questions.isArray()
                    || questions.size() != 10) {
                throw new IllegalStateException(
                        "Gemini must return exactly 10 questions."
                );
            }

            List<Map<String, Object>> resultQuestions =
                    new ArrayList<>();

            for (JsonNode node : questions) {
                String question = text(node, "questionText");
                String a = text(node, "optionA");
                String b = text(node, "optionB");
                String c = text(node, "optionC");
                String d = text(node, "optionD");
                String correct = text(node, "correctOption")
                        .toUpperCase(Locale.ROOT);
                String explanation = text(node, "explanation");

                if (question.isBlank()
                        || a.isBlank() || b.isBlank()
                        || c.isBlank() || d.isBlank()) {
                    throw new IllegalStateException(
                            "A generated question or option is empty."
                    );
                }

                if (new HashSet<>(List.of(a, b, c, d)).size() != 4) {
                    throw new IllegalStateException(
                            "Each question must have four distinct options."
                    );
                }

                if (!Set.of("A", "B", "C", "D").contains(correct)) {
                    throw new IllegalStateException(
                            "Invalid correctOption; expected A, B, C, or D."
                    );
                }

                Map<String, Object> q = new LinkedHashMap<>();
                q.put("questionText", question);
                q.put("optionA", a);
                q.put("optionB", b);
                q.put("optionC", c);
                q.put("optionD", d);
                q.put("correctOption", correct);
                q.put("correctAnswer", correct);
                q.put("explanation", explanation);
                resultQuestions.add(q);
            }

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("topic", topic);
            result.put("count", resultQuestions.size());
            result.put("questions", resultQuestions);
            result.put("answer",
                    "Generated 10 MCQs for topic: " + topic);

            return result;

        } catch (IllegalStateException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalStateException(
                    "Failed to parse Gemini quiz JSON.", e
            );
        }
    }

    private String text(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value == null || value.isNull()
                ? "" : value.asText("").trim();
    }

    private String cleanJsonText(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new IllegalStateException(
                    "Gemini returned empty JSON."
            );
        }

        String value = raw.trim();

        if (value.startsWith("```json")) {
            value = value.substring(7);
        } else if (value.startsWith("```")) {
            value = value.substring(3);
        }

        if (value.endsWith("```")) {
            value = value.substring(0, value.length() - 3);
        }

        return value.trim();
    }
}
