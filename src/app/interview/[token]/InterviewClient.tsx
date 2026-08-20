"use client";

import React, { useEffect, useRef, useState } from "react";
function IconPaperclip() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

function IconMic({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" fill={active ? "currentColor" : "none"} />
      <path d="M19 10v2a7 7 0 01-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function IconSend() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" fill="currentColor" />
    </svg>
  );
}

interface ChatMessage {
  role: "assistant" | "user" | "system";
  content: string;
}

const ACCEPT = ".pdf,.xlsx,.xls,.csv,.docx,.doc,.txt,image/*";

// ── Typing Indicator ─────────────────────────────────────────────────────────
function TypingIndicator({ label = "AI is thinking…" }: { label?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: "10px 14px",
          background: "var(--color-bg-subtle)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-lg)",
        }}
      >
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
      <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>{label}</span>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function InterviewClient({ token }: { token: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [employeeName, setEmployeeName] = useState("");
  const [progress, setProgress] = useState(0);
  const [answer, setAnswer] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [coverage, setCoverage] = useState<Record<string, number>>({});
  const [branches, setBranches] = useState<{ topic: string; priority: string; status: string }[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isSubmittingRef = useRef<boolean>(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/interview/session?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not load interview");
        setEmployeeName(data.employee?.full_name ?? "");
        setProgress(data.progress ?? 0);
        setMessages(data.messages ?? []);
        if (data.currentTaskCoverage) setCoverage(data.currentTaskCoverage);
        if (data.openBranches) setBranches(data.openBranches);
        if (data.done) setDone(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load interview");
      } finally {
        setLoading(false);
      }
    })();

    // Cleanup audio tracks and socket on unmount
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [token]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending, uploading]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 148) + "px";
  }, [answer]);

  async function submit() {
    const text = answer.trim();
    if ((!text && !selectedFile) || isSubmittingRef.current) return;

    if (selectedFile) {
      await uploadFileWithComment(selectedFile, text);
      return;
    }

    isSubmittingRef.current = true;
    setSending(true);
    setError("");

    try {
      // Optimistically show user message
      setMessages((m) => [...m, { role: "user", content: text }]);

      const res = await fetch("/api/interview/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, answer: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send");

      // Only clear textarea on confirmed success
      setAnswer("");
      setMessages((m) => [...m, { role: "assistant", content: data.nextQuestion }]);
      if ("speechSynthesis" in window) {
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(data.nextQuestion));
      }
      setProgress(data.progress ?? progress);
      setCoverage(data.currentTaskCoverage ?? coverage);
      if (data.openBranches) setBranches(data.openBranches);
      if (data.done) setDone(true);
    } catch (e) {
      setMessages((m) => m.slice(0, -1));
      setError(
        e instanceof Error
          ? `${e.message} (Your message is preserved in the box below — please check your network and retry)`
          : "Failed to send. Please check your connection and retry."
      );
    } finally {
      setSending(false);
      isSubmittingRef.current = false;
    }
  }

  async function uploadFileWithComment(file: File, commentText: string) {
    if (uploading || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setUploading(true);
    setError("");

    const displayMsg = commentText ? `${commentText}\n📎 ${file.name}` : `📎 ${file.name}`;
    setMessages((m) => [...m, { role: "user", content: displayMsg }]);

    try {
      const fd = new FormData();
      fd.append("token", token);
      fd.append("file", file);
      if (commentText) fd.append("comment", commentText);

      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      // Clear input and file on success
      setAnswer("");
      setSelectedFile(null);
      if (fileRef.current) fileRef.current.value = "";

      setMessages((m) => [...m, { role: "assistant", content: data.nextQuestion }]);
      if ("speechSynthesis" in window) {
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(data.nextQuestion));
      }
      setProgress(data.progress ?? progress);
      setCoverage(data.currentTaskCoverage ?? coverage);
      if (data.openBranches) setBranches(data.openBranches);
      if (data.done) setDone(true);
    } catch (e) {
      setMessages((m) => m.slice(0, -1));
      setError(e instanceof Error ? e.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
      isSubmittingRef.current = false;
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  async function toggleRecording() {
    if (isRecording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (socketRef.current) {
        socketRef.current.close();
      }
      setIsRecording(false);
      return;
    }

    try {
      setError("");
      const keyRes = await fetch(`/api/deepgram-key?token=${encodeURIComponent(token)}`);
      const { key, error: keyErr } = await keyRes.json();
      if (!key) throw new Error(keyErr || "Could not authenticate voice session");

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      const wsUrl = "wss://api.deepgram.com/v1/listen?model=nova-3&language=multi&smart_format=true&punctuate=true";
      const socket = new WebSocket(wsUrl, ["token", key]);
      socketRef.current = socket;

      socket.onopen = () => {
        mediaRecorder.addEventListener("dataavailable", (e) => {
          if (e.data.size > 0 && socket.readyState === 1) socket.send(e.data);
        });
        mediaRecorder.start(250);
        setIsRecording(true);
      };

      socket.onmessage = (msg) => {
        try {
          const res = JSON.parse(msg.data);
          const transcript = res.channel?.alternatives?.[0]?.transcript;
          if (transcript && res.is_final) {
            setAnswer((prev) => (prev ? `${prev} ${transcript}` : transcript));
          }
        } catch {
          // ignore parse errors on keepalive frames
        }
      };

      socket.onclose = () => {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
        setIsRecording(false);
      };

      socket.onerror = () => {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
        setIsRecording(false);
      };
    } catch {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      setIsRecording(false);
      setError("Microphone access or voice connection failed. You can continue typing your answer below.");
    }
  }

  const progressColor = progress >= 80 ? "var(--color-success)" : progress >= 40 ? "var(--color-warn)" : "var(--color-accent)";
  const coverageKeys = Object.keys(coverage);
  const firstName = employeeName ? employeeName.split(" ")[0] : "";

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <main style={{ display: "flex", minHeight: "100dvh", alignItems: "center", justifyContent: "center", background: "var(--color-bg)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, color: "var(--color-text-muted)" }}>
          <div style={{ width: 24, height: 24, border: "2px solid var(--color-accent)", borderTopColor: "transparent", borderRadius: "50%" }} />
          <p style={{ fontSize: "0.875rem" }}>Loading your interview…</p>
        </div>
      </main>
    );
  }

  // ── Error (no session) ──────────────────────────────────────────────────────
  if (error && messages.length === 0) {
    return (
      <main style={{ display: "flex", minHeight: "100dvh", alignItems: "center", justifyContent: "center", padding: 24, background: "var(--color-bg)" }}>
        <div style={{ maxWidth: 360, textAlign: "center" }}>
          <div style={{ width: 44, height: 44, background: "var(--color-danger-light)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", border: "1px solid #fca5a5" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 9v2m0 4h.01M12 3a9 9 0 110 18A9 9 0 0112 3z" />
            </svg>
          </div>
          <h2 style={{ marginBottom: 8 }}>Link not valid</h2>
          <p style={{ color: "var(--color-text-secondary)", fontSize: "0.875rem" }}>
            This interview link is invalid or has expired. Please ask your manager to resend the link.
          </p>
        </div>
      </main>
    );
  }

  // ── Main Interview UI ────────────────────────────────────────────────────────
  return (
    <div className="interview-shell">
      {/* Chat Panel */}
      <div className="chat-panel">
        {/* Header */}
        <header className="chat-header">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {/* AI avatar */}
              <div style={{ width: 32, height: 32, background: "var(--color-accent)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.9375rem" }}>
                  {firstName ? `Hi, ${firstName}!` : "Knowledge Interview"}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>Knowledge Architect · AI</div>
              </div>
            </div>

            {/* Progress badge */}
            <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: progressColor }}>
              {progress}%
            </span>
          </div>

          {/* Progress bar */}
          <div className="progress-track" style={{ height: 3 }}>
            <div className="progress-fill" style={{ width: `${progress}%`, background: progressColor }} />
          </div>
        </header>

        {/* Message feed */}
        <div ref={scrollRef} className="chat-feed scrollbar-thin">
          {messages.map((m, i) => (
            <div key={i} className={`bubble ${m.role === "assistant" ? "bubble-ai" : "bubble-user"}`}>
              {m.content}
            </div>
          ))}

          {sending && <TypingIndicator label="AI is thinking…" />}
          {uploading && <TypingIndicator label="Analyzing document with AI…" />}
          {isRecording && <TypingIndicator label="Listening to your voice…" />}

          {/* Completed banner */}
          {done && (
            <div
              style={{
                marginTop: 16,
                padding: 16,
                background: "var(--color-success-light)",
                border: "1px solid #86efac",
                borderRadius: "var(--radius-lg)",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "1.25rem", marginBottom: 6 }}>🎉</div>
              <h3 style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--color-success)", marginBottom: 4 }}>
                Interview complete!
              </h3>
              <p style={{ fontSize: "0.8125rem", color: "#166534", margin: 0 }}>
                Thank you! Your knowledge has been captured into the company base. Your manager can now generate your handover documentation.
              </p>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <footer className="chat-footer">
          {error && (
            <div style={{ marginBottom: 10, padding: "8px 12px", background: "var(--color-danger-light)", border: "1px solid #fca5a5", borderRadius: "var(--radius-md)", color: "var(--color-danger)", fontSize: "0.8125rem" }}>
              {error}
            </div>
          )}

          {done ? (
            <div style={{ textAlign: "center", padding: "12px 0", color: "var(--color-text-muted)", fontSize: "0.875rem" }}>
              This interview is complete. You can close this window.
            </div>
          ) : (
            <div>
              {/* Selected File Chip */}
              {selectedFile && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "6px 12px",
                    background: "#eff6ff",
                    border: "1px solid #bfdbfe",
                    borderRadius: "var(--radius-md)",
                    marginBottom: 8,
                    fontSize: "0.8125rem",
                    color: "#1d4ed8",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, overflow: "hidden" }}>
                    <span>📎</span>
                    <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {selectedFile.name}
                    </span>
                    <span style={{ color: "#64748b", fontSize: "0.75rem", flexShrink: 0 }}>
                      ({(selectedFile.size / 1024).toFixed(0)} KB)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      if (fileRef.current) fileRef.current.value = "";
                    }}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#64748b",
                      cursor: "pointer",
                      padding: "2px 6px",
                      fontSize: "0.875rem",
                      fontWeight: "bold",
                      lineHeight: 1,
                    }}
                    title="Remove file"
                  >
                    ✕
                  </button>
                </div>
              )}

              <div className="chat-input-bar">
                {/* Hidden file input */}
                <input
                  ref={fileRef}
                  type="file"
                  accept={ACCEPT}
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setSelectedFile(f);
                  }}
                />
                {/* Upload */}
                <button
                  type="button"
                  title="Attach a sheet, PDF, or photo"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading || sending || isRecording}
                  className="btn btn-secondary"
                  style={{
                    width: 38,
                    height: 38,
                    padding: 0,
                    flexShrink: 0,
                    ...(selectedFile ? { borderColor: "#3b82f6", color: "#2563eb", background: "#eff6ff" } : {}),
                  }}
                >
                  <IconPaperclip />
                </button>
                {/* Mic */}
                <button
                  type="button"
                  title="Record voice"
                  onClick={toggleRecording}
                  disabled={uploading || sending}
                  className="btn btn-secondary"
                  style={{
                    width: 38,
                    height: 38,
                    padding: 0,
                    flexShrink: 0,
                    ...(isRecording ? { color: "var(--color-danger)", borderColor: "#fca5a5", background: "var(--color-danger-light)" } : {}),
                  }}
                >
                  <IconMic active={isRecording} />
                </button>
                {/* Textarea */}
                <textarea
                  ref={textareaRef}
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  onKeyDown={onKeyDown}
                  rows={1}
                  placeholder={
                    isRecording
                      ? "Listening… speak now"
                      : selectedFile
                      ? "Add a note with your file (optional), then hit send…"
                      : "Type your answer… (Enter to send)"
                  }
                  disabled={sending || uploading}
                  className="textarea"
                  style={{ flex: 1, minHeight: 38, maxHeight: 148 }}
                />
                {/* Send */}
                <button
                  onClick={submit}
                  disabled={sending || uploading || (!answer.trim() && !selectedFile)}
                  className="btn btn-primary"
                  style={{ width: 38, height: 38, padding: 0, flexShrink: 0 }}
                  title="Send message"
                >
                  <IconSend />
                </button>
              </div>
            </div>
          )}
        </footer>
      </div>

      {/* Context Panel (desktop only) */}
      <aside className="context-panel scrollbar-thin">
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--color-border)" }}>
          <h4 style={{ marginBottom: 0 }}>Knowledge Progress</h4>
        </div>

        {/* Open Branches */}
        <div className="context-section">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-text-secondary)" }}>
              Open threads
            </span>
            <span style={{ fontSize: "0.75rem", background: "#f3f4f6", borderRadius: "var(--radius-full)", padding: "2px 8px", color: "var(--color-text-secondary)" }}>
              {branches.length}
            </span>
          </div>
          {branches.length === 0 ? (
            <p style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>No open threads.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {branches.map((b, i) => (
                <div
                  key={i}
                  style={{
                    padding: "8px 10px",
                    background: "var(--color-warn-light)",
                    border: "1px solid #fde68a",
                    borderRadius: "var(--radius-md)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: b.priority === "high" || b.priority === "critical" ? "var(--color-danger)" : "var(--color-warn)",
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--color-warn-text)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      {b.priority}
                    </span>
                  </div>
                  <p style={{ fontSize: "0.8125rem", fontWeight: 500, color: "#92400e", margin: 0 }}>{b.topic}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Coverage */}
        <div className="context-section" style={{ borderBottom: "none" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-text-secondary)" }}>
              Task coverage
            </span>
            {coverageKeys.length > 0 && (
              <span className="badge badge-accent">
                {Math.round(coverageKeys.reduce((a, k) => a + coverage[k], 0) / coverageKeys.length)}%
              </span>
            )}
          </div>
          {coverageKeys.length === 0 ? (
            <p style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>Discovering tasks…</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {coverageKeys.map((k) => (
                <div key={k}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: "0.6875rem", fontWeight: 500, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {k.replace(/_/g, " ")}
                    </span>
                    <span style={{ fontSize: "0.6875rem", color: "var(--color-text-muted)" }}>{coverage[k]}%</span>
                  </div>
                  <div className="progress-track" style={{ height: 3 }}>
                    <div
                      className="progress-fill"
                      style={{ width: `${coverage[k]}%`, background: coverage[k] >= 80 ? "var(--color-success)" : coverage[k] >= 40 ? "var(--color-warn)" : "var(--color-accent)" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
