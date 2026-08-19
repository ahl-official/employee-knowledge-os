import { config } from "@/lib/config";
import crypto from "crypto";

// In-memory sliding-window rate limiter for admin attempts with automatic cleanup
const attemptsMap = new Map<string, { count: number; resetAt: number }>();

function cleanupExpiredEntries(now: number) {
  if (attemptsMap.size > 200) {
    for (const [key, val] of attemptsMap.entries()) {
      if (now > val.resetAt) {
        attemptsMap.delete(key);
      }
    }
  }
}

function isRateLimited(identifier: string, maxAttempts = 10, windowMs = 60_000): boolean {
  const now = Date.now();
  cleanupExpiredEntries(now);

  const entry = attemptsMap.get(identifier);

  if (!entry || now > entry.resetAt) {
    attemptsMap.set(identifier, { count: 1, resetAt: now + windowMs });
    return false;
  }

  entry.count += 1;
  return entry.count > maxAttempts;
}

/** Returns true if the request carries the correct admin passphrase, using constant-time comparison and rate limiting. */
export function isAdmin(req: Request): boolean {
  const expected = config.admin.passphrase;
  if (!expected || expected.length === 0) return false;

  // Use x-real-ip or right-most x-forwarded-for to prevent spoofed left-most header
  const forwarded = req.headers.get("x-forwarded-for");
  const clientIp = req.headers.get("x-real-ip") || (forwarded ? forwarded.split(",").pop()?.trim() : "local") || "local";

  if (isRateLimited(clientIp)) {
    return false;
  }

  const provided = req.headers.get("x-admin-passphrase") ?? "";
  if (provided.length === 0) return false;

  // Constant-time comparison using sha256 hashes to normalize length
  const expectedHash = crypto.createHash("sha256").update(expected).digest();
  const providedHash = crypto.createHash("sha256").update(provided).digest();

  const isMatch = crypto.timingSafeEqual(expectedHash, providedHash);
  if (isMatch) {
    attemptsMap.delete(clientIp);
  }
  return isMatch;
}
