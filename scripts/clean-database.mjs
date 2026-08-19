import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// Load .env.local
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const db = createClient(supabaseUrl, supabaseKey);

async function cleanDatabase() {
  console.log("🧹 Clearing all test data from database...\n");

  await db.from("messages").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  console.log("✅ Cleared messages");

  await db.from("facts").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  console.log("✅ Cleared facts");

  await db.from("branches").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  console.log("✅ Cleared branches");

  await db.from("tasks").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  console.log("✅ Cleared tasks");

  await db.from("uploads").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  console.log("✅ Cleared uploads");

  await db.from("sessions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  console.log("✅ Cleared sessions");

  await db.from("employees").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  console.log("✅ Cleared employees");

  console.log("\n🎉 Database reset 100% clean! Ready for fresh start.");
}

cleanDatabase().catch(console.error);
