import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { withAdminAuth } from "./_lib/with-admin-auth";

const headers = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };

const baseHandler: Handler = async (event) => {
  try {
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 200, headers, body: "" };
    }
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, headers, body: JSON.stringify({ ok: false, error: "Method Not Allowed" }) };
    }
    if (!event.body) {
      return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: "Empty body" }) };
    }

    let body: any;
    try {
      body = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
    } catch (e) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ ok: false, error: "Invalid JSON: " + (e instanceof Error ? e.message : String(e)) }),
      };
    }

    const slug = String(body.slug || "").trim();
    const filename = String(body.filename || "").trim();
    const contentType = String(body.contentType || "application/octet-stream").trim();
    const base64 = String(body.base64 || "").trim();

    if (!slug) return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: "Slug is required" }) };
    if (!filename) return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: "Filename is required" }) };
    if (!base64) return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: "File data is required" }) };

    const supabaseUrl = process.env.SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!supabaseUrl || !serviceKey) {
      return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: "Server not configured" }) };
    }

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `${slug}/${Date.now()}-${safeName}`;
    const bytes = Buffer.from(base64, "base64");

    const { error: uploadError } = await admin.storage.from("course-images").upload(path, bytes, {
      upsert: true,
      contentType,
    });
    if (uploadError) {
      return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: uploadError.message }) };
    }

    const { data } = admin.storage.from("course-images").getPublicUrl(path);
    const publicUrl = data?.publicUrl || "";
    if (!publicUrl) {
      return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: "Failed to generate public URL" }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, publicUrl, path }) };
  } catch (err: any) {
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: err?.message || "Upload failed" }) };
  }
};


export const handler = withAdminAuth(baseHandler);
