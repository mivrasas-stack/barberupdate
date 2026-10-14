import pg from 'pg';
const { Pool } = pg;
export function createDb(config) {
  if (!config.databaseUrl) return null;
  const pool = new Pool({
    connectionString: config.databaseUrl,
    max: config.poolMax,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    statement_timeout: 10000,
    application_name: 'barberos-api',
  });
  async function transaction(fn) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const value = await fn(client);
      await client.query('COMMIT');
      return value;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  return { pool, query: (sql, args) => pool.query(sql, args), transaction, close: () => pool.end() };
}
