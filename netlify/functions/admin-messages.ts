// netlify/functions/admin-messages.ts
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { withAdminAuth } from "./_lib/with-admin-auth";

const s = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const baseHandler: Handler = async (e) => {
  // Check for missing env vars
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ ok: false, error: "Missing SUPABASE environment variables" })
    };
  }

  try {
    const url = new URL(e.rawUrl);
    const page = Number(url.searchParams.get("page") || 1);
    const size = Math.min(Number(url.searchParams.get("size") || 50), 100);
    const statusFilter = url.searchParams.get("status") || ""; // new/responded/all
    const search = (url.searchParams.get("search") || "").trim();
    const from = (page - 1) * size;
    const to = from + size - 1;

    let query = s.from("contact_messages")
      .select("id,name,email,phone,subject,message,status,source,images,created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    // Filter by status
    if (statusFilter && statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    // Search by name, email, subject
    if (search) {
      query = query.or([
        `name.ilike.%${search}%`,
        `email.ilike.%${search}%`,
        `subject.ilike.%${search}%`
      ].join(","));
    }

    const { data, error, count } = await query;
    if (error) throw error;

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ ok: true, total: count || 0, data: data || [] })
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ ok: false, error: err.message || String(err) })
    };
  }
};

export const handler = withAdminAuth(baseHandler);
