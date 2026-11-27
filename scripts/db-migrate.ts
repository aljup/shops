import 'dotenv/config';

// Applies prisma/migrations/*/migration.sql in order.
//
// `prisma migrate deploy` is the canonical runner, but it needs the Rust schema
// engine binary, which some locked-down environments cannot download. This runner
// keeps the same migration files and records them in a private bookkeeping table.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';

const MIGRATIONS_DIR = join(process.cwd(), 'prisma', 'migrations');

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is required');
  }

  const pool = new Pool({ connectionString: url });
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "_applied_migrations" (
        "name" TEXT PRIMARY KEY,
        "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const applied = new Set(
      (await pool.query<{ name: string }>('SELECT "name" FROM "_applied_migrations"')).rows.map(
        (row) => row.name,
      ),
    );

    const migrations = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    if (migrations.length === 0) {
      process.stdout.write('No migrations found\n');
      return;
    }

    for (const name of migrations) {
      if (applied.has(name)) {
        continue;
      }
      const sql = readFileSync(join(MIGRATIONS_DIR, name, 'migration.sql'), 'utf8');
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO "_applied_migrations" ("name") VALUES ($1)', [name]);
        await client.query('COMMIT');
        process.stdout.write(`Applied ${name}\n`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }
    process.stdout.write('Database is up to date\n');
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
