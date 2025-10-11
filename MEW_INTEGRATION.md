# Mew API Integration

## Overview
Successfully integrated the Mew (Meower) API routes into the DataAPI architecture following existing patterns and conventions.

## Files Created

### 1. `/controllers/mewController.js`
- **Purpose**: Controller handling all mew-related business logic
- **Functions**:
  - `index()` - Welcome message endpoint
  - `getAllMews()` - Legacy endpoint returning all mews as array
  - `getMewsV2()` - V2 endpoint with pagination, sorting, and metadata
  - `createMew()` - Create a new mew with validation
- **Validation**: Custom `isValidMew()` function ensuring:
  - Name: required, max 50 characters
  - Content: required, max 140 characters

### 2. `/tests/mew.test.js`
- **Purpose**: Comprehensive test suite for mew endpoints
- **Coverage**: 14 tests covering:
  - Welcome endpoint
  - Creating valid mews
  - Input validation (missing fields, length limits)
  - Pagination (skip, limit, has_more)
  - Sorting (asc/desc)
  - Legacy vs V2 response formats

## Routes Added to `/routes/api.routes.js`

```javascript
// GET /api/v1/mew - Welcome message
router.get('/mew', mewController.index);

// GET /api/v1/mews - Legacy endpoint (returns array)
router.get('/mews', mewController.getAllMews);

// GET /api/v1/v2/mews - V2 endpoint with pagination
router.get('/v2/mews', mewController.getMewsV2);

// POST /api/v1/mews - Create mew (legacy)
// POST /api/v1/v2/mews - Create mew (v2)
router.post('/mews', [
    body('name').trim().escape(),
    body('content').trim().escape()
], mewController.createMew);

router.post('/v2/mews', [
    body('name').trim().escape(),
    body('content').trim().escape()
], mewController.createMew);
```

## Key Features

### 1. Maintains DataAPI Architecture
- Uses `req.app.locals.dbs.mainDb` for database access
- Follows standardized response format: `{ status, message, data }`
- Integrates with existing error handling (`BadRequest`, etc.)
- Uses express-validator for input sanitization

### 2. Legacy vs V2 Endpoints

#### Legacy (`/mews`)
- Returns: Array of mews directly
- Use case: Backward compatibility

#### V2 (`/v2/mews`)
- Returns: `{ mews: [...], meta: { total, skip, limit, has_more } }`
- Query params:
  - `skip` (default: 0)
  - `limit` (default: 5, min: 1, max: 50)
  - `sort` (default: 'desc', options: 'asc'|'desc')

### 3. Validation Rules
- **Name**: 
  - Required
  - Trimmed
  - Max 50 characters
  - HTML escaped
- **Content**: 
  - Required
  - Trimmed
  - Max 140 characters (like Twitter!)
  - HTML escaped

### 4. Database Collection
- Uses existing `meows` collection (already in generic routes)
- Each mew document includes:
  - `name` (string)
  - `content` (string)
  - `created` (Date) - automatically added
  - `_id` (ObjectId) - MongoDB default

## Test Results

✅ **All tests pass** (9 suites, 52 tests total)
- 14 mew-specific tests
- All existing tests remain passing
- No breaking changes to existing functionality

## API Examples

### Create a Mew
```bash
curl -X POST http://localhost:3003/api/v1/mews \
  -H "Content-Type: application/json" \
  -d '{"name":"Fluffy","content":"Meow meow meow!"}'
```

Response:
```json
{
  "status": "success",
  "message": "Mew created successfully",
  "data": {
    "name": "Fluffy",
    "content": "Meow meow meow!",
    "created": "2025-10-11T...",
    "_id": "..."
  }
}
```

### Get Paginated Mews (V2)
```bash
curl http://localhost:3003/api/v1/v2/mews?skip=0&limit=10&sort=desc
```

Response:
```json
{
  "mews": [...],
  "meta": {
    "total": 42,
    "skip": 0,
    "limit": 10,
    "has_more": true
  }
}
```

### Get All Mews (Legacy)
```bash
curl http://localhost:3003/api/v1/mews
```

Response:
```json
[
  { "_id": "...", "name": "Fluffy", "content": "Meow!", "created": "..." },
  ...
]
```

## Notes

- The `meows` collection was already included in the generic routes, so basic CRUD operations via `/api/v1/meows/:id` were already available
- This integration adds custom business logic (validation, pagination) specific to mews
- Both legacy and V2 POST endpoints use the same controller for consistency
- Input sanitization happens at the route level via express-validator middleware
- Business validation happens in the controller via `isValidMew()`
