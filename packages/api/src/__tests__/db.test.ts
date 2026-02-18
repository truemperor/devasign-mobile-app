import { describe, it, expect } from 'vitest';
import { db } from '../db';
import { sql } from 'drizzle-orm';

describe('Database Connectivity', () => {
    it('should connect to the database and execute a simple query', async () => {
        const databaseUrl = process.env.DATABASE_URL;

        // Skip if no remote Neon database URL is provided
        // This avoids failing in environments without a real database
        if (!databaseUrl || !databaseUrl.includes('.neon.tech')) {
            console.warn('Skipping database connectivity test: No remote Neon DATABASE_URL provided');
            return;
        }

        try {
            const result = await db.execute(sql`SELECT 1 as connected`);
            expect(result).toBeDefined();
            // result should be truthy on success
            expect(result).toBeTruthy();
        } catch (error) {
            console.error('Database connection failed:', error);
            throw error;
        }
    });
});
