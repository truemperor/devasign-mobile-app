import { Hono } from 'hono';
import { sign } from 'hono/jwt';
import { githubService } from '../services/github';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

const auth = new Hono();

// Auth state for CSRF protection (simplified for now, ideally stored in session/cookie)
const OAUTH_STATE = 'random_state_string';

/**
 * GET /auth/github
 * Redirects to GitHub for authentication
 */
auth.get('/github', (c) => {
    const url = githubService.getAuthorizationUrl(OAUTH_STATE);
    return c.redirect(url);
});

/**
 * GET /auth/github/callback
 * Handles the redirect from GitHub
 */
auth.get('/github/callback', async (c) => {
    const code = c.req.query('code');
    const state = c.req.query('state');

    if (!code) {
        return c.json({ error: 'Authorization code missing' }, 400);
    }

    if (state !== OAUTH_STATE) {
        return c.json({ error: 'Invalid state' }, 400);
    }

    try {
        // 1. Exchange code for access token
        const accessToken = await githubService.getAccessToken(code);

        // 2. Fetch user profile
        const githubUser = await githubService.getUserProfile(accessToken);

        if (!githubUser.email) {
            return c.json({ error: 'GitHub account must have a verified email' }, 400);
        }

        // 3. Upsert user in database
        let user = await db.query.users.findFirst({
            where: eq(users.githubId, BigInt(githubUser.id)),
        });

        if (user) {
            // Update existing user
            await db.update(users)
                .set({
                    username: githubUser.login,
                    avatarUrl: githubUser.avatar_url,
                    email: githubUser.email,
                    updatedAt: new Date(),
                })
                .where(eq(users.id, user.id));
        } else {
            // Create new user
            const newUser = {
                id: uuidv4(),
                githubId: BigInt(githubUser.id),
                username: githubUser.login,
                avatarUrl: githubUser.avatar_url,
                email: githubUser.email,
                totalEarned: '0',
                bountiesCompleted: 0,
            };
            await db.insert(users).values(newUser);
            user = newUser as any; // Cast to match expected type
        }

        // 4. Generate JWT token
        const secret = process.env.JWT_SECRET || 'change-me';
        const payload = {
            sub: user!.id,
            username: user!.username,
            exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7), // 1 week
        };
        const token = await sign(payload, secret);

        // 5. Respond with user and token
        return c.json({
            user: {
                id: user!.id,
                username: user!.username,
                email: user!.email,
                avatarUrl: user!.avatarUrl,
            },
            token,
        });

    } catch (error: any) {
        console.error('OAuth Callback Error:', error);
        return c.json({ error: 'Authentication failed', message: error.message }, 500);
    }
});

export default auth;
