/**
 * Unit tests for middleware/rbac.js
 */

const {
    requireRole,
    hasPermission,
    hasMinimumRole,
    getPermissionsForRole,
    getRoleLevel,
    ROLE_HIERARCHY,
    ROLE_PERMISSIONS
} = require('../../middleware/rbac');

describe('RBAC Middleware', () => {
    // Mock Express request, response, and next
    let mockReq;
    let mockRes;
    let mockNext;

    beforeEach(() => {
        mockReq = {
            originalUrl: '/api/v1/test',
            headers: {}
        };
        mockRes = {
            locals: {},
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
            redirect: jest.fn().mockReturnThis(),
            send: jest.fn().mockReturnThis()
        };
        mockNext = jest.fn();
    });

    describe('ROLE_HIERARCHY', () => {
        it('should define four roles in correct order', () => {
            expect(ROLE_HIERARCHY).toEqual(['guest', 'user', 'editor', 'admin']);
        });
    });

    describe('getRoleLevel', () => {
        it('should return correct level for each role', () => {
            expect(getRoleLevel('guest')).toBe(0);
            expect(getRoleLevel('user')).toBe(1);
            expect(getRoleLevel('editor')).toBe(2);
            expect(getRoleLevel('admin')).toBe(3);
        });

        it('should return 0 for unknown role', () => {
            expect(getRoleLevel('unknown')).toBe(0);
            expect(getRoleLevel('')).toBe(0);
            expect(getRoleLevel(undefined)).toBe(0);
        });
    });

    describe('hasMinimumRole', () => {
        it('should return true when user role meets requirement', () => {
            expect(hasMinimumRole('admin', 'user')).toBe(true);
            expect(hasMinimumRole('editor', 'user')).toBe(true);
            expect(hasMinimumRole('user', 'user')).toBe(true);
        });

        it('should return false when user role is below requirement', () => {
            expect(hasMinimumRole('guest', 'user')).toBe(false);
            expect(hasMinimumRole('user', 'editor')).toBe(false);
            expect(hasMinimumRole('editor', 'admin')).toBe(false);
        });
    });

    describe('getPermissionsForRole', () => {
        it('should return correct permissions for guest', () => {
            const perms = getPermissionsForRole('guest');
            expect(perms).toContain('read');
            expect(perms).not.toContain('write');
        });

        it('should return correct permissions for user', () => {
            const perms = getPermissionsForRole('user');
            expect(perms).toContain('read');
            expect(perms).toContain('write');
            expect(perms).not.toContain('delete');
        });

        it('should return correct permissions for editor', () => {
            const perms = getPermissionsForRole('editor');
            expect(perms).toContain('read');
            expect(perms).toContain('write');
            expect(perms).toContain('delete');
            expect(perms).toContain('export_files');
            expect(perms).not.toContain('admin');
        });

        it('should return all permissions for admin', () => {
            const perms = getPermissionsForRole('admin');
            expect(perms).toContain('read');
            expect(perms).toContain('write');
            expect(perms).toContain('delete');
            expect(perms).toContain('admin');
            expect(perms).toContain('manage_users');
        });
    });

    describe('requireRole middleware', () => {
        describe('when user is not authenticated', () => {
            it('should return 401 for API requests', () => {
                mockRes.locals.user = null;

                const middleware = requireRole('user');
                middleware(mockReq, mockRes, mockNext);

                expect(mockRes.status).toHaveBeenCalledWith(401);
                expect(mockRes.json).toHaveBeenCalledWith({
                    status: 'error',
                    message: 'Authentication required'
                });
                expect(mockNext).not.toHaveBeenCalled();
            });

            it('should redirect to login for web requests', () => {
                mockReq.originalUrl = '/dashboard';
                mockRes.locals.user = null;

                const middleware = requireRole('user');
                middleware(mockReq, mockRes, mockNext);

                expect(mockRes.redirect).toHaveBeenCalledWith('/login');
                expect(mockNext).not.toHaveBeenCalled();
            });
        });

        describe('when user has exact required role', () => {
            it('should call next() for matching role', () => {
                mockRes.locals.user = {
                    _id: '123',
                    email: 'test@test.com',
                    role: 'admin'
                };

                const middleware = requireRole('admin');
                middleware(mockReq, mockRes, mockNext);

                expect(mockNext).toHaveBeenCalled();
                expect(mockRes.status).not.toHaveBeenCalled();
            });
        });

        describe('when user has higher role than required', () => {
            it('should allow admin to access editor routes', () => {
                mockRes.locals.user = {
                    _id: '123',
                    role: 'admin'
                };

                const middleware = requireRole('editor');
                middleware(mockReq, mockRes, mockNext);

                expect(mockNext).toHaveBeenCalled();
            });

            it('should allow editor to access user routes', () => {
                mockRes.locals.user = {
                    _id: '123',
                    role: 'editor'
                };

                const middleware = requireRole('user');
                middleware(mockReq, mockRes, mockNext);

                expect(mockNext).toHaveBeenCalled();
            });
        });

        describe('when user has insufficient role', () => {
            it('should return 403 for API requests', () => {
                mockRes.locals.user = {
                    _id: '123',
                    role: 'user'
                };

                const middleware = requireRole('admin');
                middleware(mockReq, mockRes, mockNext);

                expect(mockRes.status).toHaveBeenCalledWith(403);
                expect(mockRes.json).toHaveBeenCalledWith({
                    status: 'error',
                    message: expect.stringContaining('admin')
                });
                expect(mockNext).not.toHaveBeenCalled();
            });

            it('should redirect for web requests', () => {
                mockReq.originalUrl = '/admin-dashboard';
                mockReq.flash = jest.fn();
                mockRes.locals.user = {
                    _id: '123',
                    role: 'user'
                };

                const middleware = requireRole('admin');
                middleware(mockReq, mockRes, mockNext);

                expect(mockRes.redirect).toHaveBeenCalledWith('/');
            });
        });

        describe('with multiple allowed roles', () => {
            it('should allow any of the specified roles', () => {
                mockRes.locals.user = {
                    _id: '123',
                    role: 'editor'
                };

                const middleware = requireRole('editor', 'admin');
                middleware(mockReq, mockRes, mockNext);

                expect(mockNext).toHaveBeenCalled();
            });

            it('should block roles not in the list', () => {
                mockRes.locals.user = {
                    _id: '123',
                    role: 'user'
                };

                const middleware = requireRole('editor', 'admin');
                middleware(mockReq, mockRes, mockNext);

                expect(mockRes.status).toHaveBeenCalledWith(403);
            });
        });

        describe('legacy isAdmin support', () => {
            it('should treat isAdmin: true as admin role when role not set', () => {
                mockRes.locals.user = {
                    _id: '123',
                    isAdmin: true
                };

                const middleware = requireRole('admin');
                middleware(mockReq, mockRes, mockNext);

                expect(mockNext).toHaveBeenCalled();
            });

            it('should use explicit role over isAdmin flag', () => {
                mockRes.locals.user = {
                    _id: '123',
                    role: 'editor',
                    isAdmin: false
                };

                const middleware = requireRole('editor');
                middleware(mockReq, mockRes, mockNext);

                expect(mockNext).toHaveBeenCalled();
            });
        });
    });

    describe('hasPermission middleware', () => {
        describe('when user has required permission via role', () => {
            it('should allow access', () => {
                mockRes.locals.user = {
                    _id: '123',
                    role: 'editor'
                };

                const middleware = hasPermission('delete');
                middleware(mockReq, mockRes, mockNext);

                expect(mockNext).toHaveBeenCalled();
            });
        });

        describe('when user has explicit permission', () => {
            it('should allow access via permissions array', () => {
                mockRes.locals.user = {
                    _id: '123',
                    role: 'user',
                    permissions: ['export_files']
                };

                const middleware = hasPermission('export_files');
                middleware(mockReq, mockRes, mockNext);

                expect(mockNext).toHaveBeenCalled();
            });
        });

        describe('when user lacks permission', () => {
            it('should return 403', () => {
                mockRes.locals.user = {
                    _id: '123',
                    role: 'user'
                };

                const middleware = hasPermission('admin');
                middleware(mockReq, mockRes, mockNext);

                expect(mockRes.status).toHaveBeenCalledWith(403);
                expect(mockRes.json).toHaveBeenCalledWith({
                    status: 'error',
                    message: expect.stringContaining('admin')
                });
            });
        });

        describe('with multiple required permissions', () => {
            it('should require ALL permissions', () => {
                mockRes.locals.user = {
                    _id: '123',
                    role: 'editor'
                };

                // Editor has delete but not admin
                const middleware = hasPermission('delete', 'admin');
                middleware(mockReq, mockRes, mockNext);

                expect(mockRes.status).toHaveBeenCalledWith(403);
            });

            it('should allow when all permissions present', () => {
                mockRes.locals.user = {
                    _id: '123',
                    role: 'admin'
                };

                const middleware = hasPermission('delete', 'admin');
                middleware(mockReq, mockRes, mockNext);

                expect(mockNext).toHaveBeenCalled();
            });
        });
    });
});
