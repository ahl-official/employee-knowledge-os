// One-time schema runner. Usage: node scripts/run-schema.mjs "<postgres-connection-string>"
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(__dirname, "..", "supabase", "schema.sql"), "utf8");

const connectionString = process.argv[2];
if (!connectionString) {
  console.error("Missing connection string argument.");
  process.exit(1);
}

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  await client.query(sql);
  console.log("SCHEMA_OK");
} catch (err) {
  console.error("SCHEMA_ERR:", err.message);
  process.exit(2);
} finally {
  await client.end().catch(() => {});
}
