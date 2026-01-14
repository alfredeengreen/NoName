const { readFileSync } = require('fs');
const { join } = require('path');
const { Pool } = require('pg');

async function runMigration() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://analytics:analytics@localhost:5432/analytics';
  const pool = new Pool({ connectionString });
  const client = await pool.connect();

  try {
    const migrationPath = join(__dirname, '..', 'packages', 'db', 'src', 'migrations', '0000_initial.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    console.log('Running migration...');
    await client.query(migrationSQL);
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error.message);
    if (error.code) {
      console.error('Error code:', error.code);
    }
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

