import { NextResponse } from "next/server";
import { assertServerEnv, config } from "@/lib/config";
import { isAdmin } from "@/lib/adminAuth";
import { getServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";

const tokenMintRateLimit = new Map<string, { count: number; resetAt: number }>();

function evictExpired(now: number) {
  if (tokenMintRateLimit.size > 200) {
    for (const [key, val] of tokenMintRateLimit.entries()) {
      if (now > val.resetAt) {
        tokenMintRateLimit.delete(key);
      }
    }
  }
}

function isMintRateLimited(employeeId: string, maxMints = 6, windowMs = 300_000): boolean {
  const now = Date.now();
  evictExpired(now);

  const entry = tokenMintRateLimit.get(employeeId);

  if (!entry || now > entry.resetAt) {
    tokenMintRateLimit.set(employeeId, { count: 1, resetAt: now + windowMs });
    return false;
  }

  entry.count += 1;
  return entry.count > maxMints;
}

export async function GET(req: Request) {
  try {
    assertServerEnv();
    if (!config.deepgram.apiKey) {
      return NextResponse.json({ error: "Deepgram API key not configured" }, { status: 500 });
    }

    // Authenticate: Must be valid active employee token OR admin
    const url = new URL(req.url);
    const token = url.searchParams.get("token") || req.headers.get("x-access-token");
    const isAuthorizedAdmin = isAdmin(req);

    if (!isAuthorizedAdmin) {
      if (!token) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      }

      const db = getServiceClient();
      const { data: employee } = await db
        .from("employees")
        .select("id, status")
        .eq("access_token", token)
        .maybeSingle();

      if (!employee || employee.status === "completed") {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      }

      // Rate limit authenticated employee.id
      if (isMintRateLimited(employee.id)) {
        return NextResponse.json(
          { error: "Too many voice sessions — please wait a few minutes." },
          { status: 429 }
        );
      }
    }

    // Try minting a short-lived key; fall back to configured API key if key lacks admin scope.
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      let projectId = "";
      try {
        const projRes = await fetch("https://api.deepgram.com/v1/projects", {
          headers: { Authorization: `Token ${config.deepgram.apiKey}` },
          signal: controller.signal,
        });
        if (projRes.ok) {
          const projData = await projRes.json();
          projectId = projData.projects?.[0]?.project_id || "";
        }
      } finally {
        clearTimeout(timeout);
      }

      if (projectId) {
        const keyController = new AbortController();
        const keyTimeout = setTimeout(() => keyController.abort(), 10000);

        try {
          const keyRes = await fetch(`https://api.deepgram.com/v1/projects/${projectId}/keys`, {
            method: "POST",
            headers: {
              Authorization: `Token ${config.deepgram.apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              comment: "Short-lived client key",
              scopes: ["usage:write"],
              time_to_live_in_seconds: 120,
            }),
            signal: keyController.signal,
          });
          if (keyRes.ok) {
            const keyData = await keyRes.json();
            const memberKey = (keyData.member_key as { key?: string })?.key;
            const finalKey = memberKey || keyData.key;
            if (finalKey) return NextResponse.json({ key: finalKey });
          }
        } finally {
          clearTimeout(keyTimeout);
        }
      }
    } catch {
      // Ignore key minting errors and fall back to returning configured key
    }

    // Fallback: return configured Deepgram key directly
    return NextResponse.json({ key: config.deepgram.apiKey });
  } catch (err) {
    console.error("Failed to process Deepgram key route:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not initialize voice session" },
      { status: 500 }
    );
  }
}
