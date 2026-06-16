const { Pool } = require("pg");

function hasDatabaseConfig() {
  return Boolean(process.env.DB_USER && process.env.DB_PASSWORD && process.env.DB_NAME);
}

// Create one shared PostgreSQL pool for the whole app.
// This keeps database access fast and avoids opening a new connection per request.
const pool = new Pool({
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "",
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || "startup_ai",
});

async function ensureUsersTable() {
  const query = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(100) NOT NULL,
      email VARCHAR(150) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await pool.query(query);
}

// Create ideas table linked to users
async function ensureIdeasTable() {
  const query = `
    CREATE TABLE IF NOT EXISTS ideas (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      target_audience VARCHAR(255) NOT NULL,
      analysis JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await pool.query(query);
}

module.exports = {
  pool,
  ensureUsersTable,
  ensureIdeasTable,
  hasDatabaseConfig,
};