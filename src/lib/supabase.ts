import { createClient } from "@supabase/supabase-js";
import { config } from "@/lib/config";

/**
 * Server-side Supabase client using the service-role key.
 * Bypasses RLS — use ONLY in server code (API routes / server components).
 * Never import this into client components.
 */
export function getServiceClient() {
  return createClient(config.supabase.url, config.supabase.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
