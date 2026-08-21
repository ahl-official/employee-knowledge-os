import { NextResponse } from "next/server";
import { assertServerEnv } from "@/lib/config";
import { isAdmin } from "@/lib/adminAuth";
import { getServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";

function cleanText(text: string): string {
  if (!text) return "";
  let s = text.trim();

  // Strip conversational prefixes
  s = s.replace(/^(my reporting manager is|my manager is|reporting manager is|manager is|reports to)\s+/i, "");
  s = s.replace(/^(i have|my experience is|experience is)\s+/i, "");
  s = s.replace(/^(my main responsibility is|my responsibility is|main responsibility is|responsibility is)\s+/i, "");

  // Fix common technical typos and proper nouns
  s = s
    .replace(/\bappscrip\b/gi, "AppScript")
    .replace(/\bappscript\b/gi, "AppScript")
    .replace(/\bvercl\b/gi, "Vercel")
    .replace(/\bwhatapp\b/gi, "WhatsApp")
    .replace(/\bwhatsapp\b/gi, "WhatsApp")
    .replace(/\bchatgpt\b/gi, "ChatGPT")
    .replace(/\bclaude\b/gi, "Claude")
    .replace(/\bcodex\b/gi, "Codex")
    .replace(/\bgst\b/gi, "GST")
    .replace(/\binvopce\b/gi, "Invoice")
    .replace(/\binvoce\b/gi, "Invoice")
    .replace(/\bproccess\b/gi, "process")
    .replace(/\bcordinator\b/gi, "coordinator")
    .replace(/\bcoedingtr\b/gi, "coordinator")
    .replace(/\bsaburi rane\b/gi, "Saburi Rane")
    .replace(/\btejal\b/gi, "Tejal");

  return s.charAt(0).toUpperCase() + s.slice(1);
}

export async function GET(req: Request) {
  if (!isAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    assertServerEnv();
    const employeeId = new URL(req.url).searchParams.get("employee_id") ?? "";
    if (!employeeId) return NextResponse.json({ error: "employee_id required" }, { status: 400 });

    const db = getServiceClient();
    const [employeeReq, tasksReq, factsReq] = await Promise.all([
      db.from("employees").select("*").eq("id", employeeId).maybeSingle(),
      db.from("tasks").select("*").eq("employee_id", employeeId).order("created_at", { ascending: true }),
      db.from("facts").select("category, fact_text, task_id").eq("employee_id", employeeId).order("created_at", { ascending: true }),
    ]);

    if (!employeeReq.data) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

    const employee = employeeReq.data;
    const tasks = tasksReq.data ?? [];
    const facts = factsReq.data ?? [];

    let md = `# Standard Operating Procedure (SOP)\n\n`;
    md += `## Personnel Information\n`;
    md += `- **Name:** ${cleanText(employee.full_name)}\n`;
    if (employee.department) md += `- **Department:** ${cleanText(employee.department)}\n`;
    if (employee.designation) md += `- **Designation:** ${cleanText(employee.designation)}\n`;
    if (employee.reporting_manager) md += `- **Reports to:** ${cleanText(employee.reporting_manager)}\n`;
    if (employee.experience) md += `- **Experience:** ${cleanText(employee.experience)}\n`;
    if (employee.main_responsibility) md += `- **Main Responsibility:** ${cleanText(employee.main_responsibility)}\n`;
    md += `\n---\n\n`;

    md += `## Tasks Overview\n`;
    if (tasks.length === 0) {
      md += `*No tasks recorded yet.*\n\n`;
    } else {
      tasks.forEach((t, i) => {
        md += `${i + 1}. **${cleanText(t.name)}**${t.frequency ? ` (${cleanText(t.frequency)})` : ""}\n`;
      });
      md += `\n---\n\n`;

      tasks.forEach((t, i) => {
        md += `## ${i + 1}. Task: ${cleanText(t.name)}\n`;
        md += `**Status:** ${cleanText(t.status)} | **Priority:** ${cleanText(t.priority ?? "Not specified")}\n\n`;

        const taskFacts = facts.filter((f) => f.task_id === t.id);
        if (taskFacts.length === 0) {
          md += `*No detailed knowledge extracted for this task yet.*\n\n`;
        } else {
          // Group facts by category
          const byCategory: Record<string, string[]> = {};
          taskFacts.forEach((f) => {
            if (!byCategory[f.category]) byCategory[f.category] = [];
            byCategory[f.category].push(cleanText(f.fact_text));
          });

          for (const [cat, texts] of Object.entries(byCategory)) {
            const formattedCat = cat.charAt(0).toUpperCase() + cat.slice(1).replace(/_/g, " ");
            md += `### ${formattedCat}\n`;
            texts.forEach((text) => {
              md += `- ${text}\n`;
            });
            md += `\n`;
          }
        }
        md += `---\n\n`;
      });
    }

    const generalFacts = facts.filter((f) => !f.task_id);
    if (generalFacts.length > 0) {
      md += `## General Knowledge & Contacts\n`;
      generalFacts.forEach((f) => {
        md += `- **${cleanText(f.category)}:** ${cleanText(f.fact_text)}\n`;
      });
    }

    // Convert MD to a file download response
    const safeName = (employee.full_name || "employee").replace(/[^a-z0-9]/gi, "_").toLowerCase();
    
    return new NextResponse(md, {
      headers: {
        "Content-Type": "text/markdown",
        "Content-Disposition": `attachment; filename="${safeName}_sop.md"`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "server_error" },
      { status: 500 }
    );
  }
}
