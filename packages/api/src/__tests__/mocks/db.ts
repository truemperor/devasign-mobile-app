import { vi, type Mock } from 'vitest';

/**
 * Mock database client interface.
 * Mirrors the expected API of a database client (e.g., pg, Drizzle, Prisma).
 */
export interface MockDbClient {
    query: Mock<(...args: any[]) => any>;
    connect: Mock<(...args: any[]) => any>;
    disconnect: Mock<(...args: any[]) => any>;
    transaction: Mock<(...args: any[]) => any>;
}

/**
 * Creates a mock database client for use in tests.
 *
 * @example
 * ```ts
 * const db = createMockDb();
 * db.query.mockResolvedValue({ rows: [{ id: 1, name: 'Test' }] });
 * ```
 */
export function createMockDb(): MockDbClient {
    return {
        query: vi.fn<(...args: any[]) => any>().mockResolvedValue({ rows: [], rowCount: 0 }),
        connect: vi.fn<(...args: any[]) => any>().mockResolvedValue(undefined),
        disconnect: vi.fn<(...args: any[]) => any>().mockResolvedValue(undefined),
        transaction: vi.fn<(...args: any[]) => any>().mockImplementation(async (fn: (tx: any) => Promise<any>) => {
            return fn({
                query: vi.fn<(...args: any[]) => any>().mockResolvedValue({ rows: [], rowCount: 0 }),
            });
        }),
    };
}

/**
 * Utility to create a mock query result with typed rows.
 */
export function mockQueryResult<T>(rows: T[]) {
    return { rows, rowCount: rows.length };
}

