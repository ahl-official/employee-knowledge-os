import { getServiceClient } from "@/lib/supabase";
import {
  AIAnalysis,
  Branch,
  Coverage,
  COVERAGE_KEYS,
  Employee,
  Message,
  Task,
} from "@/lib/types";
import { PROFILE_QUESTIONS } from "@/lib/interview/prompt";
import { runInterviewTurn } from "@/lib/interview/engine";

type DB = ReturnType<typeof getServiceClient>;

function emptyCoverage(): Coverage {
  return COVERAGE_KEYS.reduce((acc, k) => {
    acc[k] = 0;
    return acc;
  }, {} as Coverage);
}

function meanCoverage(c: Partial<Coverage> | null | undefined): number {
  if (!c) return 0;
  const vals = COVERAGE_KEYS.map((k) => c[k] ?? 0);
  return Math.round(vals.reduce((a, b) => a + b, 0) / COVERAGE_KEYS.length);
}

// Which employee field each profile step (0-5) writes to.
const PROFILE_FIELDS = [
  "full_name",
  "department",
  "designation",
  "reporting_manager",
  "experience",
  "main_responsibility",
] as const;

export interface Session {
  id: string;
  employee_id: string;
  round: number;
  status: string;
  profile_step: number;
  current_task_id: string | null;
  current_question: string | null;
}

export interface TurnOutcome {
  nextQuestion: string;
  progress: number;
  done: boolean;
  usedFallback: boolean;
  currentTaskCoverage?: Coverage | null;
  openBranches?: Branch[];
}

export async function getEmployeeByToken(token: string): Promise<Employee | null> {
  const db = getServiceClient();
  const { data } = await db.from("employees").select("*").eq("access_token", token).maybeSingle();
  return (data as Employee) ?? null;
}

/** Get the active session, creating one (and posting the first question) if none. */
export async function getOrCreateSession(
  employee: Employee
): Promise<{ session: Session; firstQuestion: string | null }> {
  const db = getServiceClient();
  const { data: existing } = await db
    .from("sessions")
    .select("*")
    .eq("employee_id", employee.id)
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) return { session: existing as Session, firstQuestion: null };

  let startingStep = 0;
  let firstQuestion = PROFILE_QUESTIONS[0];

  if (employee.full_name) {
    const roleText = employee.designation ? ` as ${employee.designation}` : "";
    if (!employee.reporting_manager) {
      startingStep = 3;
      firstQuestion = `Welcome, ${employee.full_name}! I'm here to document your day-to-day workflows and role know-how${roleText}. Who is your reporting manager?`;
    } else if (!employee.experience) {
      startingStep = 4;
      firstQuestion = `Welcome, ${employee.full_name}! How many years of experience do you have in this role${roleText}?`;
    } else if (!employee.main_responsibility) {
      startingStep = 5;
      firstQuestion = `Welcome, ${employee.full_name}! In one or two lines, what is your primary responsibility${roleText}?`;
    } else {
      startingStep = 6;
      firstQuestion = `Welcome, ${employee.full_name}! Do you have a task checklist or daily tracker sheet? Please upload it with the 📎 button below. If not, just list your main daily and weekly tasks here.`;
    }
  }

  const { data: created } = await db
    .from("sessions")
    .insert({
      employee_id: employee.id,
      profile_step: startingStep,
      current_question: firstQuestion,
    })
    .select("*")
    .single();

  await addMessage(db, employee.id, (created as Session).id, "assistant", firstQuestion, null);
  return { session: created as Session, firstQuestion };
}

async function addMessage(
  db: DB,
  employeeId: string,
  sessionId: string,
  role: "assistant" | "user" | "system",
  content: string,
  taskId: string | null
): Promise<string> {
  const { data } = await db
    .from("messages")
    .insert({ employee_id: employeeId, session_id: sessionId, role, content, task_id: taskId })
    .select("id")
    .single();
  return (data as { id: string }).id;
}

export async function getRecentMessages(employeeId: string, limit = 8): Promise<Message[]> {
  const db = getServiceClient();
  const { data } = await db
    .from("messages")
    .select("*")
    .eq("employee_id", employeeId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return ((data as Message[]) ?? []).reverse();
}

export async function getAllMessages(employeeId: string): Promise<Message[]> {
  const db = getServiceClient();
  const { data } = await db
    .from("messages")
    .select("*")
    .eq("employee_id", employeeId)
    .order("created_at", { ascending: true });
  return (data as Message[]) ?? [];
}

export async function getOpenBranches(db: DB, employeeId: string): Promise<Branch[]> {
  const { data } = await db
    .from("branches")
    .select("*")
    .eq("employee_id", employeeId)
    .eq("status", "open")
    .order("created_at", { ascending: true });
  return (data as Branch[]) ?? [];
}

export async function getTask(db: DB, taskId: string | null): Promise<Task | null> {
  if (!taskId) return null;
  const { data } = await db.from("tasks").select("*").eq("id", taskId).maybeSingle();
  return (data as Task) ?? null;
}

/** Concatenated extracted text from an employee's uploads, truncated for cost. */
async function getUploadsText(db: DB, employeeId: string): Promise<string> {
  const { data } = await db
    .from("uploads")
    .select("file_name, extracted_text")
    .eq("employee_id", employeeId)
    .not("extracted_text", "is", null)
    .order("created_at", { ascending: true });
  const rows = (data as { file_name: string | null; extracted_text: string | null }[]) ?? [];
  const joined = rows
    .filter((r) => r.extracted_text)
    .map((r) => `# ${r.file_name ?? "document"}\n${r.extracted_text}`)
    .join("\n\n");
  return joined.slice(0, 6000);
}

function profileString(e: Employee): string {
  const parts = [
    e.full_name && `Name: ${e.full_name}`,
    e.department && `Department: ${e.department}`,
    e.designation && `Role: ${e.designation}`,
    e.reporting_manager && `Reports to: ${e.reporting_manager}`,
    e.experience && `Experience: ${e.experience}`,
    e.main_responsibility && `Main responsibility: ${e.main_responsibility}`,
  ].filter(Boolean);
  return parts.join("\n");
}

/**
 * Main entry: process one submitted answer for the employee identified by token.
 * Saves the raw answer first (never lost), then either advances the deterministic
 * profile phase or runs an AI deep-dive turn.
 */
export async function processAnswer(token: string, answer: string): Promise<TurnOutcome> {
  const db = getServiceClient();
  const employee = await getEmployeeByToken(token);
  if (!employee) throw new Error("invalid_token");

  const cleanAnswer = (answer || "").trim().slice(0, 2500);
  const { session } = await getOrCreateSession(employee);

  // 1) Persist the raw answer immediately.
  const userMsgId = await addMessage(
    db,
    employee.id,
    session.id,
    "user",
    cleanAnswer,
    session.current_task_id
  );
  await db
    .from("employees")
    .update({ status: "in_progress", last_activity: new Date().toISOString() })
    .eq("id", employee.id);

  // 2) Deterministic profile phase (steps 0-5): store field, ask next question.
  if (session.profile_step <= 5) {
    const field = PROFILE_FIELDS[session.profile_step];
    await db.from("employees").update({ [field]: cleanAnswer }).eq("id", employee.id);

    const nextStep = session.profile_step + 1;
    const nextQuestion = PROFILE_QUESTIONS[nextStep];
    await addMessage(db, employee.id, session.id, "assistant", nextQuestion, null);
    await db
      .from("sessions")
      .update({ profile_step: nextStep, current_question: nextQuestion })
      .eq("id", session.id);

    // Profile is the first 20% of the whole interview; deep-dive fills 20-100%.
    const progress = Math.round((nextStep / 6) * 20);
    await db.from("employees").update({ overall_progress: progress }).eq("id", employee.id);
    return { 
      nextQuestion, 
      progress, 
      done: false, 
      usedFallback: false,
      currentTaskCoverage: null,
      openBranches: []
    };
  }

  // 3) Deep-dive phase (step 6 = task-list answer, then step 7+ = per-task probing).
  const freshEmployee = (await getEmployeeByToken(token))!;
  const currentTask = await getTask(db, session.current_task_id);
  const recentMessages = await getRecentMessages(employee.id, 8);
  const openBranches = await getOpenBranches(db, employee.id);
  const documents = await getUploadsText(db, employee.id);

  const result = await runInterviewTurn({
    profile: profileString(freshEmployee),
    currentTask,
    openBranches,
    recentMessages,
    latestAnswer: answer,
    documents,
  });

  let nextTaskId = session.current_task_id;
  if (result.analysis) {
    nextTaskId = await applyAnalysis(db, freshEmployee, session, currentTask, result.analysis, userMsgId);
  }

  // Post the next question.
  await addMessage(db, employee.id, session.id, "assistant", result.nextQuestion, nextTaskId);
  await db
    .from("sessions")
    .update({
      profile_step: Math.max(session.profile_step, 7),
      current_task_id: nextTaskId,
      current_question: result.nextQuestion,
    })
    .eq("id", session.id);

  const { progress, done } = await recomputeProgress(db, employee.id);
  const updatedTask = nextTaskId ? await getTask(db, nextTaskId) : null;
  const newOpenBranches = await getOpenBranches(db, employee.id);

  return { 
    nextQuestion: result.nextQuestion, 
    progress, 
    done, 
    usedFallback: result.usedFallback,
    currentTaskCoverage: updatedTask?.coverage ?? null,
    openBranches: newOpenBranches
  };
}

export interface UploadPayload {
  fileName: string;
  kind: string; // sheet | pdf | doc | image | link | other
  mime: string;
  storagePath: string | null;
  extractedText: string;
  driveUrl?: string | null;
  comment?: string;
}

/**
 * Handle an uploaded document: record it, then run an interview turn grounded on
 * its text so the AI extracts tasks and asks the next question about the sheet.
 */
export async function processDocument(token: string, payload: UploadPayload): Promise<TurnOutcome> {
  const db = getServiceClient();
  const employee = await getEmployeeByToken(token);
  if (!employee) throw new Error("invalid_token");
  const { session } = await getOrCreateSession(employee);

  // Record the upload (extracted text is what the AI reads later).
  await db.from("uploads").insert({
    employee_id: employee.id,
    task_id: session.current_task_id,
    file_url: payload.storagePath,
    file_name: payload.fileName,
    mime_type: payload.mime,
    type: payload.kind,
    extracted_text: payload.extractedText || null,
    drive_url: payload.driveUrl ?? null,
  });

  const commentText = (payload.comment || "").trim();
  const chatDisplay = commentText 
    ? `${commentText}\n📎 ${payload.fileName}` 
    : `[Uploaded ${payload.kind}: ${payload.fileName}]`;

  // Log the upload as a user turn in the transcript.
  const userMsgId = await addMessage(
    db,
    employee.id,
    session.id,
    "user",
    chatDisplay,
    session.current_task_id
  );
  await db
    .from("employees")
    .update({ status: "in_progress", last_activity: new Date().toISOString() })
    .eq("id", employee.id);

  const currentTask = await getTask(db, session.current_task_id);
  const recentMessages = await getRecentMessages(employee.id, 8);
  const openBranches = await getOpenBranches(db, employee.id);
  const documents = await getUploadsText(db, employee.id);

  const notePrefix = commentText ? `User note: "${commentText}"\n\n` : "";
  const latest = payload.extractedText
    ? `${notePrefix}I uploaded my "${payload.fileName}". Its contents:\n${payload.extractedText.slice(0, 6000)}`
    : `${notePrefix}I uploaded "${payload.fileName}" but no text could be extracted. Please ask me to describe it.`;

  const result = await runInterviewTurn({
    profile: profileString(employee),
    currentTask,
    openBranches,
    recentMessages,
    latestAnswer: latest,
    documents,
  });

  let nextTaskId = session.current_task_id;
  if (result.analysis) {
    nextTaskId = await applyAnalysis(db, employee, session, currentTask, result.analysis, userMsgId);
  }

  await addMessage(db, employee.id, session.id, "assistant", result.nextQuestion, nextTaskId);
  await db
    .from("sessions")
    .update({
      profile_step: Math.max(session.profile_step, 7),
      current_task_id: nextTaskId,
      current_question: result.nextQuestion,
    })
    .eq("id", session.id);

  const { progress, done } = await recomputeProgress(db, employee.id);
  const updatedTask = nextTaskId ? await getTask(db, nextTaskId) : null;
  const newOpenBranches = await getOpenBranches(db, employee.id);

  return { 
    nextQuestion: result.nextQuestion, 
    progress, 
    done, 
    usedFallback: result.usedFallback,
    currentTaskCoverage: updatedTask?.coverage ?? null,
    openBranches: newOpenBranches
  };
}

/** Persist an AI analysis: facts, tasks, coverage, branches. Returns the current task id. */
async function applyAnalysis(
  db: DB,
  employee: Employee,
  session: Session,
  currentTask: Task | null,
  analysis: AIAnalysis,
  userMsgId: string
): Promise<string | null> {
  // Facts
  if (analysis.facts.length) {
    await db.from("facts").insert(
      analysis.facts.map((f) => ({
        employee_id: employee.id,
        task_id: currentTask?.id ?? null,
        message_id: userMsgId,
        category: f.category || "misc",
        fact_text: f.fact_text,
        source: "ai_extracted",
      }))
    );
  }

  // New tasks (dedupe by name, case-insensitive)
  if (analysis.new_tasks.length) {
    const { data: existingTasks } = await db
      .from("tasks")
      .select("name")
      .eq("employee_id", employee.id);
    const have = new Set(((existingTasks as { name: string }[]) ?? []).map((t) => t.name.toLowerCase()));
    const toInsert = analysis.new_tasks
      .filter((t) => t.name && !have.has(t.name.toLowerCase()))
      .map((t) => ({
        employee_id: employee.id,
        name: t.name,
        frequency: t.frequency ?? null,
        priority: t.priority ?? null,
        status: "pending",
        coverage: emptyCoverage(),
      }));
    if (toInsert.length) await db.from("tasks").insert(toInsert);
  }

  // Coverage update on the current task with jump clamp (max +40 per turn)
  if (currentTask && Object.keys(analysis.coverage_update).length) {
    const current = currentTask.coverage || emptyCoverage();
    const clampedUpdate: Partial<Coverage> = {};
    for (const [k, newVal] of Object.entries(analysis.coverage_update)) {
      const key = k as keyof Coverage;
      const prevVal = current[key] || 0;
      const targetVal = Math.min(100, Math.max(0, Number(newVal) || 0));
      // Clamp jump: max +40 per dimension per turn to prevent spoofed instant 100%
      clampedUpdate[key] = Math.min(prevVal + 40, targetVal);
    }
    const merged = { ...emptyCoverage(), ...current, ...clampedUpdate };
    await db
      .from("tasks")
      .update({ coverage: merged, updated_at: new Date().toISOString() })
      .eq("id", currentTask.id);
    currentTask.coverage = merged;
  }

  // Resolve branches by topic (case-insensitive)
  if (analysis.resolved_branch_topics.length) {
    const openBranches = await getOpenBranches(db, employee.id);
    const resolvedTopics = new Set(analysis.resolved_branch_topics.map((t) => t.toLowerCase()));
    const toResolve = openBranches.filter((b) => resolvedTopics.has(b.topic.toLowerCase()));
    for (const b of toResolve) {
      await db
        .from("branches")
        .update({ status: "resolved", resolved_at: new Date().toISOString() })
        .eq("id", b.id);
    }
  }

  // New branches (dedupe by topic among open)
  if (analysis.new_branches.length) {
    const openBranches = await getOpenBranches(db, employee.id);
    const openTopics = new Set(openBranches.map((b) => b.topic.toLowerCase()));
    const toInsert = analysis.new_branches
      .filter((b) => b.topic && !openTopics.has(b.topic.toLowerCase()))
      .map((b) => ({
        employee_id: employee.id,
        task_id: currentTask?.id ?? null,
        topic: b.topic,
        priority: b.priority || "medium",
        suggested_question: b.suggested_question ?? null,
      }));
    if (toInsert.length) await db.from("branches").insert(toInsert);
  }

  // Task progression: complete current, activate the next pending task.
  let currentTaskId = currentTask?.id ?? null;
  if (currentTask && analysis.current_task_complete) {
    const cov = currentTask.coverage || emptyCoverage();
    const rawMean = meanCoverage(cov);
    const coreCovered = (cov.steps || 0) >= 30 && (cov.tools || 0) >= 30;
    if (rawMean >= 45 && coreCovered) {
      await db.from("tasks").update({ status: "completed" }).eq("id", currentTask.id);
      currentTaskId = null;
    }
  }
  if (!currentTaskId) {
    const { data: nextPending } = await db
      .from("tasks")
      .select("*")
      .eq("employee_id", employee.id)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (nextPending) {
      currentTaskId = (nextPending as Task).id;
      await db.from("tasks").update({ status: "active" }).eq("id", currentTaskId);
      await db.from("employees").update({ current_task_id: currentTaskId }).eq("id", employee.id);
    }
  }
  return currentTaskId;
}

async function recomputeProgress(db: DB, employeeId: string): Promise<{ progress: number; done: boolean }> {
  const { data: tasks } = await db.from("tasks").select("status, coverage").eq("employee_id", employeeId);
  const list = (tasks as { status: string; coverage: Coverage }[]) ?? [];
  // Profile = 20% base; task coverage fills the remaining 80%. Never drops below 20.
  if (!list.length) {
    await db.from("employees").update({ overall_progress: 20 }).eq("id", employeeId);
    return { progress: 20, done: false };
  }
  const perTask = list.map((t) => {
    const raw = meanCoverage(t.coverage);
    return t.status === "completed" ? Math.max(75, raw) : raw;
  });
  const taskAvg = perTask.reduce((a, b) => a + b, 0) / perTask.length;
  const progress = Math.min(100, 20 + Math.round((taskAvg * 80) / 100));
  const { data: openBranches } = await db.from("branches").select("id").eq("employee_id", employeeId).eq("status", "open");
  const hasOpenBranches = (openBranches?.length ?? 0) > 0;
  const done = list.length > 0 && list.every((t) => t.status === "completed") && !hasOpenBranches;
  const finalProgress = done ? 100 : (hasOpenBranches ? Math.min(90, progress) : progress);
  await db
    .from("employees")
    .update({ overall_progress: finalProgress, status: done ? "completed" : "in_progress" })
    .eq("id", employeeId);
  return { progress: finalProgress, done };
}
