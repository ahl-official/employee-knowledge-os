import { randomBytes } from "crypto";

/** Unguessable URL-safe access token for an employee interview link. */
export function generateAccessToken(): string {
  return randomBytes(24).toString("base64url");
}
