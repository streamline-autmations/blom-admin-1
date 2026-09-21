import type { Handler, HandlerContext, HandlerEvent, HandlerResponse } from "@netlify/functions";
import { adminCorsHeaders, requireAdminUser } from "./require-admin-user";

/**
 * Wraps a function handler so it can only run for a signed-in owner or staff user.
 *
 * These functions talk to Supabase with the service-role key, which bypasses row
 * level security, so an unauthenticated caller could read or change anything.
 * Wrap every admin-only function; leave genuinely public endpoints (payment
 * callbacks, intake webhooks) alone.
 */
export const withAdminAuth =
  (handler: Handler): Handler =>
  async (event: HandlerEvent, context: HandlerContext): Promise<HandlerResponse> => {
    // Preflight carries no Authorization header, so answer it before the check.
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 204, headers: adminCorsHeaders, body: "" };
    }

    const auth = await requireAdminUser(event);
    if (!auth.ok) return auth.response;

    return (await handler(event, context)) as HandlerResponse;
  };
