import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isBountyCreator, isBountyAssignee, isApplicationOwner, isSubmissionOwner, isExtensionRequestOwner, isBountyParticipant } from '../resource-auth';
import { db } from '../../db';

// Mock the db object
vi.mock('../../db', () => ({
    db: {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
    } as any,
}));

describe('Resource Authorization Helpers', () => {
    const userId = 'user-123';
    const resourceId = 'resource-456';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('isBountyCreator', () => {
        it('should return true if user is the creator', async () => {
            (db.limit as any).mockResolvedValueOnce([{ id: resourceId }]);
            const result = await isBountyCreator(userId, resourceId);
            expect(result).toBe(true);
        });

        it('should return false if user is not the creator', async () => {
            (db.limit as any).mockResolvedValueOnce([]);
            const result = await isBountyCreator(userId, resourceId);
            expect(result).toBe(false);
        });
    });

    describe('isBountyAssignee', () => {
        it('should return true if user is the assignee', async () => {
            (db.limit as any).mockResolvedValueOnce([{ id: resourceId }]);
            const result = await isBountyAssignee(userId, resourceId);
            expect(result).toBe(true);
        });

        it('should return false if user is not the assignee', async () => {
            (db.limit as any).mockResolvedValueOnce([]);
            const result = await isBountyAssignee(userId, resourceId);
            expect(result).toBe(false);
        });
    });

    describe('isApplicationOwner', () => {
        it('should return true if user is the applicant', async () => {
            (db.limit as any).mockResolvedValueOnce([{ id: resourceId }]);
            const result = await isApplicationOwner(userId, resourceId);
            expect(result).toBe(true);
        });

        it('should return false if user is not the applicant', async () => {
            (db.limit as any).mockResolvedValueOnce([]);
            const result = await isApplicationOwner(userId, resourceId);
            expect(result).toBe(false);
        });
    });

    describe('isSubmissionOwner', () => {
        it('should return true if user is the developer of the submission', async () => {
            (db.limit as any).mockResolvedValueOnce([{ id: resourceId }]);
            const result = await isSubmissionOwner(userId, resourceId);
            expect(result).toBe(true);
        });

        it('should return false if user is not the developer of the submission', async () => {
            (db.limit as any).mockResolvedValueOnce([]);
            const result = await isSubmissionOwner(userId, resourceId);
            expect(result).toBe(false);
        });
    });

    describe('isExtensionRequestOwner', () => {
        it('should return true if user is the developer of the extension request', async () => {
            (db.limit as any).mockResolvedValueOnce([{ id: resourceId }]);
            const result = await isExtensionRequestOwner(userId, resourceId);
            expect(result).toBe(true);
        });

        it('should return false if user is not the developer of the extension request', async () => {
            (db.limit as any).mockResolvedValueOnce([]);
            const result = await isExtensionRequestOwner(userId, resourceId);
            expect(result).toBe(false);
        });
    });

    describe('isBountyParticipant', () => {
        it('should return true if user is a participant (creator or assignee)', async () => {
            (db.limit as any).mockResolvedValueOnce([{ id: resourceId }]);
            const result = await isBountyParticipant(userId, resourceId);
            expect(result).toBe(true);
        });

        it('should return false if user is not a participant', async () => {
            (db.limit as any).mockResolvedValueOnce([]);
            const result = await isBountyParticipant(userId, resourceId);
            expect(result).toBe(false);
        });
    });
});
