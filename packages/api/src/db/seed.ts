import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { getDatabaseUrl } from './config';
import * as schema from './schema';
import { faker } from '@faker-js/faker';

async function seed() {
    console.log('⏳ Seeding database...');

    try {
        const queryClient = postgres(getDatabaseUrl());
        const db = drizzle(queryClient, { schema });

        // 1. Clear existing data (optional, but good for a fresh start)
        // Note: Order matters because of foreign key constraints
        console.log('  Cleaning up existing data...');
        await db.delete(schema.transactions);
        await db.delete(schema.messages);
        await db.delete(schema.extensionRequests);
        await db.delete(schema.disputes);
        await db.delete(schema.submissions);
        await db.delete(schema.applications);
        await db.delete(schema.bounties);
        await db.delete(schema.users);

        // 2. Generate Users
        console.log('  Generating 15 users...');
        const userBatch = Array.from({ length: 15 }).map(() => ({
            githubId: BigInt(faker.number.int({ min: 1000000, max: 99999999 })),
            username: faker.internet.username(),
            avatarUrl: faker.image.avatarGitHub(),
            email: faker.internet.email(),
            techStack: faker.helpers.arrayElements(['TypeScript', 'React', 'Node.js', 'Rust', 'Go', 'Stellar', 'Solidity', 'Python'], { min: 2, max: 5 }),
            walletAddress: `G${faker.string.alphanumeric(55).toUpperCase()}`,
            totalEarned: (Math.random() * 5000).toFixed(2),
            bountiesCompleted: faker.number.int({ min: 0, max: 20 }),
        }));
        const seededUsers = await db.insert(schema.users).values(userBatch).returning();

        // 3. Generate Bounties
        console.log('  Generating 25 bounties...');
        const statuses: ('open' | 'assigned' | 'in_review' | 'completed' | 'cancelled')[] = ['open', 'assigned', 'in_review', 'completed', 'cancelled'];
        const difficulties: ('beginner' | 'intermediate' | 'advanced')[] = ['beginner', 'intermediate', 'advanced'];

        const bountyBatch = Array.from({ length: 25 }).map(() => {
            const creator = faker.helpers.arrayElement(seededUsers);
            const status = faker.helpers.arrayElement(statuses);
            let assigneeId = null;
            if (status !== 'open' && status !== 'cancelled') {
                assigneeId = faker.helpers.arrayElement(seededUsers.filter(u => u.id !== creator.id)).id;
            }

            return {
                githubIssueId: faker.number.int({ min: 1, max: 10000 }),
                repoOwner: faker.helpers.arrayElement(['devasign', 'stellar', 'foundation', 'github']),
                repoName: faker.helpers.arrayElement(['monorepo', 'core-api', 'sdk-js', 'stellar-wallet']),
                title: faker.lorem.sentence({ min: 3, max: 8 }),
                description: faker.lorem.paragraphs(2),
                amountUsdc: (Math.random() * 2000 + 100).toFixed(2),
                techTags: faker.helpers.arrayElements(['TypeScript', 'React', 'Rust', 'Go', 'Next.js'], { min: 1, max: 3 }),
                difficulty: faker.helpers.arrayElement(difficulties),
                status: status,
                creatorId: creator.id,
                assigneeId: assigneeId,
                deadline: faker.date.future(),
            };
        });
        const seededBounties = await db.insert(schema.bounties).values(bountyBatch).returning();

        // 4. Generate Applications
        console.log('  Generating applications...');
        const applicationBatch: (typeof schema.applications.$inferInsert)[] = [];
        for (const bounty of seededBounties) {
            if (bounty.status === 'open' || bounty.status === 'assigned') {
                const numApps = faker.number.int({ min: 1, max: 5 });
                const potentialApplicants = seededUsers.filter(u => u.id !== bounty.creatorId);
                const applicants = faker.helpers.arrayElements(potentialApplicants, numApps);

                for (const applicant of applicants) {
                    const appStatus = (bounty.assigneeId === applicant.id ? 'accepted' : faker.helpers.arrayElement(['pending', 'rejected'])) as 'pending' | 'accepted' | 'rejected';
                    applicationBatch.push({
                        bountyId: bounty.id,
                        applicantId: applicant.id,
                        coverLetter: faker.lorem.paragraph(),
                        estimatedTime: faker.number.int({ min: 2, max: 14 }),
                        experienceLinks: [faker.internet.url(), faker.internet.url()],
                        status: appStatus,
                    });
                }
            }
        }
        await db.insert(schema.applications).values(applicationBatch as any);

        // 5. Generate Submissions
        console.log('  Generating submissions...');
        const submissionBatch: (typeof schema.submissions.$inferInsert)[] = [];
        for (const bounty of seededBounties) {
            if (bounty.status === 'in_review' || bounty.status === 'completed') {
                const subStatus = (bounty.status === 'completed' ? 'approved' : 'pending') as 'pending' | 'approved' | 'rejected' | 'disputed';
                submissionBatch.push({
                    bountyId: bounty.id,
                    developerId: bounty.assigneeId!,
                    prUrl: `https://github.com/${bounty.repoOwner}/${bounty.repoName}/pull/${faker.number.int({ min: 1, max: 1000 })}`,
                    status: subStatus,
                    notes: faker.lorem.sentence(),
                });
            }
        }
        if (submissionBatch.length > 0) {
            await db.insert(schema.submissions).values(submissionBatch as any);
        }

        // 6. Generate Messages
        console.log('  Generating messages...');
        const messageBatch: (typeof schema.messages.$inferInsert)[] = [];
        for (const bounty of seededBounties) {
            const participants = [bounty.creatorId];
            if (bounty.assigneeId) participants.push(bounty.assigneeId);

            if (participants.length > 1) {
                const numMessages = faker.number.int({ min: 3, max: 10 });
                for (let i = 0; i < numMessages; i++) {
                    const senderId = faker.helpers.arrayElement(participants);
                    const recipientId = participants.find(p => p !== senderId)!;
                    messageBatch.push({
                        bountyId: bounty.id,
                        senderId,
                        recipientId,
                        content: faker.lorem.sentence(),
                    });
                }
            }
        }
        if (messageBatch.length > 0) {
            await db.insert(schema.messages).values(messageBatch as any);
        }

        // 7. Generate Transactions
        console.log('  Generating transactions...');
        const transactionBatch: (typeof schema.transactions.$inferInsert)[] = [];
        for (const bounty of seededBounties) {
            // Funding transaction for every bounty
            transactionBatch.push({
                userId: bounty.creatorId,
                type: 'bounty_funding' as 'bounty_funding' | 'bounty_payout' | 'bounty_refund',
                amountUsdc: bounty.amountUsdc,
                bountyId: bounty.id,
                stellarTxHash: faker.string.hexadecimal({ length: 64, prefix: '' }),
                status: 'completed' as 'pending' | 'completed' | 'failed',
            });

            // Payout for completed bounties
            if (bounty.status === 'completed' && bounty.assigneeId) {
                transactionBatch.push({
                    userId: bounty.assigneeId,
                    type: 'bounty_payout' as 'bounty_funding' | 'bounty_payout' | 'bounty_refund',
                    amountUsdc: bounty.amountUsdc,
                    bountyId: bounty.id,
                    stellarTxHash: faker.string.hexadecimal({ length: 64, prefix: '' }),
                    status: 'completed' as 'pending' | 'completed' | 'failed',
                });
            }
        }
        if (transactionBatch.length > 0) {
            await db.insert(schema.transactions).values(transactionBatch as any);
        }

        console.log('✅ Seeding completed');
        process.exit(0);
    } catch (error) {
        console.error('❌ Seeding failed');
        console.error(error);
        process.exit(1);
    }
}

seed();
