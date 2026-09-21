import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { withAdminAuth } from "./_lib/with-admin-auth";

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const s = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

const baseHandler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ ok: false, error: "Method Not Allowed" }) };
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: "Missing Supabase env vars" }) };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const order_id = String(body.order_id || "").trim();
    if (!order_id) {
      return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: "Missing order_id" }) };
    }

    const { data: order, error: oErr } = await s
      .from("orders")
      .select("id, order_number, buyer_name, buyer_email, contact_phone, customer_name, customer_email, customer_phone, status, payment_status")
      .eq("id", order_id)
      .maybeSingle();

    if (oErr) throw oErr;
    if (!order) {
      return { statusCode: 404, headers, body: JSON.stringify({ ok: false, error: "Order not found" }) };
    }

    const payload = {
      order_id: order.id,
      order_number: order.order_number,
      customer_name: order.buyer_name || order.customer_name || null,
      customer_email: order.buyer_email || order.customer_email || null,
      customer_phone: order.contact_phone || order.customer_phone || null,
      payment_status:
        String(order.payment_status || order.status || "").toLowerCase() === "paid" ||
        String(order.status || "").toLowerCase() === "paid"
          ? "PAID"
          : String(order.payment_status || order.status || "").toUpperCase(),
    };

    const targetWebhookUrl = "https://dockerfile-1n82.onrender.com/webhook/notify-order";

    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 20000);
    let webhookStatus = 0;
    let webhookResponseText = "";
    try {
      const webhookRes = await fetch(targetWebhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "BLOM-Admin/1.0",
        },
        body: JSON.stringify(payload),
        signal: ac.signal,
      });
      webhookStatus = webhookRes.status;
      webhookResponseText = await webhookRes.text().catch(() => "");
    } finally {
      clearTimeout(t);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        payload,
        webhook_status: webhookStatus,
        webhook_response: webhookResponseText,
      }),
    };
  } catch (err: any) {
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: err?.message || String(err) }) };
  }
};


export const handler = withAdminAuth(baseHandler);
