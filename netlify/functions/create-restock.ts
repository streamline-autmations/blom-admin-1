// netlify/functions/create-restock.ts
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { withAdminAuth } from "./_lib/with-admin-auth";

const s = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const baseHandler: Handler = async (e) => {
  if (e.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  const b = JSON.parse(e.body || "{}");

  const items = Array.isArray(b.items) ? b.items : [];
  if (!items.length) return { statusCode: 400, body: "No items" };

  const subtotal = items.reduce((t:any,x:any)=> t + Number(x.quantity||0)*Number(x.unit_cost||0), 0);

  const { data: restock, error } = await s.from("restocks")
    .insert({ supplier: b.supplier||null, reference: b.reference||null, status: b.status || 'received', subtotal, notes: b.notes||null })
    .select("id,status")
    .single();

  if (error) return { statusCode: 500, body: error.message };

  const rows = items.map((x:any)=>({ restock_id: restock.id, product_id: x.product_id, quantity: Number(x.quantity), unit_cost: Number(x.unit_cost) }));

  const { error: e2 } = await s.from("restock_items").insert(rows);

  if (e2) return { statusCode: 500, body: e2.message };

  // If status already 'received', movements trigger will fire automatically.

  return { statusCode: 200, body: JSON.stringify({ ok:true, restock_id: restock.id, subtotal }) };
};




export const handler = withAdminAuth(baseHandler);
