import { Hono } from 'hono';
import { Variables } from '../middleware/auth';
import { db } from '../db';
import { bounties, submissions, users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { ensureBountyAssignee } from '../middleware/resource-auth';

const tasksRouter = new Hono<{ Variables: Variables }>();

const submitWorkSchema = z.object({
    pr_url: z.string().url('Invalid PR URL'),
    supporting_links: z.array(z.string().url('Invalid supporting link URL')).optional().default([]),
    notes: z.string().optional(),
});

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

    // Derive status groups from schema to stay in sync with enum changes
    const initialGroups = bounties.status.enumValues.reduce((acc, status) => {
        acc[status] = [];
        return acc;
    }, {} as Record<string, any[]>);

    const grouped = results.reduce((acc, row) => {
        const status = row.bounty.status;
        const item = {
            ...row.bounty,
            creator: row.creator,
            submission: row.submission?.id ? row.submission : null,
        };
        acc[status].push(item);
        return acc;
    }, initialGroups);

    return c.json({
        data: grouped,
        meta: {
            total: results.length,
        },
    });
});

/**
 * POST /api/tasks/:id/submit
 * Submit work for an assigned bounty.
 * Body: { pr_url: string, supporting_links?: string[], notes?: string }
 */
tasksRouter.post('/:id/submit', ensureBountyAssignee('id'), async (c) => {
    const user = c.get('user');
    const id = c.req.param('id');

    const rawBody = await c.req.json().catch(() => null);
    const validation = submitWorkSchema.safeParse(rawBody);

    if (!validation.success) {
        return c.json({ error: validation.error.flatten().fieldErrors }, 400);
    }

    const { pr_url, supporting_links, notes } = validation.data;

    try {
        const result = await db.transaction(async (tx) => {
            // 1. Verify bounty is in 'assigned' status
            const bounty = await tx.query.bounties.findFirst({
                where: eq(bounties.id, id),
            });

            if (!bounty) {
                throw new Error('Bounty not found');
            }

            if (bounty.status !== 'assigned') {
                throw new Error(`Cannot submit work for bounty with status: ${bounty.status}`);
            }

            // 2. Create submission
            const [submission] = await tx.insert(submissions).values({
                bountyId: id,
                developerId: user.id,
                prUrl: pr_url,
                supportingLinks: supporting_links,
                notes: notes,
                status: 'pending',
            }).returning();

            // 3. Update bounty status to 'in_review'
            await tx.update(bounties)
                .set({
                    status: 'in_review',
                    updatedAt: new Date(),
                })
                .where(eq(bounties.id, id));

            return submission;
        });

        return c.json(result, 201);
    } catch (err: any) {
        if (err.message === 'Bounty not found') {
            return c.json({ error: err.message }, 404);
        }
        if (err.message.includes('Cannot submit work')) {
            return c.json({ error: err.message }, 400);
        }
        throw err;
    }
});

export default tasksRouter;
