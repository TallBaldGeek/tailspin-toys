import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllCategories,
    getAllGames,
    getAllGameIds,
    getAllPublishers,
    getGameById,
} from './games';

async function seedGames(db: Database, count: number): Promise<void> {
    const [category] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id });
    const [publisher] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'pub' })
        .returning({ id: publishers.id });

    // Insert titles in reverse-alphabetical order to prove ordering is applied.
    for (let i = count; i >= 1; i--) {
        await db.insert(games).values({
            title: `Game ${String(i).padStart(2, '0')}`,
            description: `Description ${i}`,
            starRating: 4.2,
            categoryId: category.id,
            publisherId: publisher.id,
        });
    }
}

interface FilterFixture {
    categoryIds: {
        strategy: number;
        puzzle: number;
    };
    publisherIds: {
        one: number;
        two: number;
    };
}

async function seedFilterFixture(db: Database): Promise<FilterFixture> {
    const [strategy, puzzle] = await db
        .insert(categories)
        .values([
            { name: 'Strategy', description: 'cat' },
            { name: 'Puzzle', description: 'cat' },
        ])
        .returning({ id: categories.id, name: categories.name });
    const [pubOne, pubTwo] = await db
        .insert(publishers)
        .values([
            { name: 'Pub One', description: 'pub' },
            { name: 'Pub Two', description: 'pub' },
        ])
        .returning({ id: publishers.id, name: publishers.name });

    await db.insert(games).values([
        {
            title: 'Alpha Strategy',
            description: 'desc',
            starRating: 4.2,
            categoryId: strategy.id,
            publisherId: pubOne.id,
        },
        {
            title: 'Bravo Puzzle',
            description: 'desc',
            starRating: 4.2,
            categoryId: puzzle.id,
            publisherId: pubOne.id,
        },
        {
            title: 'Charlie Strategy',
            description: 'desc',
            starRating: 4.2,
            categoryId: strategy.id,
            publisherId: pubTwo.id,
        },
        {
            title: 'Delta Puzzle',
            description: 'desc',
            starRating: 4.2,
            categoryId: puzzle.id,
            publisherId: pubTwo.id,
        },
    ]);

    return {
        categoryIds: {
            strategy: strategy.id,
            puzzle: puzzle.id,
        },
        publisherIds: {
            one: pubOne.id,
            two: pubTwo.id,
        },
    };
}

describe('games data-access helpers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all games ordered by title', async () => {
        await seedGames(db, 3);
        const all = await getAllGames(db);
        expect(all.map((g) => g.title)).toEqual(['Game 01', 'Game 02', 'Game 03']);
        expect(all[0].category).toEqual({ id: expect.any(Number), name: 'Strategy' });
        expect(all[0].publisher).toEqual({ id: expect.any(Number), name: 'Pub One' });
    });

    it('returns all game ids ordered by title', async () => {
        await seedGames(db, 3);
        const ids = await getAllGameIds(db);
        const all = await getAllGames(db);
        expect(ids).toEqual(all.map((g) => g.id));
    });

    it('fetches a single game by id', async () => {
        await seedGames(db, 2);
        const ids = await getAllGameIds(db);
        const game = await getGameById(db, ids[0]);
        expect(game?.title).toBe('Game 01');
    });

    it('returns null for a non-existent game', async () => {
        await seedGames(db, 2);
        expect(await getGameById(db, 99999)).toBeNull();
    });

    it('filters games by one category', async () => {
        const fixture = await seedFilterFixture(db);
        const filtered = await getAllGames(db, { categoryIds: [fixture.categoryIds.strategy] });
        expect(filtered.map((g) => g.title)).toEqual(['Alpha Strategy', 'Charlie Strategy']);
    });

    it('filters games by multiple categories with OR semantics', async () => {
        const fixture = await seedFilterFixture(db);
        const filtered = await getAllGames(db, {
            categoryIds: [fixture.categoryIds.puzzle, fixture.categoryIds.strategy],
        });
        expect(filtered.map((g) => g.title)).toEqual([
            'Alpha Strategy',
            'Bravo Puzzle',
            'Charlie Strategy',
            'Delta Puzzle',
        ]);
    });

    it('filters games by publisher', async () => {
        const fixture = await seedFilterFixture(db);
        const filtered = await getAllGames(db, { publisherId: fixture.publisherIds.two });
        expect(filtered.map((g) => g.title)).toEqual(['Charlie Strategy', 'Delta Puzzle']);
    });

    it('combines category and publisher filters', async () => {
        const fixture = await seedFilterFixture(db);
        const filtered = await getAllGames(db, {
            categoryIds: [fixture.categoryIds.strategy],
            publisherId: fixture.publisherIds.two,
        });
        expect(filtered.map((g) => g.title)).toEqual(['Charlie Strategy']);
    });

    it('returns an empty list when no games match the filters', async () => {
        const fixture = await seedFilterFixture(db);
        const filtered = await getAllGames(db, {
            categoryIds: [fixture.categoryIds.strategy],
            publisherId: 99999,
        });
        expect(filtered).toEqual([]);
    });

    it('returns categories and publishers ordered by name', async () => {
        await seedFilterFixture(db);
        const categoryOptions = await getAllCategories(db);
        const publisherOptions = await getAllPublishers(db);

        expect(categoryOptions.map((c) => c.name)).toEqual(['Puzzle', 'Strategy']);
        expect(publisherOptions.map((p) => p.name)).toEqual(['Pub One', 'Pub Two']);
    });
});
