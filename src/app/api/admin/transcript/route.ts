import { NextResponse } from "next/server";
import { assertServerEnv } from "@/lib/config";
import { isAdmin } from "@/lib/adminAuth";
import { getServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";

/** GET /api/admin/transcript?employee_id=... — full transcript + extracted knowledge. */
export async function GET(req: Request) {
  if (!isAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    assertServerEnv();
    const employeeId = new URL(req.url).searchParams.get("employee_id") ?? "";
    if (!employeeId) return NextResponse.json({ error: "employee_id required" }, { status: 400 });

    const db = getServiceClient();
    const [employee, messages, tasks, facts, branches] = await Promise.all([
      db.from("employees").select("*").eq("id", employeeId).maybeSingle(),
      db.from("messages").select("role, content, created_at").eq("employee_id", employeeId).order("created_at", { ascending: true }),
      db.from("tasks").select("*").eq("employee_id", employeeId).order("created_at", { ascending: true }),
      db.from("facts").select("category, fact_text, task_id").eq("employee_id", employeeId).order("created_at", { ascending: true }),
      db.from("branches").select("topic, priority, status, suggested_question").eq("employee_id", employeeId),
    ]);

    return NextResponse.json({
      employee: employee.data,
      messages: messages.data ?? [],
      tasks: tasks.data ?? [],
      facts: facts.data ?? [],
      branches: branches.data ?? [],
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "server_error" },
      { status: 500 }
    );
  }
}
