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
const db = createClient(supabaseUrl, supabaseKey);

async function testXSS() {
  console.log("🧪 Running 5-Minute XSS Injection Verification Test...\n");

  const xssPayload = `</title><img src=x onerror=alert(1)>`;

  // 1. Create a dummy employee with the XSS payload as their name
  const token = `xss_test_${Date.now()}`;
  const { data: employee, error: empErr } = await db
    .from("employees")
    .insert({
      full_name: xssPayload,
      department: `<script>alert('dept')</script>`,
      designation: `Intern "><script>alert('desig')</script>`,
      reporting_manager: `Manager' OR '1'='1`,
      access_token: token,
      status: "completed",
    })
    .select()
    .single();

  if (empErr) {
    console.error("❌ Failed to create test employee:", empErr.message);
    return;
  }

  console.log(`✅ Test employee created with ID: ${employee.id}`);

  // 2. Fetch the SOP PDF endpoint
  const adminPass = process.env.ADMIN_PASSPHRASE;
  const res = await fetch(`http://localhost:3000/api/admin/sop/pdf?employee_id=${employee.id}`, {
    headers: { "x-admin-passphrase": adminPass },
  });

  if (!res.ok) {
    console.error(`❌ PDF endpoint returned status ${res.status}`);
    return;
  }

  const html = await res.text();

  // 3. Assert that raw `<script>` or raw `</title><img` never appears in the HTML
  const hasRawScript = html.includes("<script>alert");
  const hasRawImgError = html.includes("<img src=x onerror=");
  const hasEscapedTitle = html.includes("&lt;/title&gt;&lt;img src=x onerror=alert(1)&gt;");

  console.log("\n🔍 Inspection Results:");
  console.log(`- Contains Raw <script> Alert: ${hasRawScript ? "🚨 YES (FAIL)" : "✅ NO (SAFE)"}`);
  console.log(`- Contains Raw <img onerror>: ${hasRawImgError ? "🚨 YES (FAIL)" : "✅ NO (SAFE)"}`);
  console.log(`- Contains Properly Escaped Title: ${hasEscapedTitle ? "✅ YES (PASS)" : "❌ NO"}`);

  // Clean up
  await db.from("employees").delete().eq("id", employee.id);
  console.log("\n🧹 Test employee cleaned up from database.");

  if (!hasRawScript && !hasRawImgError && hasEscapedTitle) {
    console.log("\n🎉 XSS DEFENSE 100% PROVEN AND VERIFIED!");
  } else {
    console.error("\n❌ XSS test did not pass.");
  }
}

testXSS().catch(console.error);
