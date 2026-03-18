import { describe, it, expect, beforeAll, vi, beforeEach } from 'vitest';
import { createApp } from '../app';
import { verify } from 'hono/jwt';
import { db } from '../db';
import { BountyNotFoundError, InvalidBountyStatusError } from '../utils/errors';

// Mock hono/jwt verify
vi.mock('hono/jwt', () => ({
    verify: vi.fn(),
}));

// Mock the database
vi.mock('../db', () => ({
    db: {
        transaction: vi.fn(),
        query: {
            bounties: { findFirst: vi.fn() },
        },
        select: vi.fn(),
        insert: vi.fn(),
        update: vi.fn(),
    },
}));

// Mock the middleware resource auth
vi.mock('../middleware/resource-auth', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../middleware/resource-auth')>();
    return {
        ...actual,
        ensureBountyAssignee: (_paramName: string) => async (c: any, next: any) => {
            const user = c.get('user');
            if (!user) return c.json({ error: 'Unauthorized' }, 401);
            // Simulate success for tests unless we specifically mock it to fail
            await next();
        },
    };
});

describe('POST /api/tasks/:id/extend', () => {
    let app: ReturnType<typeof createApp>;

    beforeAll(() => {
        app = createApp();
        process.env.JWT_PUBLIC_KEY = '-----BEGIN PUBLIC KEY-----\nfake\n-----END PUBLIC KEY-----';
    });

    beforeEach(() => {
        vi.clearAllMocks();
        // Default auth bypass
        vi.mocked(verify).mockResolvedValue({
            sub: 'test-user-id',
            id: 'test-user-id',
            username: 'testuser',
            exp: Math.floor(Date.now() / 1000) + 3600,
        });
    });

    it('should return 400 if validation fails (missing new_deadline)', async () => {
        const res = await app.request('/api/tasks/b-123/extend', {
            method: 'POST',
            body: JSON.stringify({}),
            headers: {
                Authorization: 'Bearer valid.token',
                'Content-Type': 'application/json'
            },
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.success).toBe(false);
        expect(body.error).toBeDefined();
    });

    it('should return 400 if validation fails (invalid date format)', async () => {
        const res = await app.request('/api/tasks/b-123/extend', {
            method: 'POST',
            body: JSON.stringify({ new_deadline: 'invalid-date' }),
            headers: {
                Authorization: 'Bearer valid.token',
                'Content-Type': 'application/json'
            },
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.success).toBe(false);
        expect(body.error).toBeDefined();
    });

    it('should return 404 if bounty is not found', async () => {
        vi.mocked(db.transaction).mockImplementation(async (cb: any) => {
            const txMock = {
                query: {
                    bounties: {
                        findFirst: vi.fn().mockResolvedValue(null),
                    },
                },
            };
            try {
                return await cb(txMock);
            } catch (err) {
                // Let the error propagate to the route which handles it
                throw err;
            }
        });

        const res = await app.request('/api/tasks/b-nonexistent/extend', {
            method: 'POST',
            body: JSON.stringify({ new_deadline: '2030-01-01T00:00:00Z' }),
            headers: {
                Authorization: 'Bearer valid.token',
                'Content-Type': 'application/json'
            },
        });

        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.error).toBe('Bounty not found');
    });

    it('should return 400 if bounty status is not assigned', async () => {
        vi.mocked(db.transaction).mockImplementation(async (cb: any) => {
            const txMock = {
                query: {
                    bounties: {
                        findFirst: vi.fn().mockResolvedValue({ id: 'b-123', status: 'open' }),
                    },
                },
            };
            return cb(txMock);
        });

        const res = await app.request('/api/tasks/b-123/extend', {
            method: 'POST',
            body: JSON.stringify({ new_deadline: '2030-01-01T00:00:00Z' }),
            headers: {
                Authorization: 'Bearer valid.token',
                'Content-Type': 'application/json'
            },
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toContain('Cannot extend deadline for bounty with status: open');
    });

    it('should successfully submit extension request and return 201', async () => {
        const reqDate = new Date('2030-01-01T00:00:00Z');
        const mockExtensionReq = { id: 'ext-456', newDeadline: reqDate, status: 'pending' };

        vi.mocked(db.transaction).mockImplementation(async (cb: any) => {
            const txMock = {
                query: {
                    bounties: {
                        findFirst: vi.fn().mockResolvedValue({ id: 'b-123', status: 'assigned' }),
                    },
                },
                insert: vi.fn().mockReturnValue({
                    values: vi.fn().mockReturnValue({
                        returning: vi.fn().mockResolvedValue([mockExtensionReq]),
                    }),
                }),
            };
            return cb(txMock);
        });

        const res = await app.request('/api/tasks/b-123/extend', {
            method: 'POST',
            body: JSON.stringify({ new_deadline: '2030-01-01T00:00:00Z' }),
            headers: {
                Authorization: 'Bearer valid.token',
                'Content-Type': 'application/json'
            },
        });

        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.id).toBe(mockExtensionReq.id);
        expect(body.status).toBe(mockExtensionReq.status);
    });

    it('should return 409 if an active extension request already exists', async () => {
        const duplicateError = new Error('duplicate key value') as any;
        duplicateError.code = '23505';

        vi.mocked(db.transaction).mockRejectedValue(duplicateError);

        const res = await app.request('/api/tasks/b-123/extend', {
            method: 'POST',
            body: JSON.stringify({ new_deadline: '2030-01-01T00:00:00Z' }),
            headers: {
                Authorization: 'Bearer valid.token',
                'Content-Type': 'application/json'
            },
        });

        expect(res.status).toBe(409);
        const body = await res.json();
        expect(body.error).toBe('An active extension request already exists for this bounty.');
    });
});
