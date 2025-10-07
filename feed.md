# Dynamic Feed Implementation Plan

This document outlines the plan for transforming the static feed section on the dashboard into a dynamic, real-time feed.

## 1. Feasibility Analysis

### Feed 1: User Logs
- **Feasibility:** High.
- **Implementation:** Query the `userLogs` collection for the most recent entries. We can also perform aggregations to create "highlight" entries (e.g., "100th visit recorded").

### Feed 2: Server Console Log
- **Feasibility:** Low (and not recommended).
- **Reasoning:** Exposing raw server logs on the frontend is a security risk and provides a poor user experience.
- **Alternative:** Implement a structured event feed for important application events (e.g., "Database error," "Server started"). This provides more meaningful and secure information.

### Feed 3: Devices
- **Feasibility:** High.
- **Implementation:** Query the `devices` collection for newly registered devices. Connection/disconnection status can be inferred from the `lastBoot` timestamp in the `deviceModel` or by monitoring a `heartbeats` collection.

### Feed 4: Users
- **Feasibility:** High.
- **Implementation:** Query the `users` collection for the latest user registrations.

## 2. Architecture Draft

### Backend
1.  **`controllers/feedController.js`:** A new controller will be created to centralize all feed-related logic. It will contain functions to fetch and format data for each feed type.
2.  **Data Fetching:** The `loadDashboardData` middleware in `routes/web.routes.js` will be updated to call the `feedController`.
3.  **Data Structure:** The feed data will be an array of objects, where each object represents a feed item and has a consistent structure: `{ type, message, timestamp, icon, color }`.

### Frontend
1.  **`views/partials/feed.ejs`:** A new EJS partial will be created to render the feed items, keeping the main `index.ejs` file clean.
2.  **Dynamic Rendering:** The partial will loop through the feed data passed from the backend and render each item with the appropriate icon, color, and a human-readable timestamp (e.g., "10 minutes ago").

## 3. Realization Plan

The implementation will be done in stages, as requested:

1.  **Create `feed.md`:** (This document).
2.  **Implement Feed 1 (User Logs):**
    - Create `controllers/feedController.js`.
    - Implement a function in the new controller to fetch the latest user logs.
    - Update `routes/web.routes.js` to call the new function.
    - Create `views/partials/feed.ejs` and update `views/index.ejs` to display the feed.
3.  **Submit for Approval:** The code for Feed 1 will be submitted for user approval before proceeding.
4.  **Implement Remaining Feeds (2, 3, 4):** Upon approval, the remaining feeds will be implemented, following the same pattern of updating the controller and view.
5.  **Final Polish:** Combine all feed sources into a single, chronologically sorted list.
6.  **Final Submission:** Submit the complete feature for review.