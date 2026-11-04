import { Pool } from "pg";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:jwp0MTihsHDJUQb3@db.uzmskxruuvfgokststox.supabase.co:5432/postgres";

// Global pool instance to prevent connection exhaustion in serverless/dev reload
let pool: Pool;

declare global {
  var __awtmods_pg_pool: Pool | undefined;
}

if (process.env.NODE_ENV === "production") {
  pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
  });
} else {
  if (!global.__awtmods_pg_pool) {
    global.__awtmods_pg_pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
    });
  }
  pool = global.__awtmods_pg_pool;
}

export { pool };

export async function query(text: string, params?: any[]) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  return res;
}

