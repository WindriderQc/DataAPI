/**
 * Role-Based Access Control (RBAC) Middleware
 * 
 * Provides flexible role and permission-based access control.
 * 
 * Roles (hierarchical):
 *   admin > editor > user > guest
 * 
 * Usage:
 *   router.get('/admin-only', requireRole('admin'), handler);
 *   router.get('/editors-up', requireRole('editor', 'admin'), handler);
 *   router.get('/any-user', requireRole('user', 'editor', 'admin'), handler);
 */

const { log } = require('../utils/logger');

// Role hierarchy - higher index = more permissions
const ROLE_HIERARCHY = ['guest', 'user', 'editor', 'admin'];

// Default permissions per role
const ROLE_PERMISSIONS = {
    guest: ['read'],
    user: ['read', 'write'],
    editor: ['read', 'write', 'delete', 'export_files', 'view_logs'],
    admin: ['read', 'write', 'delete', 'admin', 'manage_users', 'manage_profiles', 'view_logs', 'export_files']
};

/**
 * Get the role level (index in hierarchy)
 * @param {string} role 
 * @returns {number}
 */
function getRoleLevel(role) {
    const index = ROLE_HIERARCHY.indexOf(role);
    return index >= 0 ? index : 0; // Default to guest level if unknown
}

/**
 * Check if a role has at least the minimum required role level
 * @param {string} userRole 
 * @param {string} requiredRole 
 * @returns {boolean}
 */
function hasMinimumRole(userRole, requiredRole) {
    return getRoleLevel(userRole) >= getRoleLevel(requiredRole);
}

/**
 * Get all permissions for a role (including inherited from lower roles)
 * @param {string} role 
 * @returns {string[]}
 */
function getPermissionsForRole(role) {
    const level = getRoleLevel(role);
    const allPermissions = new Set();

    for (let i = 0; i <= level; i++) {
        const roleName = ROLE_HIERARCHY[i];
        const perms = ROLE_PERMISSIONS[roleName] || [];
        perms.forEach(p => allPermissions.add(p));
    }

    return Array.from(allPermissions);
}

/**
 * Middleware factory: Require one of the specified roles
 * 
 * @param {...string} allowedRoles - Roles that are allowed access
 * @returns {Function} Express middleware
 * 
 * @example
 *   router.get('/admin', requireRole('admin'), handler);
 *   router.get('/editors', requireRole('editor', 'admin'), handler);
 */
function requireRole(...allowedRoles) {
    return (req, res, next) => {
        const user = res.locals.user;

        // Check if user is authenticated
        if (!user) {
            log(`[RBAC] Access denied: No authenticated user for ${req.originalUrl}`);
            return sendUnauthorized(req, res, 'Authentication required');
        }

        // Get user's role from profile or default to 'user'
        // Support both new role field and legacy isAdmin
        let userRole = user.role || 'user';

        // Legacy support: if isAdmin is true but role not set, treat as admin
        if (user.isAdmin && userRole === 'user') {
            userRole = 'admin';
        }

        // Check if user's role is in the allowed list
        if (allowedRoles.includes(userRole)) {
            log(`[RBAC] Access granted: User ${user.email || user._id} with role '${userRole}' accessing ${req.originalUrl}`);
            return next();
        }

        // Check role hierarchy - if user has a higher role than any required role
        const userLevel = getRoleLevel(userRole);
        const hasAccess = allowedRoles.some(role => userLevel >= getRoleLevel(role));

        if (hasAccess) {
            log(`[RBAC] Access granted (hierarchy): User ${user.email || user._id} with role '${userRole}' accessing ${req.originalUrl}`);
            return next();
        }

        log(`[RBAC] Access denied: User ${user.email || user._id} with role '${userRole}' tried to access ${req.originalUrl} (requires: ${allowedRoles.join(', ')})`);
        return sendForbidden(req, res, `Requires one of: ${allowedRoles.join(', ')}`);
    };
}

/**
 * Middleware factory: Require specific permission(s)
 * 
 * @param {...string} requiredPermissions - Permissions required (all must be present)
 * @returns {Function} Express middleware
 * 
 * @example
 *   router.delete('/item/:id', hasPermission('delete'), handler);
 */
function hasPermission(...requiredPermissions) {
    return (req, res, next) => {
        const user = res.locals.user;

        if (!user) {
            return sendUnauthorized(req, res, 'Authentication required');
        }

        // Get user's role
        let userRole = user.role || 'user';
        if (user.isAdmin && userRole === 'user') {
            userRole = 'admin';
        }

        // Get permissions from role + any explicit user permissions
        const rolePermissions = getPermissionsForRole(userRole);
        const userPermissions = new Set([...rolePermissions, ...(user.permissions || [])]);

        // Check all required permissions
        const hasAll = requiredPermissions.every(perm => userPermissions.has(perm));

        if (hasAll) {
            log(`[RBAC] Permission granted: User ${user.email || user._id} has [${requiredPermissions.join(', ')}]`);
            return next();
        }

        const missing = requiredPermissions.filter(p => !userPermissions.has(p));
        log(`[RBAC] Permission denied: User ${user.email || user._id} missing [${missing.join(', ')}]`);
        return sendForbidden(req, res, `Missing permissions: ${missing.join(', ')}`);
    };
}

/**
 * Helper: Send 401 Unauthorized response
 */
function sendUnauthorized(req, res, message) {
    const wantsEventStream = req.headers?.accept?.includes('text/event-stream');
    const isApiRequest = req.originalUrl?.startsWith('/api');

    if (wantsEventStream) {
        return res.status(401).send('Unauthorized');
    }
    if (isApiRequest) {
        return res.status(401).json({ status: 'error', message: message || 'Unauthorized' });
    }
    return res.redirect('/login');
}

/**
 * Helper: Send 403 Forbidden response
 */
function sendForbidden(req, res, message) {
    const wantsEventStream = req.headers?.accept?.includes('text/event-stream');
    const isApiRequest = req.originalUrl?.startsWith('/api');

    if (wantsEventStream || isApiRequest) {
        return res.status(403).json({ status: 'error', message: message || 'Forbidden' });
    }
    // For web requests, redirect to home with a flash message (if flash middleware exists)
    if (req.flash) {
        req.flash('error', message || 'Access denied');
    }
    return res.redirect('/');
}

module.exports = {
    requireRole,
    hasPermission,
    hasMinimumRole,
    getPermissionsForRole,
    getRoleLevel,
    ROLE_HIERARCHY,
    ROLE_PERMISSIONS
};
