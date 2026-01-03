# AGENTS.md: Instructions for AI Agents

This document provides guidance for AI agents working on this codebase. Please read it carefully before making any changes.

## 1. Project Overview

This is a full-stack application built with Node.js, Express, and MongoDB. It serves as a data acquisition and visualization platform.

- **Backend:** Node.js, Express.js
- **Database:** MongoDB with Mongoose ODM.
- **Frontend:** EJS for templating, with vanilla JavaScript (ES6 modules) and MDBootstrap 5 for UI components.
- **Testing:** Jest and Supertest.
- **Session Management:** `express-session` with `connect-mongodb-session`.
- **AI Integration:** OpenAI ChatKit for conversational AI interface on admin pages.

## 2. Development Workflow

### Environment Setup
1.  Install Node.js (v16 or higher) and npm.
2.  Install project dependencies:
    ```bash
    npm install
    ```
3.  **Production only:** Install and configure Nginx as a reverse proxy for HTTPS and SSE support.

### Running the Application
-   **Development:** To run the server with automatic reloading via `nodemon`:
    ```bash
    npm run dev
    ```
    To run the server without automatic reloading via `node`: (Recommended for agent to avoid trouble with nodemon reloading)
    ```bash
    npm run agent
    ```
    The server will be available at `http://localhost:3003`.

-   **Production:**
    ```bash
    npm start
    ```
    The application runs on port 3003 and requires Nginx as a reverse proxy for HTTPS and proper SSE (Server-Sent Events) handling. See [realtime/SSE_PROXY_CONFIG.md](../realtime/SSE_PROXY_CONFIG.md) for Nginx configuration details.

### Running Tests
-   **Default (fast) full suite**:
    ```bash
    npm test
    ```

-   **Run only unit tests** (no full app boot):
    ```bash
    npm run test:unit
    ```

-   **Run only integration tests** (boots the Express app once per test file):
    ```bash
    npm run test:integration
    ```

-   **Debug open handles** (slower, for diagnostics):
    ```bash
    npm run test:debug:handles
    ```

    **How tests are wired (important for performance):**
    - Jest is configured in `jest.config.js` using two projects: `unit` and `integration`.
    - A single shared `mongodb-memory-server` instance is started once per Jest invocation via `tests/jest.globalSetup.js` and stopped in `tests/jest.globalTeardown.js`.
    - Each Jest worker uses an isolated database name via `MONGO_DB_NAME=dataapi_test_$JEST_WORKER_ID` (set in `tests/jest.env.js`) to avoid cross-worker collisions.
    - Integration tests load `tests/test-setup.js` (via `setupFilesAfterEnv`) which calls `createApp()` and exposes `global.app`, `global.db`, and `global.close`.

    **Test-environment behavior notes:**
    - External API proxy endpoints (weather/tides/tle/pressure/ec-weather) are disabled in `NODE_ENV=test` and return `503` to prevent slow/flaky outbound network calls.
    - In `NODE_ENV=test`, the web session store uses the in-memory session store (not MongoDB-backed) to avoid extra handles and keep the suite fast.

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
-   **n8n Integration:** **MOVED TO AGENTX.** n8n workflow integration is now handled exclusively by AgentX (port 3080). DataAPI focuses on data management and APIs. If n8n needs to access data, it should call DataAPI's standard API endpoints with proper authentication.
-   **Authentication Methods:** The application supports session-based authentication for web UI and API key authentication (`x-api-key` header) for server-to-server API access from AgentX and other trusted clients.
-   **`APIFeatures` Class:** Use the reusable class in `utils/apiFeatures.js` for consistent sorting and pagination on API GET routes.
-   **Server-Sent Events (SSE):** The application uses SSE for real-time event streaming on `/api/v1/feed/events/*` endpoints. In production, Nginx must be configured to disable response buffering for these endpoints (see [realtime/SSE_PROXY_CONFIG.md](../realtime/SSE_PROXY_CONFIG.md)).
-   **OpenAI ChatKit Integration:** The application integrates OpenAI's ChatKit for conversational AI on admin pages. Key implementation details:
    -   Requires `OPENAI_API_KEY` and `CHATKIT_AGENT_ID` environment variables
    -   Token endpoint at `/api/v1/chatkit/token` generates ephemeral session tokens
    -   Uses `OpenAI-Beta: chatkit_beta=v1` header for ChatKit API requests
    -   Domain must be allowlisted in OpenAI Platform dashboard
    -   Frontend extracts `token.value` from response object to pass string client_secret to ChatKit SDK
-   **OpenAI Realtime Voice Integration:** Real-time voice chat using WebRTC and OpenAI's Realtime API:
    -   Session endpoint at `/api/v1/chatkit/realtime-session` creates ephemeral voice sessions
    -   Uses `OpenAI-Beta: realtime=v1` header for Realtime API requests
    -   Does NOT support `workflow` parameters (unlike ChatKit sessions)
    -   Agent instructions configured via `OPENAI_REALTIME_INSTRUCTIONS` environment variable
    -   See [realtime/REALTIME_VOICE_SETUP.md](../realtime/REALTIME_VOICE_SETUP.md) for detailed configuration and troubleshooting

### Frontend
-   **MDBootstrap 5:** This is the standard UI library, loaded via CDN.
-   **JavaScript Modules:** Client-side utilities are organized into ES6 modules in `public/js/utils/`. The main `public/js/utils/index.js` file exports them as namespaced objects (e.g., `API`, `DOM`) for clean, library-like access in page-specific scripts.
-   **Script Loading:** To prevent DOM-related errors, MDBootstrap's JavaScript and other page scripts should be loaded at the end of the `<body>` tag, not in the `<head>`.
-   **p5.js:** When using p5.js helper functions from `public/js/utils/p5-helpers.js`, always pass the p5.js instance (`p`) as the first argument.

### Production Infrastructure
-   **Reverse Proxy:** Production deployment requires Nginx as a reverse proxy to handle:
    -   HTTPS/SSL termination
    -   Server-Sent Events (SSE) streaming without buffering
    -   WebSocket connections (if applicable)
-   **SSE Configuration:** Critical location block required in Nginx config:
    ```nginx
    location /api/v1/feed/events {
        proxy_pass http://localhost:3003;
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400s;
        chunked_transfer_encoding on;
        proxy_set_header X-Accel-Buffering no;
    }
    ```
    See [realtime/SSE_PROXY_CONFIG.md](../realtime/SSE_PROXY_CONFIG.md) for complete configuration details.

## 5. Automated Deployment (CI/CD)

This project uses GitHub Actions for continuous integration and deployment. A self-hosted runner is installed on the production server to handle deployments automatically.

### Workflow
1.  **Trigger**: Push to `main` branch.
2.  **Tests**: Runs `npm test` on GitHub's cloud runners.
3.  **Deploy**: If tests pass, the self-hosted runner updates the code and reloads PM2.

### Self-Hosted Runner
- **Location**: `/home/yb/codes/DataAPI/actions-runner/`
- **Service Status**: Check with `ps aux | grep Runner`
- **Logs**: `/home/yb/codes/DataAPI/actions-runner/_diag/`

### Runner Maintenance
If the runner goes offline:
1.  Navigate to the runner directory:
    ```bash
    cd /home/yb/codes/DataAPI/actions-runner
    ```
2.  Check status:
    ```bash
    ./svc.sh status
    ```
3.  Restart service:
    ```bash
    ./svc.sh stop
    ./svc.sh start
    ```

### Required GitHub Secrets
Ensure these secrets are set in the GitHub Repository Settings:
- `AGENTX_DEPLOY_PATH`: Absolute path to the project (e.g., `/home/yb/codes/DataAPI`)

## 6. Considerations for Future Improvements

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

Validation checks:
1.  **Tests**: Run `npm test` to ensure all tests pass.
2.  **Linting**: Run `npm run lint` to check for code style issues.
3.  **Security**: Check for any hardcoded secrets or sensitive information.
4.  **Documentation**: Ensure any new features or changes are documented in `README.md` or `docs/project/AGENTS.md`.
