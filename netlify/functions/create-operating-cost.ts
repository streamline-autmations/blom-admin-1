// netlify/functions/create-operating-cost.ts
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { withAdminAuth } from "./_lib/with-admin-auth";

const s = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const baseHandler: Handler = async (e) => {
  if (e.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  const b = JSON.parse(e.body || "{}");

  if (!b.category || !b.amount) return { statusCode: 400, body: "category & amount required" };

  const { error } = await s.from("operating_costs").insert({
    occurred_on: b.occurred_on || new Date().toISOString().slice(0,10),
    category: String(b.category),
    description: b.description || null,
    amount: Number(b.amount)
  });

  if (error) return { statusCode: 500, body: error.message };

  return { statusCode: 200, body: JSON.stringify({ ok:true }) };
};




export const handler = withAdminAuth(baseHandler);
