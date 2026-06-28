import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
});

pool.on('connect', (client) => {
  client.query('SET search_path TO confeitaria,public');
});

export const query    = (sql, p = []) => pool.query(sql, p).then((r) => r.rows);
export const queryOne = (sql, p = []) => pool.query(sql, p).then((r) => r.rows[0] ?? null);
export const execute  = (sql, p = []) => pool.query(sql, p).then((r) => r.rowCount);

export async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET search_path TO confeitaria,public');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export default pool;
