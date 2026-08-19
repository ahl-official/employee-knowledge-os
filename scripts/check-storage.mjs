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
  console.error("❌ Missing Supabase URL or Service Role Key");
  process.exit(1);
}

const db = createClient(supabaseUrl, supabaseKey);

async function checkStorage() {
  console.log("🔍 Checking Supabase Storage Buckets...\n");

  // 1. List buckets
  const { data: buckets, error: listErr } = await db.storage.listBuckets();
  if (listErr) {
    console.error("❌ Error listing buckets:", listErr.message);
    return;
  }

  console.log("📂 Existing Buckets:", buckets.map((b) => b.name).join(", "));
  const hasUploads = buckets.some((b) => b.name === "uploads");

  if (!hasUploads) {
    console.log("⚠️ Bucket 'uploads' was not found in list.");
    return;
  }
  console.log("✅ 'uploads' bucket exists!");

  // 2. Test file upload with service role key
  const testPath = `_test/ping_${Date.now()}.txt`;
  const buf = Buffer.from("Knowledge OS storage connectivity test", "utf-8");

  console.log(`📤 Testing upload to 'uploads/${testPath}'...`);
  const { error: upErr } = await db.storage.from("uploads").upload(testPath, buf, {
    contentType: "text/plain",
    upsert: true,
  });

  if (upErr) {
    console.error("❌ Upload failed:", upErr.message);
    return;
  }
  console.log("✅ File uploaded successfully!");

  // 3. Clean up test file
  const { error: delErr } = await db.storage.from("uploads").remove([testPath]);
  if (delErr) {
    console.log("⚠️ Could not delete test file (non-critical):", delErr.message);
  } else {
    console.log("🧹 Test file cleaned up successfully.");
  }

  console.log("\n🎉 ALL STORAGE CHECKS PASSED 100%!");
}

checkStorage().catch(console.error);
