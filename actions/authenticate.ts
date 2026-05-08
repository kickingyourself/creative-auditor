"use server";

/**
 * actions/authenticate.ts
 *
 * Server Action: authenticate
 * Validates the submitted password against SITE_PASSWORD env var.
 * On success, sets a 7-day httpOnly cookie and redirects to the intended destination.
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type AuthState =
  | { status: "idle" }
  | { status: "error"; message: string };

export async function authenticate(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const submitted = (formData.get("password") as string | null)?.trim() ?? "";
  const from      = (formData.get("from")     as string | null)?.trim() || "/";

  // ── 1. Basic validation ──────────────────────────────────────────────────────
  if (!submitted) {
    return { status: "error", message: "Please enter the access password." };
  }

  // ── 2. Check env vars are configured ────────────────────────────────────────
  const sitePassword = process.env.SITE_PASSWORD;
  const authToken    = process.env.SITE_AUTH_TOKEN;

  if (!sitePassword || !authToken) {
    return {
      status: "error",
      message: "Password gate is not configured on the server. Set SITE_PASSWORD and SITE_AUTH_TOKEN.",
    };
  }

  // ── 3. Validate password ────────────────────────────────────────────────────
  if (submitted !== sitePassword) {
    // Small delay to blunt brute-force timing attacks
    await new Promise((r) => setTimeout(r, 400));
    return { status: "error", message: "Incorrect password. Please try again." };
  }

  // ── 4. Set auth cookie (7 days) ─────────────────────────────────────────────
  const cookieStore = await cookies();
  cookieStore.set("site_auth", authToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    // secure: true — enable in production (requires HTTPS)
  });

  // ── 5. Redirect to intended destination ─────────────────────────────────────
  redirect(from.startsWith("/") ? from : "/");
}
