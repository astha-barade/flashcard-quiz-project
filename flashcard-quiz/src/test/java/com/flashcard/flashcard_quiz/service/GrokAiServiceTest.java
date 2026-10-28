package com.flashcard.flashcard_quiz.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class GrokAiServiceTest {

    private GrokAiService service;

    @BeforeEach
    void setUp() {
        service = new GrokAiService();
    }

   @Test
void testParseAndValidateQuestions_withMarkdownCodeFences() {
    StringBuilder questionsJson = new StringBuilder();

    for (int i = 1; i <= 10; i++) {
        if (i > 1) {
            questionsJson.append(",");
        }

        questionsJson.append("""
            {
              "questionText": "What is 5*5?",
              "optionA": "20",
              "optionB": "25",
              "optionC": "30",
              "optionD": "35",
              "correctOption": "B",
              "explanation": "5 times 5 is 25"
            }
            """);
    }

    String fencedJson = "```json\n" +
            "{\n" +
            "  \"topic\": \"Math\",\n" +
            "  \"questions\": [" + questionsJson + "]\n" +
            "}\n" +
            "```";

    Map<String, Object> result =
            service.parseAndValidateQuestions("Math", fencedJson);

    assertNotNull(result);
    assertEquals(10, result.get("count"));

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> questions =
            (List<Map<String, Object>>) result.get("questions");

    assertEquals(10, questions.size());
    assertEquals("What is 5*5?", questions.get(0).get("questionText"));
    assertEquals("25", questions.get(0).get("optionB"));
    assertEquals("B", questions.get(0).get("correctOption"));
}

    @Test
    void testGenerateQuizQuestions_missingApiKeyThrowsDescriptiveException() {
        IllegalStateException ex = assertThrows(IllegalStateException.class, () ->
                service.generateQuizQuestions("Java"));

        assertTrue(ex.getMessage().contains("Gemini API key missing"),
                "Expected message about missing key, got: " + ex.getMessage());
    }

    @Test
    void testGenerateQuizQuestions_blankTopicThrowsIllegalArgumentException() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                service.generateQuizQuestions("   "));

        assertTrue(ex.getMessage().contains("Topic is required"));
    }
}
