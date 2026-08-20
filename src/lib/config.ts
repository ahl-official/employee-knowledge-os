/**
 * Central configuration. Reads from environment; never hard-code secrets.
 * Server-only values must not be prefixed with NEXT_PUBLIC_.
 */

export const config = {
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  },
  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY ?? "",
    model: process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash",
    baseUrl: "https://openrouter.ai/api/v1/chat/completions",
    // Low temperature for deterministic, grounded interviewing.
    temperature: 0.2,
    maxTokens: 1200,
  },
  deepgram: {
    apiKey: process.env.DEEPGRAM_API_KEY ?? "",
  },
  admin: {
    passphrase: process.env.ADMIN_PASSPHRASE ?? "",
  },
  app: {
    baseUrl:
      process.env.NEXT_PUBLIC_BASE_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"),
  },
} as const;

export function assertServerEnv(): void {
  const missing: string[] = [];
  if (!config.supabase.url) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!config.supabase.serviceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!config.openrouter.apiKey) missing.push("OPENROUTER_API_KEY");
  if (missing.length) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}. ` +
        `Copy .env.local.example to .env.local and fill them in.`
    );
  }
}
