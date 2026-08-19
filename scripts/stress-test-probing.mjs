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
const openRouterKey = process.env.OPENROUTER_API_KEY;

if (!supabaseUrl || !supabaseKey || !openRouterKey) {
  console.error("❌ Missing required env vars");
  process.exit(1);
}

const db = createClient(supabaseUrl, supabaseKey);

async function callOpenRouter(messages) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openRouterKey}`,
      "Content-Type": "application/json",
      "X-Title": "Probing Stress Test",
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash",
      temperature: 0.2,
      max_tokens: 1200,
      response_format: { type: "json_object" },
      messages,
    }),
  });

  if (!res.ok) throw new Error(`OpenRouter error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content);
}

async function runProbingStressTest() {
  console.log("======================================================================");
  console.log("🧪 AI DEEP PROBING & VAGUE/HALF-INFO HANDLING STRESS TEST");
  console.log("Testing scenarios: Vague answers, missing info, 'I don't know', acronyms");
  console.log("======================================================================\n");

  const COVERAGE_KEYS = [
    "work_source", "inputs", "steps", "research", "tools", "decisions",
    "exceptions", "failure_handling", "quality_check", "approval", "output", "evidence"
  ];

  // Test scenarios with intentionally incomplete/half-baked answers
  const testCases = [
    {
      caseName: "Test 1: Super Vague Answer",
      input: "I just prepare the daily sheet and send it.",
      expectedBehavior: "Must NOT accept. Must probe: which sheet, what data, where is it sent?",
    },
    {
      caseName: "Test 2: Vague Authority ('Sir checks it')",
      input: "Sir checks the numbers and approves.",
      expectedBehavior: "Must probe: Who is Sir (name/designation)? How does he approve (email/Slack/system)?",
    },
    {
      caseName: "Test 3: Unexplained Acronym / Internal Slang",
      input: "I download the BRS and match it with the GL before posting the JV.",
      expectedBehavior: "Must branch on BRS, GL, and JV, asking for specific tools and reconciliation steps.",
    },
    {
      caseName: "Test 4: Half-Info on Process (No failure handling)",
      input: "I copy rows from the portal to Excel and click refresh.",
      expectedBehavior: "Must dig into failure handling/exceptions: What happens if portal is down or numbers don't balance?",
    },
    {
      caseName: "Test 5: Evasive / 'I don't know' response",
      input: "I don't know who sets the vendor credit limit, someone in seniors does it.",
      expectedBehavior: "Must handle gracefully: Ask 'Who would know this?' or pivot to next missing dimension without looping.",
    }
  ];

  let conversationHistory = [];
  let cumulativeCoverage = {};
  let totalFacts = [];
  let openBranches = [];

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    console.log(`\n----------------------------------------------------------------------`);
    console.log(`📌 ${tc.caseName}`);
    console.log(`🎯 Expected: ${tc.expectedBehavior}`);
    console.log(`💬 User Messy/Half Input: "${tc.input}"`);

    const coverageStatus = COVERAGE_KEYS.map(k => `${k}:${cumulativeCoverage[k] ?? 0}%`).join(", ");
    
    const contextPrompt = `
EMPLOYEE PROFILE:
Name: Rahul Varma
Department: Accounts
Designation: Accounts Intern

CURRENT TASK: Vendor Invoice & Bank Reconciliation
CURRENT TASK COVERAGE: ${coverageStatus}
OPEN BRANCHES: ${openBranches.length ? openBranches.map(b => b.topic).join(", ") : "(none)"}

RECENT CONVERSATION:
${conversationHistory.slice(-6).join("\n") || "(None)"}

EMPLOYEE'S LATEST ANSWER:
"""${tc.input}"""
`;

    const aiRes = await callOpenRouter([
      {
        role: "system",
        content: `You are the Employee Knowledge Architect. You must extract deep, complete SOP facts.
Never accept vague answers. If the user gives half-info, probe the missing steps, exceptions, or tools.
Reply ONLY with JSON:
{
  "answer_summary": "1-2 sentence summary",
  "facts": [{ "category": "tools|steps|decisions|exceptions|approval|sheet|misc", "fact_text": "specific fact" }],
  "new_branches": [{ "topic": "vague term or missing info", "priority": "high", "suggested_question": "question" }],
  "coverage_update": { "steps": 30, "exceptions": 0 },
  "current_task_complete": false,
  "recommended_next_question": "Short probing question"
}`
      },
      {
        role: "user",
        content: contextPrompt
      }
    ]);

    console.log(`\n📊 AI Analysis Result:`);
    console.log(`   • Summary: ${aiRes.answer_summary}`);
    console.log(`   • Facts Extracted (${aiRes.facts?.length || 0}):`);
    (aiRes.facts || []).forEach(f => {
      console.log(`       - [${f.category}] ${f.fact_text}`);
      totalFacts.push(f);
    });

    if (aiRes.new_branches?.length) {
      console.log(`   • Branches Spawned (Unclear/vague points to explore):`);
      aiRes.new_branches.forEach(b => {
        console.log(`       ⚠️ Branch: "${b.topic}" -> Probing Q: "${b.suggested_question}"`);
        openBranches.push(b);
      });
    }

    if (aiRes.coverage_update) {
      cumulativeCoverage = { ...cumulativeCoverage, ...aiRes.coverage_update };
      console.log(`   • Updated Coverage: ${JSON.stringify(cumulativeCoverage)}`);
    }

    console.log(`   🤖 AI Follow-up Question: 👉 "${aiRes.recommended_next_question}"`);

    // Track history
    conversationHistory.push(`A: ${tc.input}`);
    conversationHistory.push(`Q: ${aiRes.recommended_next_question}`);
  }

  console.log("\n======================================================================");
  console.log("🏁 STRESS TEST SUMMARY");
  console.log("======================================================================");
  console.log(`✅ Total Facts Extracted from messy inputs: ${totalFacts.length}`);
  console.log(`✅ Open Branches Created for incomplete terms: ${openBranches.length}`);
  console.log(`✅ Final Task Dimensions Covered: ${Object.keys(cumulativeCoverage).length} / 12`);
}

runProbingStressTest().catch(console.error);
