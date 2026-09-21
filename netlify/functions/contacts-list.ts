// netlify/functions/contacts-list.ts
// Fetch all contacts for the admin panel
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { withAdminAuth } from "./_lib/with-admin-auth";

const s = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const baseHandler: Handler = async (e) => {
  if (e.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const url = new URL(e.rawUrl);
  const source = url.searchParams.get("source"); // beauty_club_signup/account_creation/manual/order or null for all
  const subscribed = url.searchParams.get("subscribed"); // true/false or null for all

  let q = s.from("contacts").select("*").order("created_at", { ascending: false });

  if (source) q = q.eq("source", source);
  if (subscribed === "true") q = q.eq("subscribed", true);
  if (subscribed === "false") q = q.eq("subscribed", false);

  const { data, error } = await q;

  if (error) return { statusCode: 500, body: error.message };

  return { statusCode: 200, body: JSON.stringify({ data }) };
};

export const handler = withAdminAuth(baseHandler);
