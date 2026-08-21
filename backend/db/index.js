const { Pool } = require('pg');

// Railway provides DATABASE_URL, use it if available
const connectionConfig = process.env.DATABASE_URL
  ? {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  }
  : {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'absensi',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'sa',
  };

const pool = new Pool(connectionConfig);

pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

pool.query('ALTER TABLE employee_details ADD COLUMN IF NOT EXISTS is_sales BOOLEAN DEFAULT FALSE')
  .catch((err) => console.warn('DB patch is_sales:', err.message));

module.exports = { pool };
