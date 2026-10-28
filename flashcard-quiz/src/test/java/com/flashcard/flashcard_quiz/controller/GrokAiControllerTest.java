package com.flashcard.flashcard_quiz.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.flashcard.flashcard_quiz.service.GrokAiService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class GrokAiControllerTest {

    @Mock
    private GrokAiService grokAiService;

    @InjectMocks
    private GrokAiController grokAiController;

    private MockMvc mockMvc;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(grokAiController).build();
        objectMapper = new ObjectMapper();
    }

    @Test
    void testGenerate_successReturns10Questions() throws Exception {
        List<Map<String, Object>> mockQuestions = new ArrayList<>();
        for (int i = 1; i <= 10; i++) {
            mockQuestions.add(Map.of(
                    "questionText", "Question " + i,
                    "optionA", "Opt A",
                    "optionB", "Opt B",
                    "optionC", "Opt C",
                    "optionD", "Opt D",
                    "correctOption", "A",
                    "correctAnswer", "A",
                    "explanation", "Expl " + i
            ));
        }

        Map<String, Object> mockResult = Map.of(
                "topic", "Java Generics",
                "count", 10,
                "questions", mockQuestions,
                "answer", "Generated 10 MCQs for topic: Java Generics"
        );

        when(grokAiService.generateQuizQuestions("Java Generics")).thenReturn(mockResult);

        mockMvc.perform(post("/api/ai/generate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("topic", "Java Generics"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.topic").value("Java Generics"))
                .andExpect(jsonPath("$.count").value(10))
                .andExpect(jsonPath("$.questions.length()").value(10))
                .andExpect(jsonPath("$.questions[0].questionText").value("Question 1"))
                .andExpect(jsonPath("$.questions[0].correctOption").value("A"));
    }

    @Test
    void testGenerate_withPromptFieldBackwardCompatibility() throws Exception {
        List<Map<String, Object>> mockQuestions = List.of(Map.of(
                "questionText", "What is polymorphism?",
                "optionA", "Many forms",
                "optionB", "Single form",
                "optionC", "No form",
                "optionD", "Class form",
                "correctOption", "A"
        ));

        when(grokAiService.generateQuizQuestions("OOP Concepts")).thenReturn(Map.of(
                "topic", "OOP Concepts",
                "count", 1,
                "questions", mockQuestions
        ));

        mockMvc.perform(post("/api/ai/generate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("prompt", "OOP Concepts"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.topic").value("OOP Concepts"));
    }

    @Test
    void testGenerate_emptyTopicReturnsBadRequest() throws Exception {
        mockMvc.perform(post("/api/ai/generate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("topic", ""))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Topic or prompt is required"));
    }

    @Test
    void testGenerate_missingApiKeyReturns503() throws Exception {
        when(grokAiService.generateQuizQuestions(anyString()))
                .thenThrow(new IllegalStateException("xAI API key missing. Please set the XAI_API_KEY environment variable on the backend."));

        mockMvc.perform(post("/api/ai/generate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("topic", "Spring Boot"))))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.error").value("xAI API key missing. Please set the XAI_API_KEY environment variable on the backend."));
    }

    @Test
    void testGenerate_outOfCreditsReturns402PaymentRequired() throws Exception {
        when(grokAiService.generateQuizQuestions(anyString()))
                .thenThrow(new IllegalStateException("xAI API error (HTTP 402): Account has insufficient credits or reached monthly spending limit. Please check your credits at console.x.ai."));

        mockMvc.perform(post("/api/ai/generate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("topic", "Spring Boot"))))
                .andExpect(status().isPaymentRequired())
                .andExpect(jsonPath("$.error").value("xAI API error (HTTP 402): Account has insufficient credits or reached monthly spending limit. Please check your credits at console.x.ai."));
    }
}
