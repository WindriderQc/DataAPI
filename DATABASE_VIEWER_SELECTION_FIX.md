# Database Viewer Selection Fix

## Issue
The database viewer was always fetching data from `mySessions` regardless of which collection was selected in the dropdown. When selecting "alarms", it still tried to fetch from `mySessions`.

## Root Causes

### 1. Incorrect Option Values
**Location**: `/public/js/database-viewer.js` line 23

The `DBSelecter` class was creating options with the **array index** as the value instead of the collection name:
```javascript
// BEFORE (incorrect):
new Option(this.collectionList[col], col);  // col is the index (0, 1, 2...)

// AFTER (correct):
new Option(this.collectionList[col], this.collectionList[col]);  // Both are collection name
```

### 2. Missing Change Event Listener
**Location**: `/public/js/database-viewer.js` lines 31-33

The select element had no change event listener, so when the user changed the dropdown selection, `updateSelected()` was never called, and `dbSelect.selectedCollection` was never updated.

```javascript
// ADDED:
this.selectElm.addEventListener('change', () => {
    this.updateSelected();
});
```

## Additional Fix: Generic Controller Pagination

While fixing the viewer, I also updated the `genericController` to support pagination with metadata that the viewer expects.

**Location**: `/controllers/genericController.js` - `getAll()` method

### Before
```javascript
const documents = await collection.find(query).toArray();
res.json({
  status: 'success',
  data: documents,
  // No meta property - causing "Cannot read properties of undefined (reading 'has_more')" error
});
```

### After
```javascript
// Parse pagination parameters
let { skip = 0, limit = 10, sort = 'desc' } = req.query;
skip = parseInt(skip) || 0;
limit = parseInt(limit) || 10;
skip = skip < 0 ? 0 : skip;
limit = Math.min(100, Math.max(1, limit));

const sortBy = sort === 'desc' ? -1 : 1;

// Execute with pagination
const [total, documents] = await Promise.all([
  collection.countDocuments(query),
  collection.find(query).skip(skip).limit(limit).sort({ _id: sortBy }).toArray()
]);

res.json({
  status: 'success',
  data: enrichedDocuments,
  meta: {
    total,
    skip,
    limit,
    sort,
    has_more: total - (skip + limit) > 0,  // Required by viewer
  },
});
```

## Changes Summary

### `/public/js/database-viewer.js`
1. Fixed option value to use collection name instead of index
2. Added change event listener to update selection

### `/controllers/genericController.js`
1. Added pagination parameter parsing
2. Added parallel queries for total count and paginated results
3. Added `meta` object with pagination info including `has_more` flag
4. Increased max limit from 50 to 100
5. Added sort functionality by `_id`

## Testing
After restarting the server:
1. ✅ Visit databases page while logged in
2. ✅ Select "alarms" from dropdown
3. ✅ Should fetch from `/api/v1/alarms` (not mySessions)
4. ✅ Should display alarms data in table
5. ✅ Pagination should work (Load More button)
6. ✅ No "has_more" undefined errors

## Impact on Other Collections
All generic collection endpoints now support pagination:
- `/api/v1/contacts?skip=0&limit=10&sort=desc`
- `/api/v1/devices?skip=0&limit=10&sort=desc`
- `/api/v1/profiles?skip=0&limit=10&sort=desc`
- `/api/v1/heartbeats?skip=0&limit=10&sort=desc`
- `/api/v1/alarms?skip=0&limit=10&sort=desc`
- `/api/v1/checkins?skip=0&limit=10&sort=desc`
- `/api/v1/mews?skip=0&limit=10&sort=desc`
- `/api/v1/mySessions?skip=0&limit=10&sort=desc` (requires auth)

All endpoints now return consistent response format with `meta` property.

## Related Files
- `/public/js/database-viewer.js` - Fixed selection handling
- `/controllers/genericController.js` - Added pagination support
- `/routes/api.routes.js` - Protected mySessions endpoint (previous fix)
