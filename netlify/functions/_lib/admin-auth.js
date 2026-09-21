import { createClient } from "@supabase/supabase-js";

/**
 * Admin session checks, in plain JavaScript.
 *
 * This lives in .js (with explicit .js import paths) because Netlify bundles
 * TypeScript functions but ships the .js ones as plain ES modules, where an
 * extensionless import of a .ts file fails at runtime. Both the .ts and .js
 * functions use this single implementation.
 */

export const adminCorsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const jsonResponse = (statusCode, error) => ({
  statusCode,
  headers: adminCorsHeaders,
  body: JSON.stringify({ ok: false, error }),
});

export async function requireAdminUser(event) {
  const authorization = event.headers?.authorization || event.headers?.Authorization;
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) {
    return { ok: false, response: jsonResponse(401, "Authentication required") };
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Supabase authentication is not configured for Admin functions");
    return { ok: false, response: jsonResponse(500, "Admin authentication is not configured") };
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData?.user) {
      return { ok: false, response: jsonResponse(401, "Invalid or expired Admin session") };
    }

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("app_role")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Admin role lookup failed:", profileError.message);
      return { ok: false, response: jsonResponse(503, "Unable to validate Admin access") };
    }

    const role = String(profile?.app_role || "");
    if (!["owner", "staff"].includes(role)) {
      return { ok: false, response: jsonResponse(403, "Admin access required") };
    }

    return { ok: true, userId: authData.user.id, role };
  } catch (error) {
    console.error(
      "Admin session validation failed:",
      error instanceof Error ? error.message : String(error),
    );
    return { ok: false, response: jsonResponse(503, "Unable to validate Admin session") };
  }
}

/**
 * Wraps a handler so it only runs for a signed-in owner or staff user.
 * These functions use the service-role key, which bypasses row level security.
 */
export const withAdminAuth = (handler) => async (event, context) => {
  // Preflight carries no Authorization header, so answer it before the check.
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: adminCorsHeaders, body: "" };
  }

  const auth = await requireAdminUser(event);
  if (!auth.ok) return auth.response;

  return handler(event, context);
};
