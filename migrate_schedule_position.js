const { pool } = require('./backend/db');

async function main() {
  try {
    console.log('Starting migration: Add position to work_schedule_types...');
    await pool.query('ALTER TABLE work_schedule_types ADD COLUMN IF NOT EXISTS position VARCHAR(100)');
    console.log('Migration successful.');
  } catch(e) {
    console.error('Migration failed:', e);
  } finally {
    process.exit(0);
  }
}

main();
