import { readFileSync } from 'fs';
import { join } from 'path';
import { getPool } from '../packages/db/src/client';

async function runMigration() {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const migrationPath = join(__dirname, '../packages/db/src/migrations/0000_initial.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    console.log('Running migration...');
    await client.query(migrationSQL);
    console.log('Migration completed successfully!');
  } catch (error: any) {
    console.error('Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch((error) => {
  console.error('Error running migration:', error);
  process.exit(1);
});


