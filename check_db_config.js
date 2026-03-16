require('dotenv').config();
const { pool } = require('./db');

console.log('DB Config:', {
  hasDatabaseUrl: !!process.env.DATABASE_URL,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  user: process.env.DB_USER
});

process.exit(0);
