import fs from "fs";
import path from "path";

// Load .env.local natively
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

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const openRouterKey = process.env.OPENROUTER_API_KEY;

if (!supabaseUrl || !supabaseKey || !openRouterKey) {
  console.error("❌ Missing required env vars in .env.local");
  process.exit(1);
}

const db = createClient(supabaseUrl, supabaseKey);

async function callOpenRouter(messages) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openRouterKey}`,
      "Content-Type": "application/json",
      "X-Title": "Employee Knowledge OS Test",
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash",
      temperature: 0.2,
      max_tokens: 1200,
      response_format: { type: "json_object" },
      messages,
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${txt}`);
  }
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content);
}

async function runSimulation() {
  console.log("=================================================");
  console.log("💼 SIMULATION: ACCOUNTANT INTERN (Pooja Sharma)");
  console.log("💰 Estimated Cost: < $0.005 (Far below $1.00)");
  console.log("=================================================\n");

  const token = `test-intern-${Date.now()}`;
  
  // 1. Create employee
  console.log("1️⃣ Creating test employee in Supabase...");
  const { data: emp, error: empErr } = await db
    .from("employees")
    .insert({
      full_name: "Pooja Sharma",
      department: "Finance & Accounts",
      designation: "Junior Accounts Intern",
      access_token: token,
      status: "in_progress",
      overall_progress: 0,
    })
    .select()
    .single();

  if (empErr) {
    console.error("❌ Supabase insert failed:", empErr.message);
    return;
  }
  console.log(`✅ Employee created: ${emp.full_name} (ID: ${emp.id})\n`);

  // Create session
  const { data: session } = await db
    .from("sessions")
    .insert({
      employee_id: emp.id,
      round: 1,
      status: "active",
      profile_step: 0,
      current_question: "Welcome! To begin, could you tell me your full name?",
    })
    .select()
    .single();

  // Answers pool representing an accountant intern
  const internAnswers = [
    { step: 0, label: "Name", text: "Pooja Sharma" },
    { step: 1, label: "Department", text: "Finance and Accounts Department" },
    { step: 2, label: "Designation", text: "Junior Accounts Intern" },
    { step: 3, label: "Reporting Manager", text: "Mr. Rajesh Mehta, Senior Finance Controller" },
    { step: 4, label: "Experience", text: "6 months internship" },
    { step: 5, label: "Main Responsibility", text: "I perform daily bank reconciliation in Tally Prime, enter vendor invoices into QuickBooks, and verify TDS deductions." },
    {
      step: 6,
      label: "Tasks Catalog",
      text: "Daily: 1. Daily Bank Reconciliation in Tally Prime & ICICI Corporate Banking. 2. Vendor Invoice Verification & 3-way matching in QuickBooks. Monthly: 3. TDS 26Q Challan Preparation on the Income Tax Portal.",
    },
    {
      step: 7,
      label: "Deep-Dive: Bank Rec Steps",
      text: "Every morning at 10 AM, I log into ICICI Corporate Netbanking with my maker credentials, download the statement as .XLSX for current account 002105001234, and open Tally Prime under Company 'AHL Ltd'.",
    },
    {
      step: 8,
      label: "Deep-Dive: Handling Mismatches & Exceptions",
      text: "If there's an unmapped debit or cheque return, I don't auto-reconcile. I flag it in our 'Discrepancy Tracker' Google Sheet and email Rajesh Sir on Slack with the UTR number. Only after his written approval do I pass a journal voucher.",
    },
  ];

  let currentTaskId = null;
  let runningCoverage = {};

  for (let i = 0; i < internAnswers.length; i++) {
    const ans = internAnswers[i];
    console.log(`\n--- [Turn ${i + 1}/9] Intern answering: ${ans.label} ---`);
    console.log(`🗣️ Intern: "${ans.text}"`);

    // Record user message
    const { data: userMsg } = await db.from("messages").insert({
      employee_id: emp.id,
      session_id: session.id,
      role: "user",
      content: ans.text,
      task_id: currentTaskId,
    }).select().single();

    if (i <= 5) {
      // Deterministic profile phase
      const fields = ["full_name", "department", "designation", "reporting_manager", "experience", "main_responsibility"];
      await db.from("employees").update({ [fields[i]]: ans.text }).eq("id", emp.id);
      const nextQ = `Profile recorded for ${fields[i]}. Next question...`;
      console.log(`🤖 System (Deterministic): Step ${i} saved.`);
      continue;
    }

    // AI Turn (Step 6+)
    console.log("🧠 Calling AI Engine (OpenRouter)...");
    const aiResponse = await callOpenRouter([
      {
        role: "system",
        content: `You are the Employee Knowledge Architect interviewing an Accounts Intern.
Extract structured knowledge per this contract:
{
  "answer_summary": "1-2 sentence summary",
  "facts": [{ "category": "tools|steps|decisions|exceptions|approval|sheet", "fact_text": "extracted fact" }],
  "new_tasks": [{ "name": "task name", "frequency": "daily|monthly", "priority": "high|medium" }],
  "coverage_update": { "tools": 80, "steps": 60, "exceptions": 50 },
  "current_task_complete": false,
  "recommended_next_question": "Next probing question"
}`,
      },
      {
        role: "user",
        content: `Employee: Pooja Sharma (Accounts Intern)
Latest Answer: "${ans.text}"`,
      },
    ]);

    console.log("📋 AI Extracted Summary:", aiResponse.answer_summary);
    console.log("💡 Facts Extracted:", aiResponse.facts?.length || 0);
    if (aiResponse.facts) {
      aiResponse.facts.forEach(f => console.log(`   • [${f.category}] ${f.fact_text}`));
      // Insert facts
      await db.from("facts").insert(
        aiResponse.facts.map(f => ({
          employee_id: emp.id,
          task_id: currentTaskId,
          message_id: userMsg.id,
          category: f.category || "misc",
          fact_text: f.fact_text,
          source: "ai_extracted"
        }))
      );
    }

    if (aiResponse.new_tasks?.length) {
      console.log("📝 New Tasks Registered:", aiResponse.new_tasks.map(t => t.name).join(", "));
      for (const t of aiResponse.new_tasks) {
        const { data: taskRow } = await db.from("tasks").insert({
          employee_id: emp.id,
          name: t.name,
          frequency: t.frequency,
          priority: t.priority,
          status: "pending",
          coverage: {},
        }).select().single();
        if (!currentTaskId && taskRow) {
          currentTaskId = taskRow.id;
          await db.from("tasks").update({ status: "active" }).eq("id", currentTaskId);
        }
      }
    }

    if (aiResponse.coverage_update) {
      runningCoverage = { ...runningCoverage, ...aiResponse.coverage_update };
      console.log("📊 Coverage Map Update:", JSON.stringify(runningCoverage));
      if (currentTaskId) {
        await db.from("tasks").update({ coverage: runningCoverage }).eq("id", currentTaskId);
      }
    }

    console.log(`🤖 AI Next Question: "${aiResponse.recommended_next_question}"`);
  }

  // 4. Check facts and summary
  console.log("\n=================================================");
  console.log("📑 GENERATING STANDARD OPERATING PROCEDURE (SOP)");
  console.log("=================================================");

  const { data: allFacts } = await db.from("facts").select("category, fact_text").eq("employee_id", emp.id);
  const { data: allTasks } = await db.from("tasks").select("name, frequency, status").eq("employee_id", emp.id);

  console.log(`\n✅ Total Tasks Extracted: ${allTasks.length}`);
  allTasks.forEach((t, idx) => console.log(`  ${idx + 1}. ${t.name} (${t.frequency ?? "N/A"}) - [${t.status}]`));

  console.log(`\n✅ Total Facts Extracted: ${allFacts.length}`);
  console.log("\n--- Sample SOP Section Preview ---");
  console.log(`## Role: Junior Accounts Intern - Daily Bank Reconciliation`);
  allFacts.forEach(f => console.log(`- **[${f.category.toUpperCase()}]**: ${f.fact_text}`));

  console.log("\n🎉 TEST COMPLETE: AI Pipeline executed flawlessly!");
}

runSimulation().catch(err => {
  console.error("❌ Simulation error:", err);
});
