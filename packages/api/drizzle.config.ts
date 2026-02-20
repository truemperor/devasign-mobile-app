import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables from the root .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

let databaseUrl = process.env.DATABASE_URL;

// Compose DATABASE_URL from individual POSTGRES_* variables if not explicitly set.
if (!databaseUrl) {
    const { POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB } = process.env;
    const POSTGRES_HOST = process.env.POSTGRES_HOST || 'localhost';
    const POSTGRES_PORT = process.env.POSTGRES_PORT || '5432';

    if (POSTGRES_USER && POSTGRES_PASSWORD && POSTGRES_DB) {
        databaseUrl = `postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}`;
    }
}

if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set and could not be composed');
}

export default defineConfig({
    schema: './src/db/schema.ts',
    out: './drizzle',
    dialect: 'postgresql',
    dbCredentials: {
        url: databaseUrl,
    },
});
