import Link from "next/link";

export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background: "var(--color-bg)",
      }}
    >
      <div style={{ maxWidth: 440, width: "100%", textAlign: "center" }}>
        {/* Logo mark */}
        <div
          style={{
            width: 48,
            height: 48,
            background: "var(--color-accent)",
            borderRadius: "var(--radius-lg)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 24px",
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>

        <h1 style={{ fontSize: "1.5rem", marginBottom: 10 }}>Knowledge OS</h1>
        <p style={{ color: "var(--color-text-secondary)", maxWidth: 360, margin: "0 auto 32px", lineHeight: 1.65 }}>
          AI-guided interviews that capture each employee&apos;s complete working knowledge — tasks, tools, workflows, and decision rules.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
          <Link
            href="/admin"
            className="btn btn-primary"
            style={{ width: "100%", maxWidth: 260, height: 42, fontSize: "0.9375rem" }}
          >
            Open Admin Dashboard
          </Link>
          <p style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>
            Employees: open the personal link your manager sent you.
          </p>
        </div>
      </div>
    </main>
  );
}
