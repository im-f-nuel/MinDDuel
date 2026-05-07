import 'dotenv/config'
import postgres from 'postgres'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL not set')
  process.exit(1)
}

const sql = postgres(url, { prepare: false, max: 1 })

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS matches (
  match_id      TEXT PRIMARY KEY,
  join_code     TEXT NOT NULL UNIQUE,
  player_one    TEXT NOT NULL,
  player_two    TEXT,
  mode          TEXT NOT NULL,
  stake         REAL NOT NULL,
  currency      TEXT NOT NULL,
  status        TEXT NOT NULL,
  winner        TEXT,
  pot           REAL,
  fee           REAL,
  on_chain_sig  TEXT,
  created_at    BIGINT NOT NULL,
  updated_at    BIGINT NOT NULL,
  finished_at   BIGINT
);

CREATE INDEX IF NOT EXISTS idx_matches_p1      ON matches(player_one);
CREATE INDEX IF NOT EXISTS idx_matches_p2      ON matches(player_two);
CREATE INDEX IF NOT EXISTS idx_matches_status  ON matches(status);
CREATE INDEX IF NOT EXISTS idx_matches_created ON matches(created_at);

CREATE TABLE IF NOT EXISTS queue (
  player_id  TEXT PRIMARY KEY,
  mode       TEXT NOT NULL,
  stake      REAL NOT NULL,
  currency   TEXT NOT NULL,
  joined_at  BIGINT NOT NULL
);
`

console.log('Connecting to Neon...')
try {
  await sql.unsafe(SCHEMA_SQL)
  console.log('✓ Schema applied successfully')

  const tables = await sql`SELECT tablename FROM pg_tables WHERE schemaname='public'`
  console.log('Tables in public schema:', tables.map(r => r.tablename).join(', '))
} catch (e) {
  console.error('Migration failed:', e)
  process.exit(1)
} finally {
  await sql.end()
}
