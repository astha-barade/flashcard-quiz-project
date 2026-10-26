
package com.flashcard.flashcard_quiz.service;

import com.flashcard.flashcard_quiz.entity.User;
import com.flashcard.flashcard_quiz.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public AuthService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    public User register(String name, String email, String password) {

        if (userRepository.existsByEmail(email)) {
            throw new RuntimeException("Email already registered");
        }

        User user = new User();
        user.setName(name);
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(password));
        user.setRole(User.Role.STUDENT);

        return userRepository.save(user);
    }

    public User login(String email, String password) {

        User user = userRepository.findByEmail(email)
                .orElseThrow(() ->
                        new RuntimeException("Invalid email or password"));

        if (!passwordEncoder.matches(password, user.getPassword())) {
            throw new RuntimeException("Invalid email or password");
        }

        return user;
    }

    public User createAdmin(String name, String email, String password) {
        if (name == null || name.isBlank()) {
            throw new RuntimeException("Name is required");
        }
        if (email == null || email.isBlank()) {
            throw new RuntimeException("Email is required");
        }
        if (password == null || password.isBlank()) {
            throw new RuntimeException("Password is required");
        }
        if (password.length() < 6) {
            throw new RuntimeException("Password must be at least 6 characters");
        }

        String cleanEmail = email.trim().toLowerCase();
        if (userRepository.existsByEmail(cleanEmail)) {
            throw new RuntimeException("Email already registered");
        }

        User user = new User();
        user.setName(name.trim());
        user.setEmail(cleanEmail);
        user.setPassword(passwordEncoder.encode(password));
        user.setRole(User.Role.ADMIN);

        return userRepository.save(user);
    }
}

