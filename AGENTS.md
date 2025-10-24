# AGENTS.md: Instructions for AI Agents

This document provides guidance for AI agents working on this codebase. Please read it carefully before making any changes.

## 1. Project Overview

This is a full-stack application built with Node.js, Express, and MongoDB. It serves as a data acquisition and visualization platform.

- **Backend:** Node.js, Express.js
- **Database:** MongoDB with Mongoose ODM.
- **Frontend:** EJS for templating, with vanilla JavaScript (ES6 modules) and MDBootstrap 5 for UI components.
- **Testing:** Jest and Supertest.
- **Session Management:** `express-session` with `connect-mongodb-session`.

## 2. Development Workflow

### Environment Setup
1.  Install Node.js (v16 or higher) and npm.
2.  Install project dependencies:
    ```bash
    npm install
    ```

### Running the Application
-   **Development:** To run the server with automatic reloading via `nodemon`:
    ```bash
    npm run dev
    ```
    To run the server without automatic reloading via `node`: (Recommended for agent to avoir trouble with nodemon reloading)
    ```bash
    npm run agent
    ```
    The server will be available at `http://localhost:3003`.

-   **Production:**
    ```bash
    npm start
    ```

### Running Tests
-   To run the entire test suite:
    ```bash
    npm test
    ```
    Tests are located in the `tests/` directory and use an in-memory MongoDB server to avoid interfering with the development database.

## 3. Codebase Structure

-   `controllers/`: Contains the logic for handling requests (e.g., `userController.js`, `authController.js`).
-   `models/`: Mongoose schemas and models (e.g., `userModel.js`).
-   `public/`: All client-side assets.
    -   `css/`: Custom stylesheets (`sbqc.css`).
    -   `js/`: Client-side JavaScript.
        -   `utils/`: Reusable ES6 modules. `index.js` bundles them for easy access.
-   `routes/`: Express route definitions (e.g., `userRoutes.js`).
-   `utils/`: Shared backend utilities (e.g., `apiFeatures.js`, `errors.js`).
-   `views/`: EJS templates.
-   `data_serv.js`: The main application entry point.
-   `mongooseDB.js`: Handles MongoDB database connections.

## 4. Key Conventions & Patterns

### Backend
-   **API Responses:** Standardized success response format:
    `{ status: 'success', message: '...', data: ... }`
-   **Error Handling:** Use custom error classes from `utils/errors.js` (`BadRequest`, `NotFoundError`). A global error handler in `data_serv.js` catches and formats errors.
-   **Route Order:** In `data_serv.js`, API routes **must** be registered before web page routes to ensure session middleware is not incorrectly applied to the API.
-   **`APIFeatures` Class:** Use the reusable class in `utils/apiFeatures.js` for consistent sorting and pagination on API GET routes.

### Frontend
-   **MDBootstrap 5:** This is the standard UI library, loaded via CDN.
-   **JavaScript Modules:** Client-side utilities are organized into ES6 modules in `public/js/utils/`. The main `public/js/utils/index.js` file exports them as namespaced objects (e.g., `API`, `DOM`) for clean, library-like access in page-specific scripts.
-   **Script Loading:** To prevent DOM-related errors, MDBootstrap's JavaScript and other page scripts should be loaded at the end of the `<body>` tag, not in the `<head>`.
-   **p5.js:** When using p5.js helper functions from `public/js/utils/p5-helpers.js`, always pass the p5.js instance (`p`) as the first argument.

## 5. Considerations for Future Improvements

-   **Environment Variables:** Currently, some configuration (like the port number) is hardcoded. These should be moved to a `.env` file for better configuration management.
-   **Frontend Dependencies:** Frontend libraries like MDBootstrap are loaded via CDN. For better reliability and version control, they should be managed via npm.
-   **Test Coverage:** While tests exist, coverage could be improved, especially for controller logic and edge cases.
-   **Input Validation:** Enhance and standardize input validation using `express-validator` across all relevant routes.
-   **CI/CD Pipeline:** Implement a Continuous Integration/Continuous Deployment pipeline (e.g., using GitHub Actions) to automate testing and deployment.
-   **Logging:** The current logging is basic. A more structured logging solution (like Winston, which is already a dependency) should be implemented consistently across the application.
-   **Security:** Review and enhance security measures, such as adding rate limiting to more routes and implementing more robust authentication checks.
-   **Code Duplication**: Review the code for duplication and opportunities to refactor. For example, the user creation logic in the API and the web registration form could be consolidated.
-   **Frontend Build Process**: Introduce a build step for the frontend (e.g., using Webpack or Vite) to bundle assets, minify code, and enable modern JavaScript features more robustly.
-   **API Documentation**: Generate formal API documentation using a tool like Swagger or Postman to make the API easier for developers to consume.