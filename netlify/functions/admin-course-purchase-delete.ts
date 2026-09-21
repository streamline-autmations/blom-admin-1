import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { withAdminAuth } from "./_lib/with-admin-auth";

const s = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const baseHandler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    const { id } = JSON.parse(event.body || "{}");
    if (!id) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: "Missing id" }) };
    }

    const { data: purchase, error: readError } = await s
      .from("course_purchases")
      .select("id,order_id")
      .eq("id", id)
      .single();

    if (readError) {
      return { statusCode: 500, body: JSON.stringify({ ok: false, error: readError.message }) };
    }

    const orderId = purchase?.order_id || null;

    const { data: deleted, error: deleteError } = await s
      .from("course_purchases")
      .delete()
      .eq("id", id)
      .select()
      .maybeSingle();

    if (deleteError) {
      return { statusCode: 500, body: JSON.stringify({ ok: false, error: deleteError.message }) };
    }

    if (orderId) {
      await s.from("orders").update({ order_kind: "product" }).eq("id", orderId);
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true, item: deleted || null, order_id: orderId }) };
  } catch (err: any) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: err?.message || String(err) }) };
  }
};


export const handler = withAdminAuth(baseHandler);
