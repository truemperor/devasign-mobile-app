import { db } from './index';
import * as schema from './schema';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables from the root .env file
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

async function seed() {
    console.log('⏳ Seeding database...');

    try {
        // Add your seeding logic here
        // Example:
        // await db.insert(schema.users).values({
        //     githubId: 12345,
        //     username: 'testuser',
        //     email: 'test@example.com',
        // });

        console.log('✅ Seeding completed');
    } catch (error) {
        console.error('❌ Seeding failed');
        console.error(error);
        process.exit(1);
    }
}

seed();
