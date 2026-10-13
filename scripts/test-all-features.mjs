import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// 1. Load environment variables
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

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
const ADMIN_PASSPHRASE = process.env.ADMIN_PASSPHRASE || "";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

const results = [];
function recordResult(name, passed, details = "") {
  results.push({ name, passed, details });
  const statusIcon = passed ? "✅ PASS" : "❌ FAIL";
  console.log(`${statusIcon} | ${name}${details ? ` -> ${details}` : ""}`);
}

async function runAllTests() {
  console.log("\n=======================================================");
  console.log("🧪 KNOWLEDGE OS: COMPREHENSIVE END-TO-END FEATURE TEST");
  console.log("=======================================================\n");

  let testEmployeeId = null;
  let testToken = null;
  let uploadedStoragePath = null;

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Supabase Database Schema & Storage Verification
    // -------------------------------------------------------------------------
    console.log("▶ [1/9] Testing Supabase Tables & Storage Bucket...");
    const requiredTables = ["employees", "sessions", "messages", "tasks", "facts", "branches", "uploads"];
    let tablesOk = true;
    for (const table of requiredTables) {
      const { error } = await db.from(table).select("id").limit(1);
      if (error) {
        tablesOk = false;
        recordResult(`Table: ${table}`, false, error.message);
      }
    }
    if (tablesOk) {
      recordResult("Supabase Database Tables", true, "All 7 schema tables exist and queryable");
    }

    const { data: buckets, error: bErr } = await db.storage.listBuckets();
    const hasUploadsBucket = buckets && buckets.some((b) => b.id === "uploads");
    recordResult("Supabase Storage Bucket ('uploads')", !bErr && hasUploadsBucket, hasUploadsBucket ? "Bucket exists" : (bErr?.message || "Bucket not found"));

    // -------------------------------------------------------------------------
    // TEST 2: Admin Authentication & Security
    // -------------------------------------------------------------------------
    console.log("\n▶ [2/9] Testing Admin Authentication & Security...");
    const unauthRes = await fetch(`${BASE_URL}/api/admin/employees`);
    recordResult("Admin Security (Reject Unauthenticated)", unauthRes.status === 401, `Status: ${unauthRes.status}`);

    const badAuthRes = await fetch(`${BASE_URL}/api/admin/employees`, {
      headers: { "x-admin-passphrase": "wrong-secret-xyz" },
    });
    recordResult("Admin Security (Reject Invalid Passphrase)", badAuthRes.status === 401, `Status: ${badAuthRes.status}`);

    const goodAuthRes = await fetch(`${BASE_URL}/api/admin/employees`, {
      headers: { "x-admin-passphrase": ADMIN_PASSPHRASE },
    });
    recordResult("Admin Security (Accept Valid Passphrase)", goodAuthRes.status === 200, `Status: ${goodAuthRes.status}`);

    // -------------------------------------------------------------------------
    // TEST 3: Employee Creation via Admin API
    // -------------------------------------------------------------------------
    console.log("\n▶ [3/9] Testing Employee Creation via Admin API...");
    const createRes = await fetch(`${BASE_URL}/api/admin/employees`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-passphrase": ADMIN_PASSPHRASE,
      },
      body: JSON.stringify({
        full_name: "Rohan Sharma (Automated E2E Test)",
        department: "Operations & Quality",
        designation: "Quality Operations Specialist",
        reporting_manager: "Priya Nair",
      }),
    });

    const createData = await createRes.json();
    const hasEmployee = createRes.status === 200 && createData?.employee?.id;
    if (hasEmployee) {
      testEmployeeId = createData.employee.id;
      testToken = createData.employee.access_token;
      recordResult("Create Employee via API", true, `ID: ${testEmployeeId}, Token: ${testToken}`);
    } else {
      recordResult("Create Employee via API", false, JSON.stringify(createData));
      throw new Error("Cannot proceed without a created test employee");
    }

    // Verify employee appears in list
    const listRes = await fetch(`${BASE_URL}/api/admin/employees`, {
      headers: { "x-admin-passphrase": ADMIN_PASSPHRASE },
    });
    const listData = await listRes.json();
    const foundInList = (listData.employees || []).some((e) => e.id === testEmployeeId);
    recordResult("Verify Employee in Admin Listing", foundInList, `Found in list of ${listData.employees?.length} employees`);

    // -------------------------------------------------------------------------
    // TEST 4: Interview Session Initialization
    // -------------------------------------------------------------------------
    console.log("\n▶ [4/9] Testing Interview Session Initialization...");
    const sessionRes = await fetch(`${BASE_URL}/api/interview/session?token=${testToken}`);
    const sessionData = await sessionRes.json();
    const sessionOk = sessionRes.status === 200 && sessionData?.employee && Array.isArray(sessionData?.messages);
    recordResult("Initialize Interview Session", sessionOk, `Loaded session with ${sessionData?.messages?.length || 0} initial message(s)`);

    // -------------------------------------------------------------------------
    // TEST 5: Profiling Q&A Step Progression
    // -------------------------------------------------------------------------
    console.log("\n▶ [5/9] Testing Profiling Phase (Steps 0 to 6)...");
    const profileAnswers = [
      "Rohan Sharma",
      "Operations & Quality",
      "Quality Operations Specialist",
      "Priya Nair (Operations Director)",
      "2 years in operations",
      "I manage product quality audit checklists and vendor quality escalation tickets.",
    ];

    let profilingPassed = true;
    for (let i = 0; i < profileAnswers.length; i++) {
      const ansRes = await fetch(`${BASE_URL}/api/interview/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: testToken, answer: profileAnswers[i] }),
      });
      const ansData = await ansRes.json();
      if (!ansRes.ok) {
        profilingPassed = false;
        recordResult(`Profiling Step ${i + 1}`, false, JSON.stringify(ansData));
        break;
      }
    }
    if (profilingPassed) {
      recordResult("Profiling Progression (Steps 0 to 6)", true, "Completed initial onboarding profiling");
    }

    // -------------------------------------------------------------------------
    // TEST 6: Deep-Dive Probing & AI Fact Extraction
    // -------------------------------------------------------------------------
    console.log("\n▶ [6/9] Testing AI Deep-Dive Interview Turn & Fact Extraction...");
    const deepDiveAnswer =
      "Every morning at 9:30 AM, I open Google Sheets quality tracker 'OPS_Daily_Audit_2026' and check Jira ticket board. " +
      "If defect rate is above 3%, I immediately escalate to Priya Nair over Slack #ops-critical and pause batch release. " +
      "I also log the root-cause ticket in Jira with severity High.";

    const turnRes = await fetch(`${BASE_URL}/api/interview/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: testToken, answer: deepDiveAnswer }),
    });

    const turnData = await turnRes.json();
    const hasFollowUp = turnRes.status === 200 && turnData?.nextQuestion;
    recordResult("AI Probing Turn (Generate Follow-up)", hasFollowUp, hasFollowUp ? `Next Q: "${turnData.nextQuestion.slice(0, 70)}..."` : JSON.stringify(turnData));

    // Check extracted facts in database
    const { data: facts } = await db.from("facts").select("*").eq("employee_id", testEmployeeId);
    const factsExtracted = facts && facts.length > 0;
    recordResult("AI Fact Extraction to Database", factsExtracted, `Extracted ${facts?.length || 0} facts`);

    // Check tasks created in database
    const { data: tasks } = await db.from("tasks").select("*").eq("employee_id", testEmployeeId);
    recordResult("Task Extraction & Coverage Tracking", tasks && tasks.length > 0, `Captured ${tasks?.length || 0} task(s)`);

    // -------------------------------------------------------------------------
    // TEST 7: File / Evidence Upload & Storage
    // -------------------------------------------------------------------------
    console.log("\n▶ [7/9] Testing File Upload (Multipart Form-Data & Storage)...");
    const testCsv = "Task,Tool,Frequency,Exception\nQuality Batch Audit,Google Sheets,Daily,Escalate if defect > 3%\nJira Issue Logging,Jira,Daily,Severity High\n";
    const formData = new FormData();
    formData.append("token", testToken);
    formData.append("file", new File([testCsv], "e2e_test_audit_sop.csv", { type: "text/csv" }));
    formData.append("comment", "Sample audit checklist for verification");

    const uploadRes = await fetch(`${BASE_URL}/api/upload`, {
      method: "POST",
      body: formData,
    });
    const uploadData = await uploadRes.json();
    const uploadOk = uploadRes.status === 200 && uploadData?.extracted;
    recordResult("Document Upload & Text Extraction", uploadOk, uploadOk ? `Extracted file: ${uploadData.fileName}` : JSON.stringify(uploadData));

    // Verify upload record in DB
    const { data: uploadRecords } = await db.from("uploads").select("*").eq("employee_id", testEmployeeId);
    const dbUploadOk = uploadRecords && uploadRecords.length > 0;
    if (dbUploadOk && uploadRecords[0].file_url) {
      uploadedStoragePath = uploadRecords[0].file_url;
    }
    recordResult("Supabase Uploads Record Saved", dbUploadOk, `Found ${uploadRecords?.length || 0} upload entry in database`);

    // -------------------------------------------------------------------------
    // TEST 8: Full Transcript Retrieval API
    // -------------------------------------------------------------------------
    console.log("\n▶ [8/9] Testing Transcript Retrieval API...");
    const transcriptRes = await fetch(`${BASE_URL}/api/admin/transcript?employee_id=${testEmployeeId}`, {
      headers: { "x-admin-passphrase": ADMIN_PASSPHRASE },
    });
    const transcriptData = await transcriptRes.json();
    const transcriptOk = transcriptRes.status === 200 && (transcriptData?.messages?.length || 0) > 0;
    recordResult("Admin Transcript API", transcriptOk, `Retrieved ${transcriptData?.messages?.length || 0} message logs`);

    // -------------------------------------------------------------------------
    // TEST 9: AI SOP Synthesis API
    // -------------------------------------------------------------------------
    console.log("\n▶ [9/9] Testing Standard Operating Procedure (SOP) Generation...");
    const sopRes = await fetch(`${BASE_URL}/api/admin/sop?employee_id=${testEmployeeId}`, {
      headers: { "x-admin-passphrase": ADMIN_PASSPHRASE },
    });
    const sopText = await sopRes.text();
    const sopOk = sopRes.status === 200 && (sopText.includes("Standard Operating Procedure") || sopText.includes("SOP"));
    recordResult("SOP Document Synthesis", sopOk, `Generated ${sopText.length} bytes SOP markdown document`);

  } catch (err) {
    console.error("\n❌ Unexpected Error During Test Suite:", err);
    recordResult("Suite Execution", false, err.message);
  } finally {
    // -------------------------------------------------------------------------
    // CLEANUP: Clean up test employee from database & storage
    // -------------------------------------------------------------------------
    if (testEmployeeId) {
      console.log("\n🧹 Cleaning up test artifacts from database...");
      try {
        if (uploadedStoragePath) {
          await db.storage.from("uploads").remove([uploadedStoragePath]);
        }
        await db.from("employees").delete().eq("id", testEmployeeId);
        console.log("✅ Teardown complete: test records deleted cleanly.\n");
      } catch (cleanErr) {
        console.warn("⚠️ Cleanup warning:", cleanErr.message);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // SUMMARY REPORT
  // ---------------------------------------------------------------------------
  console.log("=======================================================");
  console.log("📊 TEST RESULTS SUMMARY");
  console.log("=======================================================");
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;

  results.forEach((r, idx) => {
    console.log(`${r.passed ? "✅" : "❌"} [${idx + 1}/${total}] ${r.name}`);
  });

  console.log("-------------------------------------------------------");
  console.log(`TOTAL: ${total} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAllTests();
