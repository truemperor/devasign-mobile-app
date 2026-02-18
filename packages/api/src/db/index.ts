import { neon, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

// Enable connection caching for better performance in serverless environments.
// This reuses the same TCP connection across multiple function invocations.
neonConfig.fetchConnectionCache = true;

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set or is empty');
}

const sql = neon(databaseUrl);
export const db = drizzle(sql, { schema });
