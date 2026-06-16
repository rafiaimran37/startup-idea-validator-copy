const { pool, ensureUsersTable, ensureIdeasTable, hasDatabaseConfig } = require("../../config/db");

function assertDbConfigured() {
  if (!hasDatabaseConfig()) {
    throw new Error("Database config is incomplete. Set DB_USER, DB_PASSWORD, and DB_NAME to use PostgreSQL tools.");
  }
}

async function getUsers() {
  assertDbConfigured();
  await ensureUsersTable();
  const result = await pool.query(
    "SELECT id, username, email, created_at FROM users ORDER BY created_at DESC"
  );

  return {
    users: result.rows,
    count: result.rowCount,
  };
}

async function saveAnalysis(input = {}) {
  assertDbConfigured();
  await ensureUsersTable();
  await ensureIdeasTable();

  const {
    userId = null,
    title,
    description,
    targetAudience,
    analysis,
  } = input;

  if (!title || !description || !targetAudience || !analysis) {
    throw new Error("title, description, targetAudience, and analysis are required to save an analysis.");
  }

  const analysisValue = typeof analysis === "string" ? JSON.parse(analysis) : analysis;
  const result = await pool.query(
    `INSERT INTO ideas (user_id, title, description, target_audience, analysis)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, user_id, title, description, target_audience, analysis, created_at`,
    [userId, title, description, targetAudience, analysisValue]
  );

  return {
    saved: true,
    report: result.rows[0],
  };
}

async function getAnalysisHistory(input = {}) {
  assertDbConfigured();
  await ensureIdeasTable();

  const limit = Number.isFinite(Number(input.limit)) ? Math.max(1, Math.min(100, Number(input.limit))) : 20;
  const userId = input.userId ? Number(input.userId) : null;

  const params = [];
  let query = `
    SELECT id, user_id, title, description, target_audience, analysis, created_at
    FROM ideas
  `;

  if (userId) {
    params.push(userId);
    query += ` WHERE user_id = $${params.length}`;
  }

  params.push(limit);
  query += ` ORDER BY created_at DESC LIMIT $${params.length}`;

  const result = await pool.query(query, params);
  return {
    history: result.rows,
    count: result.rowCount,
  };
}

module.exports = {
  getUsers,
  saveAnalysis,
  getAnalysisHistory,
};