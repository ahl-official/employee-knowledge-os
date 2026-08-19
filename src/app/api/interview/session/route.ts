import { NextResponse } from "next/server";
import { assertServerEnv } from "@/lib/config";
import { getEmployeeByToken, getOrCreateSession, getAllMessages, getTask, getOpenBranches } from "@/lib/interview/store";
import { getServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";

/** GET /api/interview/session?token=... — load or start an interview by token. */
export async function GET(req: Request) {
  try {
    assertServerEnv();
    const token = new URL(req.url).searchParams.get("token") ?? "";
    if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });

    const employee = await getEmployeeByToken(token);
    if (!employee) return NextResponse.json({ error: "invalid_link" }, { status: 404 });

    // Ensures the first question exists if this is a brand-new session.
    const { session } = await getOrCreateSession(employee);
    const messages = await getAllMessages(employee.id);

    const db = getServiceClient();
    const currentTask = session.current_task_id ? await getTask(db, session.current_task_id) : null;
    const openBranches = await getOpenBranches(db, employee.id);

    return NextResponse.json({
      employee: { full_name: employee.full_name, department: employee.department },
      status: employee.status,
      progress: employee.overall_progress,
      messages: messages.map((m) => ({ role: m.role, content: m.content, created_at: m.created_at })),
      currentTaskCoverage: currentTask?.coverage ?? null,
      openBranches,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "server_error" },
      { status: 500 }
    );
  }
}
