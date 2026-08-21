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
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
function TypingIndicator({ label = "AI is processing…" }: { label?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 0" }}>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: "12px 18px",
          background: "#ffffff",
          border: "1.5px solid #e2e8f0",
          borderRadius: "18px",
          boxShadow: "0 2px 6px rgba(15,23,42,0.04)",
        }}
      >
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
      <span style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)", fontWeight: 500 }}>{label}</span>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
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
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
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
      setMessages((m) => [...m, { role: "user", content: text }]);

      const res = await fetch("/api/interview/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, answer: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send");

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
          ? `${e.message} (Your answer remains saved in the input box below)`
          : "Failed to send. Please check connection and retry."
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
          // ignore
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
    } catch (err: unknown) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      setIsRecording(false);
      
      const errName = err instanceof Error ? err.name : "";
      const errMsg = err instanceof Error ? err.message : "";
      
      if (errName === "NotAllowedError" || errName === "PermissionDeniedError") {
        setError("Microphone permission was denied. Please click the camera/mic icon in your browser address bar and allow access.");
      } else if (errName === "NotFoundError" || errName === "DevicesNotFoundError") {
        setError("No microphone was detected on your device. Please plug in a microphone or type your answer below.");
      } else {
        setError(errMsg || "Microphone access or voice session initialization failed.");
      }
    }
  }

  const coverageKeys = Object.keys(coverage);
  const firstName = employeeName ? employeeName.split(" ")[0] : "";

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <main style={{ display: "flex", minHeight: "100dvh", alignItems: "center", justifyContent: "center", background: "#f8fafc" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, color: "var(--color-text-secondary)" }}>
          <div style={{ width: 28, height: 28, border: "3px solid var(--color-accent)", borderTopColor: "transparent", borderRadius: "50%" }} />
          <p style={{ fontSize: "0.9375rem", fontWeight: 500 }}>Initializing your interview session…</p>
        </div>
      </main>
    );
  }

  // ── Error (no session) ──────────────────────────────────────────────────────
  if (error && messages.length === 0) {
    return (
      <main style={{ display: "flex", minHeight: "100dvh", alignItems: "center", justifyContent: "center", padding: 24, background: "#f8fafc" }}>
        <div className="card" style={{ maxWidth: 400, padding: 32, textAlign: "center" }}>
          <div style={{ width: 52, height: 52, background: "var(--color-danger-light)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", border: "1px solid #fca5a5" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 9v2m0 4h.01M12 3a9 9 0 110 18A9 9 0 0112 3z" />
            </svg>
          </div>
          <h2 style={{ marginBottom: 10 }}>Invalid Interview Link</h2>
          <p style={{ color: "var(--color-text-secondary)", fontSize: "0.875rem", lineHeight: 1.5 }}>
            This interview session link is invalid or has expired. Please request a new link from your manager.
          </p>
        </div>
      </main>
    );
  }

  // ── Main Interview UI ────────────────────────────────────────────────────────
  return (
    <div className="interview-shell">
      {/* Main Chat Area */}
      <div className="chat-panel">
        {/* Top Header */}
        <header className="chat-header">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div className="avatar avatar-md">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a10 10 0 100 20 10 10 0 000-20z" />
                  <path d="M12 6v6l4 2" />
                </svg>
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: "1.0625rem" }}>
                    {firstName ? `Hi, ${firstName}!` : "Knowledge OS Interview"}
                  </span>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-success)", boxShadow: "0 0 0 2px rgba(16, 185, 129, 0.2)" }} title="AI Active" />
                </div>
                <div style={{ fontSize: "0.7813rem", color: "var(--color-text-secondary)", fontWeight: 500 }}>
                  Knowledge Architect · AI Interviewer
                </div>
              </div>
            </div>

            {/* Overall Progress Badge */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--color-accent)" }}>
                {progress}% Complete
              </span>
            </div>
          </div>

          {/* Dual-Tone Animated Progress Bar */}
          <div className="progress-track">
            <div className={`progress-fill ${progress >= 80 ? "green" : progress >= 45 ? "amber" : ""}`} style={{ width: `${progress}%` }} />
          </div>
        </header>

        {/* Message Feed */}
        <div ref={scrollRef} className="chat-messages scrollbar-thin">
          {messages.map((m, i) => (
            <div key={i} style={{ display: "flex", width: "100%", justifyContent: m.role === "assistant" ? "flex-start" : "flex-end" }}>
              <div className={`bubble ${m.role === "assistant" ? "bubble-ai" : "bubble-user"}`}>
                {m.role === "assistant" && (
                  <div style={{ fontSize: "0.6875rem", fontWeight: 700, color: "var(--color-accent)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                    AI Interviewer
                  </div>
                )}
                {m.content}
              </div>
            </div>
          ))}

          {sending && <TypingIndicator label="Analyzing your answer & preparing follow-up…" />}
          {uploading && <TypingIndicator label="Parsing document contents & extracting tasks…" />}
          {isRecording && <TypingIndicator label="Transcribing speech in real-time…" />}

          {/* Completed Banner */}
          {done && (
            <div
              style={{
                marginTop: 16,
                padding: 24,
                background: "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)",
                border: "1.5px solid #a7f3d0",
                borderRadius: "var(--radius-lg)",
                textAlign: "center",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div style={{ fontSize: "1.5rem", marginBottom: 6 }}>🎉</div>
              <h3 style={{ fontSize: "1.0625rem", fontWeight: 700, color: "var(--color-success-text)", marginBottom: 6 }}>
                Knowledge Documentation Complete!
              </h3>
              <p style={{ fontSize: "0.875rem", color: "#065f46", margin: 0, lineHeight: 1.5 }}>
                Thank you! Your task workflows and operational knowledge have been captured. Your manager can now generate your full SOP handover report.
              </p>
            </div>
          )}
        </div>

        {/* Unified Floating Chat Input Bar */}
        <footer className="chat-footer">
          {error && (
            <div style={{ marginBottom: 12, padding: "10px 14px", background: "var(--color-danger-light)", border: "1px solid #fca5a5", borderRadius: "var(--radius-md)", color: "var(--color-danger-text)", fontSize: "0.8125rem", fontWeight: 500 }}>
              ⚠ {error}
            </div>
          )}

          {done ? (
            <div style={{ textAlign: "center", padding: "16px 0", color: "var(--color-text-muted)", fontSize: "0.875rem", fontWeight: 500 }}>
              This knowledge capture session is complete. You may close this tab.
            </div>
          ) : (
            <div className="chat-input-container">
              {/* File Chip Preview inside bar */}
              {selectedFile && (
                <div className="file-chip">
                  <span>📎</span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {selectedFile.name}
                  </span>
                  <span style={{ opacity: 0.7, fontSize: "0.75rem" }}>
                    ({(selectedFile.size / 1024).toFixed(0)} KB)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      if (fileRef.current) fileRef.current.value = "";
                    }}
                    style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer", padding: "0 2px", fontWeight: "bold" }}
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Textarea */}
              <textarea
                ref={textareaRef}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={onKeyDown}
                rows={1}
                placeholder={
                  isRecording
                    ? "Listening to voice… speak now"
                    : selectedFile
                    ? "Add a comment with your file, then hit send…"
                    : "Type your answer… (Enter to send, Shift+Enter for newline)"
                }
                disabled={sending || uploading}
                className="chat-textarea"
              />

              {/* Integrated Actions Bar */}
              <div className="chat-actions-row">
                <div className="action-btn-group">
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
                  <button
                    type="button"
                    title="Attach spreadsheet, PDF, or document"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading || sending || isRecording}
                    className={`tool-icon-btn ${selectedFile ? "active" : ""}`}
                  >
                    <IconPaperclip />
                  </button>

                  <button
                    type="button"
                    title="Record voice input"
                    onClick={toggleRecording}
                    disabled={uploading || sending}
                    className={`tool-icon-btn ${isRecording ? "recording" : ""}`}
                  >
                    <IconMic active={isRecording} />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={submit}
                  disabled={sending || uploading || (!answer.trim() && !selectedFile)}
                  className="send-btn-round"
                  title="Send message"
                >
                  <IconSend />
                </button>
              </div>
            </div>
          )}
        </footer>
      </div>

      {/* Right Sidebar: Knowledge Progress */}
      <aside className="context-panel scrollbar-thin">
        <div style={{ padding: "20px", borderBottom: "1px solid var(--color-border)", background: "#ffffff" }}>
          <h3 style={{ fontSize: "0.9375rem", marginBottom: 2 }}>Knowledge Progress</h3>
          <p style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)" }}>Real-time coverage & probing state</p>
        </div>

        {/* Open Probing Threads */}
        <div className="context-section">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--color-text-primary)" }}>
              Open Threads
            </span>
            <span className="badge badge-accent">
              {branches.length}
            </span>
          </div>
          {branches.length === 0 ? (
            <p style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>No open follow-up threads.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {branches.map((b, i) => (
                <div
                  key={i}
                  style={{
                    padding: "10px 12px",
                    background: "var(--color-warn-light)",
                    border: "1px solid #fcd34d",
                    borderRadius: "var(--radius-md)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "var(--color-warn-text)", textTransform: "uppercase" }}>
                      {b.priority}
                    </span>
                    <span className="badge badge-warn" style={{ fontSize: "0.625rem" }}>Open</span>
                  </div>
                  <p style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#92400e" }}>{b.topic}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Coverage Dimensions */}
        <div className="context-section" style={{ borderBottom: "none" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--color-text-primary)" }}>
              Task Coverage
            </span>
            {coverageKeys.length > 0 && (
              <span className="badge badge-success">
                {Math.round(coverageKeys.reduce((a, k) => a + coverage[k], 0) / coverageKeys.length)}%
              </span>
            )}
          </div>
          {coverageKeys.length === 0 ? (
            <div style={{ padding: "16px 0", textAlign: "center", color: "var(--color-text-muted)", fontSize: "0.8125rem" }}>
              Discovering task dimensions…
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {coverageKeys.map((k) => (
                <div key={k}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      {k.replace(/_/g, " ")}
                    </span>
                    <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "var(--color-text-primary)" }}>{coverage[k]}%</span>
                  </div>
                  <div className="progress-track" style={{ height: 4 }}>
                    <div
                      className={`progress-fill ${coverage[k] >= 80 ? "green" : coverage[k] >= 40 ? "amber" : ""}`}
                      style={{ width: `${coverage[k]}%` }}
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
