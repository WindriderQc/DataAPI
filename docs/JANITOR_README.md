# Datalake Janitor API

The Janitor API provides tools for maintaining the file system, specifically for identifying duplicate files and cleaning up temporary files.

## Overview

- **Base URL**: `/api/v1/janitor`
- **Auth**: Requires Session (Browser) or API Key (`x-api-key` header).
- **Source Code**: `routes/janitor.routes.js`

## Endpoints

### 1. Analyze Directory
Scans a directory to gather file statistics and identify duplicates based on SHA256 hash.

- **Method**: `POST /analyze`
- **Body**:
  ```json
  {
    "path": "/absolute/path/to/scan"
  }
  ```
- **Response**:
  - `total_files`: Total number of files scanned.
  - `duplicates_count`: Number of duplicate groups found.
  - `wasted_space`: Total bytes wasted by duplicates.
  - `duplicate_groups`: Array of duplicate file groups.

### 2. Get Cleanup Suggestions
Generates a list of files to delete based on active policies.

- **Method**: `POST /suggest`
- **Body**:
  ```json
  {
    "path": "/absolute/path/to/scan",
    "policies": ["delete_duplicates", "remove_temp_files"] // Optional
  }
  ```
- **Policies**:
  - `delete_duplicates`: Keeps the oldest file in a duplicate group, suggests deleting the rest.
  - `remove_temp_files`: Suggests deleting files in `temp` or `tmp` folders older than 7 days.

### 3. Execute Cleanup
Deletes files. **Defaults to Dry Run.**

- **Method**: `POST /execute`
- **Body**:
  ```json
  {
    "files": ["/path/to/file1", "/path/to/file2"],
    "dry_run": false // Set to false to actually delete files
  }
  ```
- **Safety**:
  - Validates file existence.
  - Blocks deletion of system directories (`/`, `/usr`, etc.).
  - Returns a report of deleted and failed files.

### 4. List Policies
Returns available cleanup policies.

- **Method**: `GET /policies`

## Testing

### Manual Testing with Curl

```bash
# 1. Analyze
curl -X POST http://localhost:3003/api/v1/janitor/analyze \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{"path": "/home/yb/codes/DataAPI/data/uploads"}'

# 2. Suggest
curl -X POST http://localhost:3003/api/v1/janitor/suggest \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{"path": "/home/yb/codes/DataAPI/data/uploads"}'

# 3. Execute (Dry Run)
curl -X POST http://localhost:3003/api/v1/janitor/execute \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{"files": ["/path/to/duplicate"], "dry_run": true}'
```

## Missing / To-Do

- **Automated Tests**: No integration tests currently exist in `tests/`.
- **Scheduling**: No built-in scheduler (e.g., cron) to run this automatically.

## UI Access

The Janitor UI is available in the **AgentX** application under the **Prompts** tab (`/prompts.html`).

Note: legacy `/personas.html` links are redirected to `/prompts.html`.
