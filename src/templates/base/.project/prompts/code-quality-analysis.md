# Code Quality Analysis Request

## Context
Project: {PROJECT_NAME}
Language: {DETECTED_LANGUAGE}
Files analyzed: {FILE_COUNT}

## Instructions
Provide a **brutally honest, 100% technical code quality analysis**. Be sincere but fair—don't exaggerate positives or negatives. Focus on **actionable improvements**.

## Scoring Categories (0-100 each)

1.  **Architecture & Design** (Component separation, dependencies, SOLID, patterns)
2.  **Code Quality & Readability** (Naming, complexity, DRY, format)
3.  **Performance & Scalability** (N+1 queries, efficiency, caching, indexes)
4.  **Security & Safety** (Input validation, auth, injection risks)
5.  **Testing & Coverage** (Coverage %, test quality, edge cases)
6.  **Documentation** (README, API docs, comments)
7.  **Technical Debt** (TODOs, hacks, legacy code)

## Output Format

For each category:
-   **Score (0-100)**
-   **Key Findings** (Bullet points)
-   **Top 3 Actionable Improvements** (Specific & Concrete)

### Overall Score
Average of all categories with brief justification.

### Critical Issues
List any issues requiring immediate attention (score <50 or severe security risks).
