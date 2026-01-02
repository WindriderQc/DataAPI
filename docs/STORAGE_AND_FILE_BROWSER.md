# Storage Tool & File Browser Documentation

This document provides a comprehensive guide to the Storage Tool and File Browser features in the DataAPI. These tools allow users and agents to explore, manage, and analyze the file system indexed by the application.

## 1. Overview

The Storage Tool consists of two main components:
1.  **File Browser UI**: A web-based interface for users to browse, search, and view file statistics.
2.  **Storage API**: A set of REST endpoints for programmatic access to file metadata, statistics, deduplication, and cleanup operations.

The system relies on a MongoDB collection `nas_files` which stores metadata about files scanned from the underlying storage.

## 2. File Browser UI

**URL:** `/files/browse` (View) / `/` (Dashboard link)

The File Browser provides a modern, responsive interface built with MDBootstrap 5.

### Features
-   **Dashboard Stats**: Real-time overview of total files, total size, file types, and directory count.
-   **Search**: Full-text search on filenames.
-   **Filtering**: Filter by file extension.
-   **Sorting**: Sort by Name, Size, or Modified Date (Ascending/Descending).
-   **Pagination**: Browse large datasets efficiently.
-   **File Details**: View detailed metadata (path, size, dates) in a modal.

### Implementation Details
-   **View Template**: `views/file-browser.ejs`
-   **Client Script**: `public/js/file-browser-simple.js`
-   **Styles**: `public/css/sbqc.css` (and inline styles in EJS)

## 3. API Reference

All endpoints are prefixed with `/api/v1`.
**Authentication**: Requires Session or API Key (`x-api-key`).

### 3.1 File Browsing & Stats

#### `GET /files/browse`
Browse files with advanced filtering and pagination.

**Query Parameters:**
-   `search`: (string) Search term for filename (regex).
-   `ext`: (string) Filter by file extension (e.g., 'jpg').
-   `dirname`: (string) Filter by directory path (regex start).
-   `minSize`: (number) Minimum file size in bytes.
-   `maxSize`: (number) Maximum file size in bytes.
-   `sortBy`: (string) Field to sort by (`filename`, `size`, `mtime`). Default: `mtime`.
-   `sortOrder`: (string) `asc` or `desc`. Default: `desc`.
-   `page`: (number) Page number. Default: 1.
-   `limit`: (number) Items per page. Default: 100.

**Response:**
```json
{
  "status": "success",
  "data": {
    "files": [
      {
        "filename": "example.txt",
        "dirname": "/docs/",
        "path": "/docs/example.txt",
        "size": 1024,
        "mtime": 1672531200,
        "ext": "txt",
        "sha256": "..."
      }
    ],
    "pagination": {
      "total": 100,
      "page": 1,
      "limit": 100,
      "pages": 1
    }
  }
}
```

#### `GET /files/stats`
Get aggregated statistics about the file system.

**Response:**
-   `total`: Total count and size.
-   `byExtension`: Top 10 extensions by size.
-   `sizeCategories`: Distribution of files by size buckets (e.g., <1KB, 1MB-10MB).

#### `GET /files/tree`
Get a directory tree structure.

**Query Parameters:**
-   `root`: (string) Root path to start from. Default: `/`.

### 3.2 Deduplication & Cleanup

#### `GET /files/duplicates`
Find duplicate files.

**Query Parameters:**
-   `method`: `hash` (SHA256) or `fuzzy` (Name + Size). Default: `auto`.
-   `limit`: Max number of duplicate groups. Default: 100.

**Response:**
Returns groups of duplicates with potential wasted space calculation.

#### `GET /files/cleanup-recommendations`
Get automated recommendations for freeing up space.

**Response:**
-   `large_files`: Top 20 files > 100MB.
-   `old_files`: Top 20 files older than 2 years.
-   `duplicates`: Summary of duplicate files.

### 3.3 Datalake Janitor (Advanced)

These endpoints are designed for automated cleanup workflows (e.g., via n8n or AgentX).

> **Note:** The Janitor API is at `/api/v1/janitor/*` (not `/api/v1/files/janitor/*`)

#### `POST /janitor/analyze`
Analyze a directory for duplicates and wasted space.

**Body:**
```json
{
  "path": "/mnt/nas/media"
}
```

**Response:**
- `total_files`: Total files found
- `scanned_files`: Files that were hashed (excludes >100MB)
- `total_size`: Total size in bytes
- `duplicates_count`: Number of duplicate groups
- `wasted_space`: Bytes that could be reclaimed
- `duplicate_groups`: Array of duplicate file groups (max 50)

#### `POST /janitor/suggest`
Generate cleanup suggestions based on policies.

**Body:**
```json
{
  "path": "/mnt/nas/media",
  "policies": ["delete_duplicates", "remove_temp_files"]
}
```

**Available Policies:**
- `delete_duplicates` - Keep oldest copy, delete newer duplicates
- `remove_temp_files` - Delete files in temp directories older than 7 days
- `remove_large_files` - Flag files larger than 1GB for review

**Response:**
- `suggestions_count`: Number of suggested actions
- `total_space_saved`: Bytes that would be freed
- `suggestions`: Array of suggested file deletions with reasons

#### `POST /janitor/execute`
Execute cleanup operations (delete files).

**Body:**
```json
{
  "files": ["/path/to/file1.txt", "/path/to/file2.txt"],
  "dry_run": true
}
```

**Parameters:**
- `files`: Array of absolute file paths to delete
- `dry_run`: (boolean, default: `true`) If true, simulates deletion without removing files

**⚠️ Safety Features:**
- Defaults to dry_run mode
- Blocks deletion of system directories (/, /home, /usr, etc.)
- Requires absolute paths
- Logs all operations

**Response:**
- `deleted`: Array of successfully deleted files
- `failed`: Array of files that couldn't be deleted with reasons
- `space_freed`: Bytes freed (or would be freed in dry_run)

#### `GET /janitor/policies`
List available cleanup policies.

**Response:**
```json
{
  "policies": [
    {
      "id": "delete_duplicates",
      "name": "Delete Duplicate Files",
      "description": "Keep the oldest copy, delete newer duplicates",
      "enabled": true,
      "safe_mode": true
    }
  ]
}
```

### 3.4 File Management

#### `PATCH /files/:id`
Update file metadata (e.g., after calculating a hash externally).

**Params:**
-   `id`: File ID (MongoDB ObjectId) or File Path.

**Body:**
-   Any field to update (e.g., `sha256`, `tags`). Protected fields (`_id`, `path`) cannot be changed.

## 4. Usage Examples

### Agent Task: Find and Clean Duplicates
1.  Call `POST /janitor/analyze` with `{ "path": "/mnt/nas/media" }` to scan for duplicates.
2.  Call `POST /janitor/suggest` with `{ "path": "/mnt/nas/media", "policies": ["delete_duplicates"] }` to get deletion suggestions.
3.  Review the suggestions in the response.
4.  Call `POST /janitor/execute` with `{ "files": [...], "dry_run": true }` to simulate cleanup.
5.  If satisfied, call `POST /janitor/execute` with `{ "files": [...], "dry_run": false }` to delete.

### Agent Task: Analyze Storage Usage
1.  Call `GET /files/stats` to get a high-level overview.
2.  Call `GET /files/cleanup-recommendations` to find quick wins (large/old files).
