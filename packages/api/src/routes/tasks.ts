import { Hono } from 'hono';
import { Variables } from '../middleware/auth';
import { db } from '../db';
import { bounties, submissions, users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

const tasksRouter = new Hono<{ Variables: Variables }>();

/**
 * GET /api/tasks
 * Returns the authenticated user's assigned bounties grouped by status.
 * Includes bounty details, deadline, creator info, and submission status if work has been submitted.
 */
tasksRouter.get('/', async (c) => {
    const user = c.get('user');
    if (!user) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const creatorTable = alias(users, 'creator');

    // Query all bounties assigned to the current user, join with submissions and creator info
    const results = await db.select({
        bounty: {
            id: bounties.id,
            title: bounties.title,
            description: bounties.description,
            amountUsdc: bounties.amountUsdc,
            techTags: bounties.techTags,
            difficulty: bounties.difficulty,
            status: bounties.status,
            deadline: bounties.deadline,
            createdAt: bounties.createdAt,
            updatedAt: bounties.updatedAt,
        },
        creator: {
            username: creatorTable.username,
            avatarUrl: creatorTable.avatarUrl,
        },
        submission: {
            id: submissions.id,
            prUrl: submissions.prUrl,
            status: submissions.status,
            createdAt: submissions.createdAt,
        },
    })
        .from(bounties)
        .leftJoin(creatorTable, eq(bounties.creatorId, creatorTable.id))
        .leftJoin(submissions, eq(bounties.id, submissions.bountyId))
        .where(eq(bounties.assigneeId, user.id));

    // Group by status
    const grouped: Record<string, any[]> = {};
    const statuses = ['assigned', 'in_review', 'completed', 'open', 'cancelled'];
    for (const status of statuses) {
        grouped[status] = [];
    }

    for (const row of results) {
        const status = row.bounty.status;
        const item = {
            ...row.bounty,
            creator: row.creator,
            submission: row.submission?.id ? row.submission : null,
        };

        if (!grouped[status]) {
            grouped[status] = [];
        }
        grouped[status].push(item);
    }

    return c.json({
        data: grouped,
        meta: {
            total: results.length,
        },
    });
});

export default tasksRouter;
