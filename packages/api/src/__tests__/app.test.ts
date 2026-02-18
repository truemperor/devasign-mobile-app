import { describe, it, expect, beforeAll } from 'vitest';
import { createApp } from '../app';
import { createMockDb, mockQueryResult } from './mocks/db';
import { createMockGeminiService, createMockStellarService } from './mocks/services';

describe('API App', () => {
    let app: ReturnType<typeof createApp>;

    beforeAll(() => {
        app = createApp();
    });

    // ── Health Endpoint ──────────────────────────────────────────────

    describe('GET /health', () => {
        it('should return 200 with status ok', async () => {
            const res = await app.request('/health');

            expect(res.status).toBe(200);

            const body = await res.json();
            expect(body).toEqual({ status: 'ok' });
        });
    });

    // ── Gemini Endpoint ──────────────────────────────────────────────

    describe('POST /api/gemini', () => {
        it('should return 200 with valid prompt', async () => {
            const res = await app.request('/api/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: 'Hello, AI!' }),
            });

            expect(res.status).toBe(200);

            const body = await res.json();
            expect(body).toEqual({
                message: 'Request received securely on backend',
                status: 'success',
            });
        });

        it('should return 400 when prompt is missing', async () => {
            const res = await app.request('/api/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            });

            expect(res.status).toBe(400);

            const body = await res.json();
            expect(body.error).toBe('Prompt is required and must be a non-empty string');
        });

        it('should return 400 when prompt is empty string', async () => {
            const res = await app.request('/api/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: '   ' }),
            });

            expect(res.status).toBe(400);
        });

        it('should return 400 when prompt is not a string', async () => {
            const res = await app.request('/api/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: 123 }),
            });

            expect(res.status).toBe(400);
        });
    });

    // ── Mock Utilities Smoke Tests ───────────────────────────────────

    describe('Mock utilities', () => {
        it('should create a functional mock database client', () => {
            const db = createMockDb();

            expect(db.query).toBeDefined();
            expect(db.connect).toBeDefined();
            expect(db.disconnect).toBeDefined();
            expect(db.transaction).toBeDefined();
        });

        it('should allow configuring mock db query results', async () => {
            const db = createMockDb();
            const mockUsers = [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }];
            db.query.mockResolvedValue(mockQueryResult(mockUsers));

            const result = await db.query('SELECT * FROM users');
            expect(result.rows).toEqual(mockUsers);
            expect(result.rowCount).toBe(2);
        });

        it('should create a functional mock Gemini service', async () => {
            const gemini = createMockGeminiService();
            const result = await gemini.generateContent('test prompt');

            expect(result.text).toBe('Mock AI response');
            expect(gemini.generateContent).toHaveBeenCalledWith('test prompt');
        });

        it('should create a functional mock Stellar service', async () => {
            const stellar = createMockStellarService();
            const balance = await stellar.getBalance('MOCK_ADDRESS');

            expect(balance).toBe('0.00');
            expect(stellar.getBalance).toHaveBeenCalledWith('MOCK_ADDRESS');
        });
    });
});
