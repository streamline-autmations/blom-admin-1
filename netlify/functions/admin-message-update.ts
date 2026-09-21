// netlify/functions/admin-message-update.ts
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { withAdminAuth } from "./_lib/with-admin-auth";

const s = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const baseHandler: Handler = async (e) => {
  if (e.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS, body: "ok" };
  }

  if (e.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({ ok: false, error: "Method Not Allowed" })
    };
  }

  try {
    const payload = JSON.parse(e.body || "{}");
    const { id, status } = payload;

    console.log("Update request:", { id, status });

    if (!id) {
      return {
        statusCode: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
        body: JSON.stringify({ ok: false, error: "Missing id" })
      };
    }

    if (!status || !["new", "handled"].includes(status)) {
      return {
        statusCode: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
        body: JSON.stringify({ ok: false, error: "Invalid status. Must be 'new' or 'handled'" })
      };
    }

    const { data, error } = await s
      .from("contact_messages")
      .update({ status })
      .eq("id", id)
      .select();

    console.log("Update result:", { data, error });

    if (error) {
      console.error("Supabase error:", error);
      return {
        statusCode: 500,
        headers: { ...CORS, "Content-Type": "application/json" },
        body: JSON.stringify({ ok: false, error: error.message, details: error })
      };
    }

    return {
      statusCode: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, data })
    };
  } catch (err: any) {
    console.error("Unexpected error:", err);
    return {
      statusCode: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({ ok: false, error: err.message || String(err), stack: err.stack })
    };
  }
};

export const handler = withAdminAuth(baseHandler);
