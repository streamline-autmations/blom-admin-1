// netlify/functions/contacts-add.ts
// Add a new contact (for admin panel manual entry)
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { withAdminAuth } from "./_lib/with-admin-auth";

const s = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const baseHandler: Handler = async (e) => {
  if (e.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const payload = JSON.parse(e.body || "{}");

    const email = String(payload.email || "").trim().toLowerCase();
    if (!email) {
      return { statusCode: 400, body: "Email is required" };
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { statusCode: 400, body: "Invalid email format" };
    }

    const row = {
      name: payload.name ? String(payload.name).trim() : null,
      email,
      phone: payload.phone ? String(payload.phone).trim() : null,
      source: payload.source || "manual",
      notes: payload.notes ? String(payload.notes).trim() : null,
      subscribed: payload.subscribed !== false, // default to true
    };

    // Use upsert to handle duplicates gracefully
    const { data, error } = await s.rpc("upsert_contact", {
      p_name: row.name,
      p_email: row.email,
      p_phone: row.phone,
      p_source: row.source,
      p_notes: row.notes,
    });

    if (error) {
      return { statusCode: 500, body: `DB insert failed: ${error.message}` };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, id: data }),
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      body: `contacts-add exception: ${err?.message || "unknown"}`,
    };
  }
};

export const handler = withAdminAuth(baseHandler);
