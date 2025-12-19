// src/db/pool.ts
import dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config();

let pool: Pool;

function createPoolFromEnv(): Pool {
  // If you prefer a single DATABASE_URL:
  if (process.env.DATABASE_URL) {
    return new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }

  const host = process.env.DB_HOST;
  const port = process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432;
  const dbName = process.env.DB_NAME;
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;

  if (!host || !dbName || !user) {
    throw new Error("DB_HOST, DB_NAME, DB_USER must be set in .env");
  }

  return new Pool({
    host,
    port,
    database: dbName,
    user,
    password,
  });
}

export function getDb(): Pool {
  if (!pool) {
    pool = createPoolFromEnv();
  }
  return pool;
}
