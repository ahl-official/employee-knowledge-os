import { NextResponse } from "next/server";
import { assertServerEnv } from "@/lib/config";
import { isAdmin } from "@/lib/adminAuth";
import { getServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";

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

    let md = `# Standard Operating Procedure\n\n`;
    md += `## Personnel Information\n`;
    md += `- **Name:** ${employee.full_name}\n`;
    if (employee.department) md += `- **Department:** ${employee.department}\n`;
    if (employee.designation) md += `- **Designation:** ${employee.designation}\n`;
    if (employee.reporting_manager) md += `- **Reports to:** ${employee.reporting_manager}\n`;
    if (employee.experience) md += `- **Experience:** ${employee.experience}\n`;
    if (employee.main_responsibility) md += `- **Main Responsibility:** ${employee.main_responsibility}\n`;
    md += `\n---\n\n`;

    md += `## Tasks Overview\n`;
    if (tasks.length === 0) {
      md += `*No tasks recorded yet.*\n\n`;
    } else {
      tasks.forEach((t, i) => {
        md += `${i + 1}. **${t.name}**${t.frequency ? ` (${t.frequency})` : ""}\n`;
      });
      md += `\n---\n\n`;

      tasks.forEach((t, i) => {
        md += `## ${i + 1}. Task: ${t.name}\n`;
        md += `**Status:** ${t.status} | **Priority:** ${t.priority ?? "Not specified"}\n\n`;

        const taskFacts = facts.filter((f) => f.task_id === t.id);
        if (taskFacts.length === 0) {
          md += `*No detailed knowledge extracted for this task yet.*\n\n`;
        } else {
          // Group facts by category
          const byCategory: Record<string, string[]> = {};
          taskFacts.forEach((f) => {
            if (!byCategory[f.category]) byCategory[f.category] = [];
            byCategory[f.category].push(f.fact_text);
          });

          for (const [cat, texts] of Object.entries(byCategory)) {
            md += `### ${cat.charAt(0).toUpperCase() + cat.slice(1).replace(/_/g, " ")}\n`;
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
      md += `## General Knowledge\n`;
      generalFacts.forEach((f) => {
        md += `- **${f.category}:** ${f.fact_text}\n`;
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
