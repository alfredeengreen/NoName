import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

let pool: Pool | null = null;
let db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (db) {
    return db;
  }

  const connectionString = process.env.DATABASE_URL || 'postgresql://analytics:analytics@localhost:5432/analytics';

  // Create connection pool with better configuration
  pool = new Pool({
    connectionString,
    min: 1,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    // Close idle clients after 30 seconds
    // This helps prevent connection leaks
  });

  // Handle pool errors
  pool.on('error', (err) => {
    console.error('Unexpected database pool error:', err);
  });

  // Create drizzle instance
  db = drizzle(pool, { schema });

  return db;
}

export function getPool(): Pool {
  if (!pool) {
    getDb(); // Initialize pool if not already initialized
  }
  return pool!;
}

export async function closeDb() {
  if (pool) {
    await pool.end();
    pool = null;
    db = null;
  }
}

