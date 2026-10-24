package com.flashcard.flashcard_quiz.service;

import com.flashcard.flashcard_quiz.entity.Question;
import com.flashcard.flashcard_quiz.entity.Quiz;
import com.flashcard.flashcard_quiz.entity.QuizAttempt;
import com.flashcard.flashcard_quiz.entity.StudentAnswer;
import com.flashcard.flashcard_quiz.entity.User;
import com.flashcard.flashcard_quiz.repository.QuestionRepository;
import com.flashcard.flashcard_quiz.repository.QuizAttemptRepository;
import com.flashcard.flashcard_quiz.repository.QuizRepository;
import com.flashcard.flashcard_quiz.repository.StudentAnswerRepository;
import com.flashcard.flashcard_quiz.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class QuizAttemptService {

    private final QuizAttemptRepository attemptRepository;
    private final QuizRepository quizRepository;
    private final QuestionRepository questionRepository;
    private final StudentAnswerRepository studentAnswerRepository;
    private final UserRepository userRepository;

    public QuizAttemptService(
            QuizAttemptRepository attemptRepository,
            QuizRepository quizRepository,
            QuestionRepository questionRepository,
            StudentAnswerRepository studentAnswerRepository,
            UserRepository userRepository) {
        this.attemptRepository = attemptRepository;
        this.quizRepository = quizRepository;
        this.questionRepository = questionRepository;
        this.studentAnswerRepository = studentAnswerRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public QuizAttempt submitQuiz(
            Long studentId,
            Long quizId,
            Map<?, ?> answers) {

        User student = userRepository.findById(studentId)
                .orElseThrow(() -> new RuntimeException("Student not found"));

        Quiz quiz = quizRepository.findById(quizId)
                .orElseThrow(() -> new RuntimeException("Quiz not found"));

        if (!quiz.isPublished()) {
            throw new RuntimeException("Quiz is not published");
        }

        if (attemptRepository
                .findByStudentIdAndQuizId(studentId, quizId).isPresent()) {
            throw new RuntimeException("Quiz already submitted");
        }

        List<Question> questions =
                questionRepository.findByQuizId(quizId);

        if (questions.isEmpty()) {
            throw new RuntimeException("Quiz has no questions");
        }

        Map<Long, Question> questionMap = questions.stream()
                .collect(Collectors.toMap(Question::getId, q -> q));

        Map<Long, String> normalizedAnswers = new HashMap<>();

        if (answers != null) {
            for (Map.Entry<?, ?> entry : answers.entrySet()) {
                if (entry.getKey() == null) continue;
                Long qId;
                try {
                    qId = Long.valueOf(entry.getKey().toString().trim());
                } catch (NumberFormatException e) {
                    throw new RuntimeException("Invalid question ID format: " + entry.getKey());
                }

                if (!questionMap.containsKey(qId)) {
                    throw new RuntimeException("Question ID " + qId + " does not belong to this quiz");
                }

                String answerVal = entry.getValue() != null ? entry.getValue().toString().trim().toUpperCase() : null;
                if (answerVal != null && !answerVal.isEmpty()) {
                    if (!List.of("A", "B", "C", "D").contains(answerVal)) {
                        throw new RuntimeException("Invalid answer option '" + entry.getValue() + "' for question " + qId + ". Allowed options are A, B, C, D.");
                    }
                    normalizedAnswers.put(qId, answerVal);
                }
            }
        }

        int score = 0;
        QuizAttempt attempt = new QuizAttempt();
        attempt.setStudent(student);
        attempt.setQuiz(quiz);
        attempt.setTotalQuestions(questions.size());
        attempt.setScore(0);
        QuizAttempt savedAttempt = attemptRepository.save(attempt);

        List<StudentAnswer> studentAnswers = new ArrayList<>();

        for (Question question : questions) {
            String answer = normalizedAnswers.get(question.getId());
            boolean isCorrect = false;

            if (answer != null &&
                    question.getCorrectOption() != null &&
                    question.getCorrectOption().name().equalsIgnoreCase(answer)) {
                isCorrect = true;
                score++;
            }

            StudentAnswer studentAnswer = new StudentAnswer();
            studentAnswer.setAttempt(savedAttempt);
            studentAnswer.setQuestion(question);
            studentAnswer.setSelectedOption(answer);
            studentAnswer.setCorrect(isCorrect);
            studentAnswers.add(studentAnswer);
        }

        studentAnswerRepository.saveAll(studentAnswers);
        savedAttempt.setScore(score);

        return attemptRepository.save(savedAttempt);
    }

    public List<QuizAttempt> getStudentAttempts(Long studentId) {
        return attemptRepository.findByStudentId(studentId);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getAttemptReview(Long attemptId, Long studentId) {
        QuizAttempt attempt = attemptRepository.findById(attemptId)
                .orElseThrow(() -> new RuntimeException("Attempt not found with ID: " + attemptId));

        if (studentId != null && !attempt.getStudent().getId().equals(studentId)) {
            throw new SecurityException("Access denied: You cannot view another student's attempt");
        }

        Quiz quiz = attempt.getQuiz();
        List<StudentAnswer> answers = studentAnswerRepository.findByAttemptIdOrderByIdAsc(attemptId);

        List<Map<String, Object>> questionReviews = new ArrayList<>();
        for (StudentAnswer sa : answers) {
            Question q = sa.getQuestion();
            Map<String, Object> qMap = new HashMap<>();
            qMap.put("id", q.getId());
            qMap.put("questionText", q.getQuestionText());
            qMap.put("optionA", q.getOptionA());
            qMap.put("optionB", q.getOptionB());
            qMap.put("optionC", q.getOptionC());
            qMap.put("optionD", q.getOptionD());
            qMap.put("selectedOption", sa.getSelectedOption());
            qMap.put("selectedOptionText", getOptionText(q, sa.getSelectedOption()));
            String correctOptionStr = q.getCorrectOption() != null ? q.getCorrectOption().name() : null;
            qMap.put("correctOption", correctOptionStr);
            qMap.put("correctOptionText", getOptionText(q, correctOptionStr));
            qMap.put("correct", sa.isCorrect());
            questionReviews.add(qMap);
        }

        double percentage = attempt.getTotalQuestions() != null && attempt.getTotalQuestions() > 0
                ? ((double) attempt.getScore() * 100.0) / attempt.getTotalQuestions()
                : 0.0;
        double roundedPercentage = Math.round(percentage * 10.0) / 10.0;

        Map<String, Object> response = new HashMap<>();
        response.put("id", attempt.getId());
        response.put("attemptId", attempt.getId());
        response.put("quizId", quiz.getId());
        response.put("quizTitle", quiz.getTitle());
        response.put("quizTopic", quiz.getTopic());
        response.put("quizDate", quiz.getQuizDate());
        response.put("score", attempt.getScore());
        response.put("totalQuestions", attempt.getTotalQuestions());
        response.put("percentage", roundedPercentage);
        response.put("submittedAt", attempt.getSubmittedAt());
        response.put("hasDetailedReview", !questionReviews.isEmpty());
        response.put("questions", questionReviews);

        return response;
    }

    private String getOptionText(Question q, String optionLetter) {
        if (optionLetter == null) return null;
        return switch (optionLetter.trim().toUpperCase()) {
            case "A" -> q.getOptionA();
            case "B" -> q.getOptionB();
            case "C" -> q.getOptionC();
            case "D" -> q.getOptionD();
            default -> null;
        };
    }
}
