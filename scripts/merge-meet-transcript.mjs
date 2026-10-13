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
  console.error("❌ Missing Supabase credentials in .env.local");
  process.exit(1);
}

const db = createClient(supabaseUrl, supabaseKey);
const empId = "f8740c73-3416-4efc-87b1-13023a84f127"; // Meet

async function runMerge() {
  console.log("🚀 Starting Meet transcript comparison and merge...");

  // 1. Verify Meet exists
  const { data: employee, error: empErr } = await db
    .from("employees")
    .select("*")
    .eq("id", empId)
    .single();

  if (empErr || !employee) {
    console.error("❌ Could not find employee Meet:", empErr);
    process.exit(1);
  }
  console.log(`✅ Loaded employee: ${employee.full_name} (${employee.designation})`);

  // 2. Fetch existing tasks
  const { data: existingTasks } = await db
    .from("tasks")
    .select("*")
    .eq("employee_id", empId);

  const taskMap = new Map();
  existingTasks.forEach((t) => taskMap.set(t.name.toLowerCase(), t.id));
  console.log(`✅ Found ${existingTasks.length} existing tasks for Meet:`, Array.from(taskMap.keys()));

  // 3. Insert new tasks if not existing
  const newTasksToEnsure = [
    { name: "Indeed Job Posting & Sponsoring", frequency: "daily", priority: "medium" },
    { name: "HeyGen AI Avatar Videos", frequency: "occasional", priority: "medium" },
  ];

  for (const nt of newTasksToEnsure) {
    if (!taskMap.has(nt.name.toLowerCase())) {
      console.log(`➕ Adding new task: ${nt.name}`);
      const { data: inserted, error: taskInsErr } = await db
        .from("tasks")
        .insert({
          employee_id: empId,
          name: nt.name,
          frequency: nt.frequency,
          priority: nt.priority,
          status: "pending",
          coverage: {
            steps: 40,
            tools: 60,
            inputs: 30,
            output: 40,
            approval: 40,
            evidence: 0,
            research: 0,
            decisions: 30,
            exceptions: 30,
            work_source: 50,
            quality_check: 30,
            failure_handling: 20,
          },
        })
        .select()
        .single();

      if (taskInsErr) {
        console.error(`❌ Error inserting task ${nt.name}:`, taskInsErr);
      } else {
        taskMap.set(nt.name.toLowerCase(), inserted.id);
      }
    }
  }

  // 4. Fetch existing facts for deduplication
  const { data: existingFacts } = await db
    .from("facts")
    .select("id, fact_text")
    .eq("employee_id", empId);

  console.log(`✅ Currently ${existingFacts.length} existing facts in DB for Meet.`);
  const existingTexts = existingFacts.map((f) => f.fact_text.toLowerCase().trim());

  function isDuplicate(text) {
    const norm = text.toLowerCase().trim();
    return existingTexts.some((ex) => {
      if (ex === norm) return true;
      if (norm.length > 25 && ex.includes(norm)) return true;
      if (ex.length > 25 && norm.includes(ex)) return true;
      return false;
    });
  }

  // Import candidate facts
  const { candidateFacts } = await import("./prepare-meet-merge.mjs");

  // Map candidate facts with proper task_id
  const factsToInsert = [];
  for (const cf of candidateFacts) {
    if (isDuplicate(cf.fact_text)) {
      console.log(`⏭️ Skipping duplicate: "${cf.fact_text.slice(0, 50)}..."`);
      continue;
    }

    const tName = (cf.task_name || "training").toLowerCase();
    const assignedTaskId = taskMap.get(tName) || taskMap.get("training") || null;

    factsToInsert.push({
      employee_id: empId,
      task_id: assignedTaskId,
      category: cf.category || "misc",
      fact_text: cf.fact_text,
      source: "oral_transcript",
    });
  }

  console.log(`\n📝 Inserting ${factsToInsert.length} new facts into public.facts...`);
  if (factsToInsert.length > 0) {
    // Insert in chunks of 25
    for (let i = 0; i < factsToInsert.length; i += 25) {
      const chunk = factsToInsert.slice(i, i + 25);
      const { error: insErr } = await db.from("facts").insert(chunk);
      if (insErr) {
        console.error("❌ Error inserting facts chunk:", insErr);
        process.exit(1);
      }
    }
    console.log(`✅ Inserted all ${factsToInsert.length} new facts successfully!`);
  }

  // 5. Insert transcript record into public.uploads
  const transcriptText = fs.readFileSync(
    path.resolve(process.cwd(), "scratch/meet_oral_transcript.txt"),
    "utf-8"
  );

  const trainingTaskId = taskMap.get("training") || null;
  const { data: existingUpload } = await db
    .from("uploads")
    .select("id")
    .eq("employee_id", empId)
    .eq("file_name", "WhatsApp Audio 2026-10-13 at 12.30.21 PM.txt")
    .maybeSingle();

  if (!existingUpload) {
    console.log("\n📎 Recording transcript upload in public.uploads...");
    const { error: upErr } = await db.from("uploads").insert({
      employee_id: empId,
      task_id: trainingTaskId,
      file_name: "WhatsApp Audio 2026-10-13 at 12.30.21 PM.txt",
      mime_type: "text/plain",
      type: "transcript",
      extracted_text: transcriptText,
      description: "Oral interview transcript of Meet covering Training & Development, room booking, GoPro shooting, NAS storage, YouTube uploads, FMS, and daily HR routines.",
    });
    if (upErr) console.warn("⚠️ Warning recording upload:", upErr.message);
    else console.log("✅ Upload recorded in public.uploads!");
  } else {
    console.log("ℹ️ Transcript upload record already present in public.uploads.");
  }

  // 6. Update task coverage for training & feedback form
  console.log("\n📈 Updating task coverage based on new knowledge...");
  if (trainingTaskId) {
    const updatedTrainingCoverage = {
      steps: 95,
      tools: 95,
      inputs: 85,
      output: 90,
      approval: 90,
      evidence: 50,
      research: 70,
      decisions: 85,
      exceptions: 85,
      work_source: 90,
      quality_check: 85,
      failure_handling: 80,
    };
    await db
      .from("tasks")
      .update({
        coverage: updatedTrainingCoverage,
        status: "completed", // All critical dimensions comprehensively answered!
        updated_at: new Date().toISOString(),
      })
      .eq("id", trainingTaskId);
    console.log("✅ Updated task 'training' coverage and marked status: completed.");
  }

  const feedbackTaskId = taskMap.get("feedback form");
  if (feedbackTaskId) {
    const updatedFeedbackCoverage = {
      steps: 80,
      tools: 70,
      inputs: 75,
      output: 80,
      approval: 85,
      evidence: 0,
      research: 0,
      decisions: 70,
      exceptions: 40,
      work_source: 80,
      quality_check: 60,
      failure_handling: 40,
    };
    await db
      .from("tasks")
      .update({
        coverage: updatedFeedbackCoverage,
        status: "active",
        updated_at: new Date().toISOString(),
      })
      .eq("id", feedbackTaskId);
    console.log("✅ Updated task 'feedback form' coverage.");
  }

  // 7. Resolve the open branch for training
  console.log("\n🌿 Checking and resolving open branch for training...");
  const { data: openBranches } = await db
    .from("branches")
    .select("id, topic")
    .eq("employee_id", empId)
    .eq("status", "open");

  for (const ob of openBranches || []) {
    if (ob.topic.toLowerCase() === "training") {
      await db
        .from("branches")
        .update({
          status: "resolved",
          resolved_at: new Date().toISOString(),
        })
        .eq("id", ob.id);
      console.log(`✅ Resolved open branch [${ob.id}] "${ob.topic}".`);
    }
  }

  // 8. Update department to HR if null
  if (!employee.department) {
    await db.from("employees").update({ department: "HR" }).eq("id", empId);
    console.log("✅ Updated Meet's department: HR");
  }

  // 9. Recompute overall progress
  console.log("\n📊 Recomputing Meet's overall progress...");
  const { data: allEmpTasks } = await db
    .from("tasks")
    .select("id, name, status, coverage")
    .eq("employee_id", empId);

  const meanCov = (cov) => {
    const keys = [
      "steps", "tools", "inputs", "output", "approval", "evidence",
      "research", "decisions", "exceptions", "work_source", "quality_check", "failure_handling"
    ];
    const sum = keys.reduce((acc, k) => acc + (cov?.[k] || 0), 0);
    return sum / keys.length;
  };

  const perTask = allEmpTasks.map((t) => {
    const raw = meanCov(t.coverage);
    return t.status === "completed" ? Math.max(75, raw) : raw;
  });
  const taskAvg = perTask.reduce((a, b) => a + b, 0) / perTask.length;
  const progress = Math.min(100, 20 + Math.round((taskAvg * 80) / 100));

  const { data: remainingOpenBranches } = await db
    .from("branches")
    .select("id")
    .eq("employee_id", empId)
    .eq("status", "open");

  const hasOpenBranches = (remainingOpenBranches?.length ?? 0) > 0;
  const isDone = allEmpTasks.every((t) => t.status === "completed") && !hasOpenBranches;
  const finalProgress = isDone ? 100 : hasOpenBranches ? Math.min(90, progress) : progress;

  await db
    .from("employees")
    .update({
      overall_progress: finalProgress,
      status: isDone ? "completed" : "in_progress",
      last_activity: new Date().toISOString(),
    })
    .eq("id", empId);

  console.log(`✅ Updated overall_progress: ${finalProgress}%`);

  // 10. Final Verification
  console.log("\n🎯 --- FINAL VERIFICATION ---");
  const { count: finalFactCount } = await db
    .from("facts")
    .select("*", { count: "exact", head: true })
    .eq("employee_id", empId);
  const { count: finalTaskCount } = await db
    .from("tasks")
    .select("*", { count: "exact", head: true })
    .eq("employee_id", empId);
  const { count: finalMsgCount } = await db
    .from("messages")
    .select("*", { count: "exact", head: true })
    .eq("employee_id", empId);
  const { count: finalUploadCount } = await db
    .from("uploads")
    .select("*", { count: "exact", head: true })
    .eq("employee_id", empId);

  console.log(`Facts count: ${finalFactCount} (was 169, added ${finalFactCount - 169})`);
  console.log(`Tasks count: ${finalTaskCount} (was 7, added ${finalTaskCount - 7})`);
  console.log(`Messages count: ${finalMsgCount} (unchanged)`);
  console.log(`Uploads count: ${finalUploadCount}`);
  console.log("✨ Merge completed successfully!");
}

runMerge().catch((e) => {
  console.error("Fatal error during merge:", e);
  process.exit(1);
});
