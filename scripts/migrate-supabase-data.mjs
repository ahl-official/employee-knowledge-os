import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// 1. Load current target .env.local
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      process.env[key] = val;
    }
  }
}

const TARGET_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const TARGET_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Source (Old) Supabase credentials
// Passed via CLI arguments or environment variables:
// node scripts/migrate-supabase-data.mjs <OLD_SUPABASE_URL> <OLD_SERVICE_ROLE_KEY>
const SOURCE_URL = process.argv[2] || process.env.OLD_SUPABASE_URL;
const SOURCE_KEY = process.argv[3] || process.env.OLD_SUPABASE_SERVICE_ROLE_KEY;

if (!SOURCE_URL || !SOURCE_KEY) {
  console.error("\n❌ Error: Old Supabase project credentials are required!");
  console.log("\nUsage:");
  console.log("  node scripts/migrate-supabase-data.mjs <OLD_PROJECT_URL> <OLD_SERVICE_ROLE_KEY>");
  console.log("Example:");
  console.log("  node scripts/migrate-supabase-data.mjs https://xyz.supabase.co eyJhbGciOi...");
  process.exit(1);
}

if (!TARGET_URL || !TARGET_KEY) {
  console.error("❌ Error: Target (new) Supabase credentials not found in .env.local");
  process.exit(1);
}

const sourceDb = createClient(SOURCE_URL, SOURCE_KEY, { auth: { persistSession: false } });
const targetDb = createClient(TARGET_URL, TARGET_KEY, { auth: { persistSession: false } });

// Ordered by foreign key dependency
const TABLES = [
  "employees",
  "sessions",
  "tasks",
  "messages",
  "facts",
  "branches",
  "uploads",
];

async function migrateTable(tableName) {
  console.log(`\n⏳ Fetching data from old table: [${tableName}]...`);
  
  // Fetch all records from source table (with pagination for large tables)
  let allRows = [];
  let from = 0;
  const batchSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await sourceDb
      .from(tableName)
      .select("*")
      .range(from, from + batchSize - 1);

    if (error) {
      throw new Error(`Failed to fetch from old ${tableName}: ${error.message}`);
    }

    if (data && data.length > 0) {
      allRows = allRows.concat(data);
      from += batchSize;
      if (data.length < batchSize) {
        hasMore = false;
      }
    } else {
      hasMore = false;
    }
  }

  console.log(`   Found ${allRows.length} record(s) in [${tableName}].`);

  if (allRows.length === 0) {
    console.log(`   Skipping insert (0 rows).`);
    return { count: 0, status: "skipped" };
  }

  // Insert/Upsert into target table in chunks
  const insertChunkSize = 100;
  let insertedCount = 0;

  for (let i = 0; i < allRows.length; i += insertChunkSize) {
    const chunk = allRows.slice(i, i + insertChunkSize);
    const { error: insertError } = await targetDb
      .from(tableName)
      .upsert(chunk, { onConflict: "id", ignoreDuplicates: false });

    if (insertError) {
      throw new Error(`Failed to insert into new ${tableName}: ${insertError.message}`);
    }
    insertedCount += chunk.length;
  }

  console.log(`   ✅ Successfully migrated ${insertedCount} record(s) into [${tableName}].`);
  return { count: insertedCount, status: "success" };
}

async function migrateStorageFiles() {
  console.log(`\n⏳ Checking storage bucket: [uploads]...`);
  try {
    const { data: files, error: listErr } = await sourceDb.storage.from("uploads").list("", {
      limit: 100,
      sortBy: { column: "name", order: "asc" },
    });

    if (listErr) {
      console.log(`   Note: Could not list storage root or bucket is empty (${listErr.message}).`);
      return;
    }

    if (!files || files.length === 0) {
      console.log(`   No root files found in uploads storage.`);
      return;
    }

    console.log(`   Found ${files.length} item(s) in uploads bucket. Migrating...`);

    // Ensure uploads bucket exists on target
    await targetDb.storage.createBucket("uploads", { public: false }).catch(() => {});

    for (const item of files) {
      if (item.id) {
        // file
        const { data: fileBlob, error: downErr } = await sourceDb.storage.from("uploads").download(item.name);
        if (!downErr && fileBlob) {
          const buffer = Buffer.from(await fileBlob.arrayBuffer());
          await targetDb.storage.from("uploads").upload(item.name, buffer, { upsert: true });
          console.log(`   ✅ Copied file: ${item.name}`);
        }
      }
    }
  } catch (err) {
    console.warn(`   ⚠️ Storage migration warning: ${err.message}`);
  }
}

async function runMigration() {
  console.log("=================================================");
  console.log("🚀 STARTING AUTOMATED SUPABASE DATA MIGRATION");
  console.log("=================================================");
  console.log(`From (Old): ${SOURCE_URL}`);
  console.log(`To   (New): ${TARGET_URL}`);
  console.log("=================================================");

  const summary = {};

  for (const table of TABLES) {
    try {
      summary[table] = await migrateTable(table);
    } catch (err) {
      console.error(`❌ Migration failed at table [${table}]:`, err.message);
      process.exit(1);
    }
  }

  // Migrate Storage
  await migrateStorageFiles();

  console.log("\n=================================================");
  console.log("🎉 MIGRATION COMPLETED SUCCESSFULLY!");
  console.log("=================================================");
  console.table(
    Object.entries(summary).map(([tbl, res]) => ({
      Table: tbl,
      "Records Migrated": res.count,
      Status: res.status,
    }))
  );
  console.log("=================================================\n");
}

runMigration().catch((err) => {
  console.error("\n❌ Fatal migration error:", err);
  process.exit(1);
});
