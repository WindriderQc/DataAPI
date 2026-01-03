# RBAC (Role-Based Access Control) Matrix

## Overview

DataAPI uses a role-based access control system with four hierarchical roles. Users are assigned a role through their profile, and access to endpoints is controlled by middleware.

## Roles

| Role | Level | Description |
|------|-------|-------------|
| `guest` | 0 | Read-only access to public endpoints |
| `user` | 1 | Standard authenticated user |
| `editor` | 2 | Can modify data, run scans, export files |
| `admin` | 3 | Full access, user management, database operations |

### Role Hierarchy

Roles are hierarchical: higher-level roles inherit all permissions from lower-level roles.

```
admin > editor > user > guest
```

## Permissions by Role

| Permission | guest | user | editor | admin |
|------------|-------|------|--------|-------|
| `read` | ✅ | ✅ | ✅ | ✅ |
| `write` | ❌ | ✅ | ✅ | ✅ |
| `delete` | ❌ | ❌ | ✅ | ✅ |
| `view_logs` | ❌ | ❌ | ✅ | ✅ |
| `export_files` | ❌ | ❌ | ✅ | ✅ |
| `manage_users` | ❌ | ❌ | ❌ | ✅ |
| `manage_profiles` | ❌ | ❌ | ❌ | ✅ |
| `admin` | ❌ | ❌ | ❌ | ✅ |

## API Endpoint Protection

### Public Endpoints (No Auth Required)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/` | GET | API health check |
| `/api/v1/geolocation` | GET | Geolocation lookup |
| `/api/v1/mew`, `/api/v1/mews` | GET/POST | Mew feed (public social) |
| `/api/v1/iss`, `/api/v1/quakes` | GET | Live data feeds |
| `/api/v1/weather`, `/api/v1/tides`, `/api/v1/tle`, `/api/v1/pressure`, `/api/v1/ec-weather` | GET | External API data |
| `/api/v1/stats` | GET | Collection statistics |
| `/api/v1/feed/events` | GET | Public SSE feed |

### Protected Endpoints

#### Requires `user` or higher

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/files/browse` | GET | Browse files |
| `/api/v1/files/stats` | GET | File statistics |
| `/api/v1/files/tree` | GET | Directory tree |
| `/api/v1/collection/:name/items` | GET | Query any collection |
| `/api/v1/feed/events/private` | GET | Private SSE feed |

#### Requires `editor` or higher

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/storage/scans` | GET | List storage scans |
| `/api/v1/storage/scan` | POST | Start storage scan |
| `/api/v1/storage/status/:id` | GET | Scan status |
| `/api/v1/storage/stop/:id` | POST | Stop scan |
| `/api/v1/storage/directory-count` | GET | Directory count |
| `/api/v1/files/duplicates` | GET | Find duplicate files |
| `/api/v1/files/cleanup-recommendations` | GET | Cleanup suggestions |
| `/api/v1/files/export` | POST | Generate file export |
| `/api/v1/files/exports` | GET | List exports |
| `/api/v1/files/export-optimized/:type` | GET | Optimized export |

#### Requires `admin` only

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/files/exports/:filename` | DELETE | Delete export file |
| `/api/v1/databases/copy-prod-to-dev` | POST | Copy production DB |
| `/api/v1/profiles` | GET/POST | Manage profiles |
| `/api/v1/users/:id/assign-profile` | POST | Assign profile to user |

### Web Routes Protection

| Route | Required Role | Description |
|-------|---------------|-------------|
| `/` | None | Public dashboard |
| `/login`, `/register` | None | Authentication |
| `/live-data` | None | Live data view |
| `/tools` | `user` | Tools dashboard |
| `/storage-tool` | `user` | Storage scanner |
| `/file-browser` | `user` | File browser |
| `/users` | `user` | User list |
| `/databases` | `user` | Database viewer |
| `/admin-feed` | `admin` | Admin event feed |
| `/admin/trigger-error` | `admin` | Test error handler |

## Usage in Code

### Protecting Routes

```javascript
const { requireAuth } = require('../utils/auth');
const { requireRole } = require('../middleware/rbac');

// Require authentication and admin role
router.get('/admin-only', requireAuth, requireRole('admin'), handler);

// Allow multiple roles
router.get('/editors-up', requireAuth, requireRole('editor', 'admin'), handler);

// Any authenticated user
router.get('/any-user', requireAuth, requireRole('user', 'editor', 'admin'), handler);
```

### Permission-Based Access

```javascript
const { hasPermission } = require('../middleware/rbac');

// Require specific permission
router.delete('/item/:id', requireAuth, hasPermission('delete'), handler);
```

## Profile Configuration

### Creating Profiles

Profiles are created with a role and optional additional permissions:

```javascript
const Profile = require('./models/profileModel');

// Create editor profile
const editorProfile = new Profile({
    profileName: 'Editor',
    role: 'editor',
    permissions: [], // Role permissions are automatic
    isAdmin: false
});

// Create admin profile
const adminProfile = new Profile({
    profileName: 'Admin',
    role: 'admin',
    permissions: ['read', 'write', 'delete', 'admin', 'manage_users', 'manage_profiles', 'view_logs', 'export_files'],
    isAdmin: true
});
```

### Legacy Support

The `isAdmin: true` flag is still supported for backward compatibility. Users with `isAdmin: true` in their profile are treated as having the `admin` role.

## First User Behavior

The first user to register is automatically assigned the Admin profile with:
- `role: 'admin'`
- `isAdmin: true`
- Full permissions

This ensures there's always at least one admin user in the system.
