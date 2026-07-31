import { and, asc, eq, inArray } from 'drizzle-orm';
import type { Database } from './db';
import { games, categories, publishers } from '../../db/schema';
import type { Game } from '../types/game';
import type { Category, Publisher } from '../types/game';

const gameSelection = {
    id: games.id,
    title: games.title,
    description: games.description,
    starRating: games.starRating,
    categoryId: categories.id,
    categoryName: categories.name,
    publisherId: publishers.id,
    publisherName: publishers.name,
};

type GameSelectionRow = {
    id: number;
    title: string;
    description: string;
    starRating: number | null;
    categoryId: number | null;
    categoryName: string | null;
    publisherId: number | null;
    publisherName: string | null;
};

function mapGame(row: GameSelectionRow): Game {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        starRating: row.starRating,
        category:
            row.categoryId !== null && row.categoryName !== null
                ? { id: row.categoryId, name: row.categoryName }
                : null,
        publisher:
            row.publisherId !== null && row.publisherName !== null
                ? { id: row.publisherId, name: row.publisherName }
                : null,
    };
}

function baseGamesQuery(db: Database) {
    return db
        .select(gameSelection)
        .from(games)
        .leftJoin(categories, eq(games.categoryId, categories.id))
        .leftJoin(publishers, eq(games.publisherId, publishers.id));
}

export interface GameFilters {
    categoryIds?: number[];
    publisherId?: number;
}

/**
 * Returns all games in stable title order, optionally filtered by category and publisher.
 * @param db Drizzle database client injected by the caller.
 * @param filters Optional category/publisher filters for the game listing.
 * @returns Promise resolving to games that match the provided filters.
 */
export async function getAllGames(db: Database, filters?: GameFilters): Promise<Game[]> {
    const categoryIds = filters?.categoryIds ?? [];
    const publisherId = filters?.publisherId;
    const hasCategoryFilter = categoryIds.length > 0;
    const hasPublisherFilter = publisherId !== undefined;

    const rows = await (
        hasCategoryFilter && hasPublisherFilter
            ? baseGamesQuery(db).where(and(inArray(games.categoryId, categoryIds), eq(games.publisherId, publisherId)))
            : hasCategoryFilter
              ? baseGamesQuery(db).where(inArray(games.categoryId, categoryIds))
              : hasPublisherFilter
                ? baseGamesQuery(db).where(eq(games.publisherId, publisherId))
                : baseGamesQuery(db)
    ).orderBy(asc(games.title));

    return rows.map(mapGame);
}

/**
 * Returns all game IDs in stable title order.
 * @param db Drizzle database client injected by the caller.
 * @returns Promise resolving to all game IDs sorted by title.
 */
export async function getAllGameIds(db: Database): Promise<number[]> {
    const rows = await db.select({ id: games.id }).from(games).orderBy(asc(games.title));
    return rows.map((row) => row.id);
}

/**
 * Returns a single game for the provided identifier.
 * @param db Drizzle database client injected by the caller.
 * @param id Game identifier to load.
 * @returns Promise resolving to the matching game, or null when no game exists for the id.
 */
export async function getGameById(db: Database, id: number): Promise<Game | null> {
    const rows = await baseGamesQuery(db).where(eq(games.id, id)).limit(1);
    return rows.length > 0 ? mapGame(rows[0]) : null;
}

/**
 * Returns all categories available to the game catalog in stable name order.
 * @param db Drizzle database client injected by the caller.
 * @returns Promise resolving to category filter options sorted alphabetically.
 */
export async function getAllCategories(db: Database): Promise<Category[]> {
    return db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.name));
}

/**
 * Returns all publishers available to the game catalog in stable name order.
 * @param db Drizzle database client injected by the caller.
 * @returns Promise resolving to publisher filter options sorted alphabetically.
 */
export async function getAllPublishers(db: Database): Promise<Publisher[]> {
    return db.select({ id: publishers.id, name: publishers.name }).from(publishers).orderBy(asc(publishers.name));
}
