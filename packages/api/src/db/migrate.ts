import { drizzle } from 'drizzle-orm/neon-http';
import { migrate } from 'drizzle-orm/neon-http/migrator';
import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables from the root .env file
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

async function runMigrate() {
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
        console.error('DATABASE_URL is not set and could not be composed');
        process.exit(1);
    }

    console.log('⏳ Running migrations...');

    const start = Date.now();
    const sql = neon(databaseUrl);
    const db = drizzle(sql);

    try {
        await migrate(db, { migrationsFolder: './drizzle' });
        const end = Date.now();
        console.log(`✅ Migrations completed in ${end - start}ms`);
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed');
        console.error(error);
        process.exit(1);
    }
}

runMigrate();
