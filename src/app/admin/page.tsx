"use client";

import { useCallback, useState } from "react";

interface EmployeeRow {
  id: string;
  full_name: string;
  department: string | null;
  designation: string | null;
  status: string;
  overall_progress: number;
  interview_url: string;
  last_activity: string | null;
}

interface TranscriptData {
  messages: { role: string; content: string }[];
  tasks: { name: string; status: string; coverage?: Record<string, number> }[];
  facts: { category: string; fact_text: string }[];
  branches: { topic: string; status: string; priority: string; suggested_question?: string }[];
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function timeAgo(ts: string | null) {
  if (!ts) return "—";
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    invited: "badge badge-neutral",
    not_started: "badge badge-neutral",
    in_progress: "badge badge-warn",
    completed: "badge badge-success",
  };
  const labels: Record<string, string> = {
    invited: "Invited",
    not_started: "Not started",
    in_progress: "In progress",
    completed: "Completed",
  };
  return { cls: map[status] ?? "badge badge-neutral", label: labels[status] ?? status };
}

function ProgressBar({ value }: { value: number }) {
  const cls = value >= 80 ? "green" : value >= 40 ? "amber" : "";
  return (
    <div className="progress-track">
      <div className={`progress-fill ${cls}`} style={{ width: `${value}%` }} />
    </div>
  );
}

function AvatarDot({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const colors = [
    "#1e40af","#1d4ed8","#0f766e","#166534","#9a3412","#7c3aed","#be185d","#0369a1",
  ];
  const idx = (name.charCodeAt(0) + (name.charCodeAt(1) || 0)) % colors.length;
  return (
    <div
      className={`avatar avatar-${size}`}
      style={{ background: colors[idx] }}
    >
      {initials(name)}
    </div>
  );
}

// ── Icon atoms ────────────────────────────────────────────────────────────────
const IconRefresh = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);
const IconPlus = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 4v16m8-8H4" />
  </svg>
);
const IconLink = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
  </svg>
);
const IconDownload = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);
const IconClose = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 18L18 6M6 6l12 12" />
  </svg>
);
const IconUsers = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);
const IconDoc = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

// ── Main Component ────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [pass, setPass] = useState("");
  const [authed, setAuthed] = useState(false);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const [form, setForm] = useState({ full_name: "", department: "", designation: "", reporting_manager: "" });
  const [creating, setCreating] = useState(false);
  const [newLink, setNewLink] = useState("");

  const [viewing, setViewing] = useState<EmployeeRow | null>(null);
  const [transcript, setTranscript] = useState<TranscriptData | null>(null);
  const [activeTab, setActiveTab] = useState<"chat" | "tasks" | "facts" | "branches">("chat");

  const headers = useCallback(
    () => ({ "Content-Type": "application/json", "x-admin-passphrase": pass }),
    [pass]
  );

  const loadEmployees = useCallback(async () => {
    if (!pass.trim()) {
      setError("Please enter the admin passphrase");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/employees", { headers: headers() });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Incorrect passphrase. (Ensure ADMIN_PASSPHRASE is set in Vercel Environment Variables)");
        }
        throw new Error(data.error || "Login failed");
      }
      setEmployees(data.employees ?? []);
      setAuthed(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to sign in");
      setAuthed(false);
    } finally {
      setLoading(false);
    }
  }, [pass, headers]);

  async function addEmployee(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNewLink("");
    setCreating(true);
    try {
      const res = await fetch("/api/admin/employees", { method: "POST", headers: headers(), body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setNewLink(data.interview_url);
      setForm({ full_name: "", department: "", designation: "", reporting_manager: "" });
      loadEmployees();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setCreating(false);
    }
  }

  async function viewTranscript(emp: EmployeeRow) {
    setViewing(emp);
    setTranscript(null);
    setActiveTab("chat");
    try {
      const res = await fetch(`/api/admin/transcript?employee_id=${emp.id}`, { headers: headers() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setTranscript(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  async function copyLink(url: string, id: string) {
    await navigator.clipboard.writeText(url);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  async function downloadSOP(emp: EmployeeRow) {
    try {
      const res = await fetch(`/api/admin/sop?employee_id=${emp.id}`, { headers: headers() });
      if (!res.ok) throw new Error("Failed to generate SOP");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${emp.full_name.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_sop.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to download SOP");
    }
  }

  async function exportPDF(emp: EmployeeRow) {
    try {
      const res = await fetch(`/api/admin/sop/pdf?employee_id=${emp.id}`, { headers: headers() });
      if (!res.ok) throw new Error("Failed to generate PDF view");
      const html = await res.text();
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, "_blank");
      if (!win) {
        throw new Error("Popup blocked. Please allow popups for this site.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate PDF");
    }
  }

  const stats = {
    total: employees.length,
    inProgress: employees.filter((e) => e.status === "in_progress").length,
    completed: employees.filter((e) => e.status === "completed").length,
    notStarted: employees.filter((e) => e.status !== "in_progress" && e.status !== "completed").length,
  };

  // ── Login Screen ────────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", background: "var(--color-bg)" }}>
        <div style={{ width: "100%", maxWidth: 380 }}>
          <div style={{ marginBottom: 32, textAlign: "center" }}>
            <div style={{ width: 44, height: 44, background: "var(--color-accent)", borderRadius: "var(--radius-lg)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <IconDoc />
            </div>
            <h1 style={{ fontSize: "1.25rem", marginBottom: 6 }}>Knowledge OS</h1>
            <p style={{ color: "var(--color-text-secondary)", fontSize: "0.875rem" }}>Admin dashboard</p>
          </div>

          <div className="card" style={{ padding: 28 }}>
            <form onSubmit={(e) => { e.preventDefault(); loadEmployees(); }}>
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 8 }}>
                  Admin passphrase
                </label>
                <input
                  type="password"
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  onInput={(e) => setPass((e.target as HTMLInputElement).value)}
                  placeholder="Enter passphrase"
                  className="input"
                  style={{ width: "100%", height: 42, fontSize: "0.9375rem" }}
                  autoFocus
                />
                {error && (
                  <p style={{ marginTop: 8, fontSize: "0.8125rem", color: "var(--color-danger-text)", fontWeight: 500 }}>
                    {error}
                  </p>
                )}
              </div>
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary"
                style={{ width: "100%", height: 42, fontSize: "0.9375rem", fontWeight: 600 }}
              >
                {loading ? "Verifying…" : "Sign in"}
              </button>
            </form>
          </div>
        </div>
      </main>
    );
  }

  // ── Dashboard ───────────────────────────────────────────────────────────────
  return (
    <div className="page-shell">
      {/* Top bar */}
      <header className="topbar">
        <div className="topbar-inner">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 28, height: 28, background: "var(--color-accent)", borderRadius: "var(--radius-md)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span style={{ fontWeight: 600, fontSize: "0.9375rem" }}>Knowledge OS</span>
            <span style={{ color: "var(--color-text-muted)", fontSize: "0.8125rem" }}>/ Admin</span>
          </div>
          <button onClick={loadEmployees} disabled={loading} className="btn btn-secondary" style={{ gap: 6 }}>
            <IconRefresh />
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
      </header>

      <div className="page-body">
        {error && (
          <div className="alert alert-error" style={{ marginBottom: 20 }}>
            <span>⚠</span>
            <span>{error}</span>
          </div>
        )}

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16, marginBottom: 24 }}>
          {[
            { label: "Total", value: stats.total, color: "var(--color-text-primary)" },
            { label: "Not started", value: stats.notStarted, color: "var(--color-text-secondary)" },
            { label: "In progress", value: stats.inProgress, color: "var(--color-warn)" },
            { label: "Completed", value: stats.completed, color: "var(--color-success)" },
          ].map((s) => (
            <div key={s.label} className="stat-card">
              <div className="stat-label">{s.label}</div>
              <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Add employee */}
        <div className="card" style={{ padding: 24, marginBottom: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: "0.9375rem", marginBottom: 4 }}>Add employee</h2>
            <p style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)" }}>
              Fill in details to generate a private interview link.
            </p>
          </div>

          <form onSubmit={addEmployee}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: 6 }}>
                  Employee Name *
                </label>
                <input
                  required
                  placeholder="e.g. Rahul Sharma"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  className="input"
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: 6 }}>
                  Role / Designation *
                </label>
                <input
                  required
                  placeholder="e.g. Senior Accountant"
                  value={form.designation}
                  onChange={(e) => setForm({ ...form, designation: e.target.value })}
                  className="input"
                />
              </div>
            </div>
            <button type="submit" disabled={creating} className="btn btn-primary">
              <IconPlus />
              {creating ? "Creating…" : "Create interview link"}
            </button>
          </form>

          {newLink && (
            <div className="alert alert-info" style={{ marginTop: 16 }}>
              <IconLink />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: "0.8125rem", marginBottom: 4 }}>
                  Interview link ready — send to the employee
                </div>
                <code style={{ fontSize: "0.8125rem", wordBreak: "break-all" }}>{newLink}</code>
              </div>
              <button
                onClick={() => copyLink(newLink, "new")}
                className="btn btn-secondary"
                style={{ flexShrink: 0, height: 30, fontSize: "0.75rem" }}
              >
                {copied === "new" ? "Copied!" : "Copy"}
              </button>
            </div>
          )}
        </div>

        {/* Employee table */}
        <div className="card" style={{ overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--color-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h2 style={{ fontSize: "0.9375rem" }}>Employees ({employees.length})</h2>
          </div>

          {employees.length === 0 ? (
            <div style={{ padding: "60px 24px", textAlign: "center", color: "var(--color-text-muted)" }}>
              <div style={{ marginBottom: 12 }}><IconUsers /></div>
              <p style={{ fontWeight: 500, marginBottom: 4 }}>No employees yet</p>
              <p style={{ fontSize: "0.8125rem" }}>Add an employee above to get started.</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Department</th>
                    <th>Status</th>
                    <th style={{ width: 160 }}>Progress</th>
                    <th>Last active</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp) => {
                    const { cls, label } = statusBadge(emp.status);
                    return (
                      <tr key={emp.id}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <AvatarDot name={emp.full_name || "?"} size="sm" />
                            <div>
                              <div style={{ fontWeight: 500, fontSize: "0.875rem" }}>{emp.full_name}</div>
                              <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>{emp.designation ?? "—"}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          {emp.department ? (
                            <span className="badge badge-neutral">{emp.department}</span>
                          ) : (
                            <span style={{ color: "var(--color-text-muted)" }}>—</span>
                          )}
                        </td>
                        <td>
                          <span className={cls}>{label}</span>
                        </td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <ProgressBar value={emp.overall_progress} />
                            <span style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)", flexShrink: 0, width: 30, textAlign: "right" }}>
                              {emp.overall_progress}%
                            </span>
                          </div>
                        </td>
                        <td style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>
                          {timeAgo(emp.last_activity)}
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <button
                              onClick={() => copyLink(emp.interview_url, emp.id)}
                              className="btn btn-secondary"
                              style={{ height: 30, fontSize: "0.75rem", padding: "0 10px" }}
                            >
                              {copied === emp.id ? "Copied!" : "Copy link"}
                            </button>
                            <button
                              onClick={() => viewTranscript(emp)}
                              className="btn btn-secondary"
                              style={{ height: 30, fontSize: "0.75rem", padding: "0 10px" }}
                            >
                              View
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Drawer */}
      {viewing && (
        <div className="drawer-overlay" onClick={() => setViewing(null)}>
          <div className="drawer-backdrop" />
          <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
            {/* Drawer Header */}
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--color-border)", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <AvatarDot name={viewing.full_name || "?"} size="md" />
                  <div>
                    <div style={{ fontWeight: 600 }}>{viewing.full_name}</div>
                    <div style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>
                      {viewing.designation ?? ""}{viewing.department ? ` · ${viewing.department}` : ""}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => exportPDF(viewing)} className="btn btn-primary" style={{ height: 32, fontSize: "0.75rem" }}>
                    <IconDownload />
                    Export PDF
                  </button>
                  <button onClick={() => downloadSOP(viewing)} className="btn btn-secondary" style={{ height: 32, fontSize: "0.75rem" }}>
                    Markdown
                  </button>
                  <button onClick={() => setViewing(null)} className="btn btn-ghost" style={{ width: 32, height: 32, padding: 0 }}>
                    <IconClose />
                  </button>
                </div>
              </div>

              {/* Progress strip */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <ProgressBar value={viewing.overall_progress} />
                <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-text-secondary)", flexShrink: 0 }}>
                  {viewing.overall_progress}%
                </span>
              </div>

              {/* Tabs */}
              <div style={{ display: "flex", gap: 4 }}>
                {(["chat", "tasks", "facts", "branches"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`nav-tab ${activeTab === tab ? "active" : ""}`}
                  >
                    {tab === "chat" && "Conversation"}
                    {tab === "tasks" && `Tasks${transcript ? ` (${transcript.tasks.length})` : ""}`}
                    {tab === "facts" && `Facts${transcript ? ` (${transcript.facts.length})` : ""}`}
                    {tab === "branches" && `Follow-ups${transcript ? ` (${transcript.branches.filter((b) => b.status === "open").length})` : ""}`}
                  </button>
                ))}
              </div>
            </div>

            {/* Drawer Body */}
            <div className="scrollbar-thin" style={{ flex: 1, overflowY: "auto", padding: 20 }}>
              {!transcript ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 0", gap: 12, color: "var(--color-text-muted)" }}>
                  <div style={{ width: 20, height: 20, border: "2px solid var(--color-accent)", borderTopColor: "transparent", borderRadius: "50%" }} />
                  <p style={{ fontSize: "0.875rem" }}>Loading…</p>
                </div>
              ) : (
                <>
                  {/* Chat */}
                  {activeTab === "chat" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {transcript.messages.length === 0 && (
                        <p style={{ textAlign: "center", color: "var(--color-text-muted)", fontSize: "0.875rem" }}>No messages yet.</p>
                      )}
                      {transcript.messages.map((m, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                          <div className={`bubble ${m.role === "user" ? "bubble-user" : "bubble-ai"}`}>
                            {m.content}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Tasks */}
                  {activeTab === "tasks" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {transcript.tasks.length === 0 && (
                        <p style={{ textAlign: "center", color: "var(--color-text-muted)", fontSize: "0.875rem" }}>No tasks extracted yet.</p>
                      )}
                      {transcript.tasks.map((t, i) => {
                        const cov = t.coverage ?? {};
                        const keys = Object.keys(cov);
                        const avg = keys.length ? Math.round(keys.reduce((s, k) => s + (cov[k] ?? 0), 0) / keys.length) : 0;
                        const { cls, label } = statusBadge(t.status);
                        return (
                          <div key={i} className="card" style={{ padding: 14 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                              <span style={{ fontWeight: 500, fontSize: "0.875rem" }}>{t.name}</span>
                              <span className={cls}>{label}</span>
                            </div>
                            {keys.length > 0 && (
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <ProgressBar value={avg} />
                                <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", flexShrink: 0 }}>{avg}%</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Facts */}
                  {activeTab === "facts" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {transcript.facts.length === 0 && (
                        <p style={{ textAlign: "center", color: "var(--color-text-muted)", fontSize: "0.875rem" }}>No facts extracted yet.</p>
                      )}
                      {transcript.facts.map((f, i) => (
                        <div key={i} style={{ padding: "10px 14px", background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)" }}>
                          <span className="badge badge-neutral" style={{ marginBottom: 6 }}>{f.category}</span>
                          <p style={{ fontSize: "0.875rem", color: "var(--color-text-primary)", lineHeight: 1.5 }}>{f.fact_text}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Branches */}
                  {activeTab === "branches" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {transcript.branches.length === 0 && (
                        <p style={{ textAlign: "center", color: "var(--color-text-muted)", fontSize: "0.875rem" }}>No follow-ups yet.</p>
                      )}
                      {transcript.branches.map((b, i) => {
                        const isOpen = b.status === "open";
                        return (
                          <div
                            key={i}
                            style={{
                              padding: "12px 14px",
                              background: isOpen ? "var(--color-warn-light)" : "var(--color-bg)",
                              border: `1px solid ${isOpen ? "#fde68a" : "var(--color-border)"}`,
                              borderRadius: "var(--radius-md)",
                            }}
                          >
                            <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                              <span className={`badge ${isOpen ? "badge-warn" : "badge-success"}`}>{b.status}</span>
                              <span className="badge badge-neutral">{b.priority}</span>
                            </div>
                            <p style={{ fontWeight: 500, fontSize: "0.875rem", marginBottom: b.suggested_question ? 4 : 0 }}>{b.topic}</p>
                            {b.suggested_question && (
                              <p style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)", fontStyle: "italic" }}>
                                {b.suggested_question}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
