import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// 1. Load .env.local
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
  console.error("❌ Missing Supabase URL or Service Role Key in .env.local");
  process.exit(1);
}

const db = createClient(supabaseUrl, supabaseKey);

// IDs of employees to delete
const targetIds = [
  "2d06a15b-9a0e-4f78-87e2-31c99bfe51f6", // fyxyhf
  "61d6409e-5a5b-4e78-b55a-9539f9f69d0d", // Test Persona Finance GST
  "6b88e3ff-a56e-415a-9e6d-d72d2cb78a30", // Test Persona Editing Reels
  "6acbe130-4736-4020-afd1-7f7421807c4b", // Test Persona Ops WhatsApp
  "65afb697-7c48-45d4-9e6b-136fc3a2c62e", // Tanmay
  "9c8b84d3-ccf4-4af9-bb07-30b30d4a23c0", // Tanmay Patil
  "bb7cd70a-d844-4808-bc6b-65d974ce2908", // saburi
];

async function run() {
  console.log("🔍 Fetching target employee details before deletion...");
  const { data: targets, error: fetchErr } = await db
    .from("employees")
    .select("id, full_name, department, status, overall_progress")
    .in("id", targetIds);

  if (fetchErr) {
    console.error("❌ Error fetching employees:", fetchErr);
    process.exit(1);
  }

  console.log("Found employees to delete:");
  targets.forEach((e) => console.log(` - [${e.id}] ${e.full_name} (${e.department || "No dept"})`));

  // Clean up any uploaded storage files for these employees
  console.log("\n📦 Cleaning up storage files in bucket 'uploads'...");
  for (const emp of targets) {
    try {
      const { data: files } = await db.storage.from("uploads").list(emp.id);
      if (files && files.length > 0) {
        const filePaths = files.map((f) => `${emp.id}/${f.name}`);
        const { error: rmErr } = await db.storage.from("uploads").remove(filePaths);
        if (rmErr) {
          console.warn(`⚠️ Warning removing files for ${emp.full_name}:`, rmErr.message);
        } else {
          console.log(`  Removed ${filePaths.length} storage files for ${emp.full_name}`);
        }
      }
    } catch (e) {
      console.warn(`  Could not inspect storage for ${emp.id}:`, e.message);
    }
  }

  // Delete from employees table (cascades to messages, sessions, tasks, facts, branches, uploads)
  console.log("\n🗑️ Deleting employees from database...");
  const { data: deleted, error: delErr } = await db
    .from("employees")
    .delete()
    .in("id", targetIds)
    .select("id, full_name");

  if (delErr) {
    console.error("❌ Error deleting employees:", delErr);
    process.exit(1);
  }

  console.log(`✅ Successfully deleted ${deleted.length} employees:`);
  deleted.forEach((d) => console.log(` - ${d.full_name}`));

  // Check remaining state
  console.log("\n📊 Verification of remaining database records:");
  const { data: remainingEmps } = await db
    .from("employees")
    .select("id, full_name, department, status, overall_progress")
    .order("created_at");

  console.log("Remaining employees:", remainingEmps);

  for (const t of ["employees", "messages", "tasks", "facts", "branches", "uploads", "sessions"]) {
    const { count } = await db.from(t).select("*", { count: "exact", head: true });
    console.log(`  ${t.padEnd(12)} count: ${count}`);
  }

  console.log("\n✨ Database update complete!");
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
