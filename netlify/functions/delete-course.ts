import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { withAdminAuth } from "./_lib/with-admin-auth";

const headers = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };

const baseHandler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ ok: false, error: "Method not allowed" }) };
  }

  const SUPABASE_URL = process.env.SUPABASE_URL!;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: "Missing Supabase service credentials" }) };
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const { id, slug } = body;

    if (!id && !slug) {
      return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: "Provide id or slug" }) };
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    const { error } = await supabase
      .from("courses")
      .delete()
      .match(id ? { id } : { slug });

    if (error) {
      return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: `DB error: ${error.message}` }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, deleted: true }) };
  } catch (err: any) {
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: err?.message || "Delete failed" }) };
  }
};


export const handler = withAdminAuth(baseHandler);
