# Flashcard Quiz Project

## Overview

The Flashcard Quiz Platform is a web application that allows users to study with flashcards, take quizzes, review their attempts, and track learning progress. It includes student and admin functionality.

## Technologies Used

### Frontend
- React
- Vite
- JavaScript
- CSS

### Backend
- Java
- Spring Boot
- Maven
- REST APIs

### Database
- MySQL

## Project Structure

```text
flashcard-quiz-project/
├── flashcard-quiz-frontend/
├── flashcard-quiz/
├── .gitignore
└── README.md
```

## Prerequisites

Install the following before running the project:

- Node.js and npm
- Java Development Kit (JDK)
- MySQL Server
- Maven, or the Maven Wrapper included with the backend

## Setup Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/astha-barade/flashcard-quiz-project.git
cd flashcard-quiz-project
```

### 2. Configure the Database

1. Start MySQL.
2. Create the database required by the backend configuration.
3. Update the database URL, username, and password in the backend configuration file.
4. Make sure the database settings match your local MySQL setup.

Do not commit database passwords or other secrets to GitHub.

### 3. Run the Backend

Open a terminal in the backend folder:

```bash
cd flashcard-quiz
```

Run the application using the available Maven Wrapper:

```bash
./mvnw spring-boot:run
```

On Windows, use:

```bash
mvnw.cmd spring-boot:run
```

If the project does not include the Maven Wrapper, use an installed Maven version:

```bash
mvn spring-boot:run
```

### 4. Run the Frontend

Open a second terminal and navigate to the frontend folder:

```bash
cd flashcard-quiz-frontend
npm install
```

Create or update the local `.env` file using the frontend's existing environment-variable example. Configure the backend URL according to your local setup.

Start the development server:

```bash
npm run dev
```

Open the local URL displayed in the terminal.

## Demo Login

Use an account registered through the application's registration page, if registration is enabled.

Admin access depends on the backend's configured roles and permissions. Use an authorized admin account provided by the project owner. Do not assume demo credentials unless they have been configured and verified.

## Main Features

- User registration and login
- Flashcard learning
- Quiz attempts and results
- Review of learning progress
- Admin functionality, according to configured permissions

## Testing and Build

Run frontend tests if test scripts are configured:

```bash
cd flashcard-quiz-frontend
npm test
```

Create a production frontend build:

```bash
npm run build
```

Run backend tests from the backend folder:

```bash
./mvnw test
```

## Security Notes

- Keep passwords and secret configuration values out of source control.
- Do not commit local `.env` files containing secrets.
- Use `.env.example` to document required frontend environment variables without real secret values.
- Configure database credentials locally before running the application.