import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
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

const toNumberLoose = (value: any) => {
  if (value === undefined || value === null) return Number.NaN;
  if (typeof value === "number") return value;
  if (typeof value !== "string") return Number.NaN;
  const cleaned = value.replace(/,/g, "").replace(/[^\d.-]/g, "").trim();
  if (!cleaned) return Number.NaN;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : Number.NaN;
};

const asCents = (value: any) => {
  if (value === undefined || value === null || value === "") return null;
  const n = typeof value === "string" ? toNumberLoose(value) : Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n);
};

const asRandsToCents = (value: any) => {
  if (value === undefined || value === null || value === "") return null;
  const n = typeof value === "string" ? toNumberLoose(value) : Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
};

const normalizeRef = (ref: string) => ref.trim();

const buildOrderNumber = (ref: string) => {
  const clean = normalizeRef(ref);
  if (/^(BL|ORD)-/i.test(clean)) return clean;
  const token = clean.replace(/[^A-Za-z0-9]/g, "").slice(-10).toUpperCase();
  return `BL-${token || randomUUID().replace(/-/g, "").slice(-10).toUpperCase()}`;
};

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

    const payment_id = String(body.payment_id || body.reference || body.paymentId || "").trim();
    if (!payment_id) {
      return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: "Missing payment_id" }) };
    }

    const buyer_name = String(body.buyer_name || body.customer_name || body.sender_name || "").trim() || null;
    const buyer_email = String(body.buyer_email || body.customer_email || body.sender_email || "").trim() || null;
    const buyer_phone = String(body.buyer_phone || body.customer_phone || "").trim() || null;

    const amountCents =
      asCents(body.amount_cents) ??
      asCents(body.total_cents) ??
      asRandsToCents(body.amount_zar) ??
      asRandsToCents(body.amount) ??
      asRandsToCents(body.total) ??
      null;

    if (amountCents == null || amountCents <= 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: "Missing or invalid amount" }) };
    }

    const order_number = String(body.order_number || "").trim() || buildOrderNumber(payment_id);
    const m_payment_id = String(body.m_payment_id || payment_id).trim();
    const nowIso = new Date().toISOString();

    let existingOrder: any = null;
    for (const [col, val] of [
      ["m_payment_id", m_payment_id],
      ["order_number", order_number],
      ["merchant_payment_id", m_payment_id],
    ] as const) {
      const { data } = await s.from("orders").select("*").eq(col, val).maybeSingle();
      if (data) {
        existingOrder = data;
        break;
      }
    }

    const orderInsertBase: any = {
      order_number,
      m_payment_id,
      merchant_payment_id: m_payment_id,
      buyer_name,
      buyer_email,
      contact_phone: buyer_phone,
      customer_name: buyer_name,
      customer_email: buyer_email,
      customer_phone: buyer_phone,
      subtotal_cents: amountCents,
      shipping_cents: 0,
      discount_cents: 0,
      tax_cents: 0,
      total_cents: amountCents,
      total: Math.round(amountCents) / 100,
      currency: String(body.currency || "ZAR"),
      status: "paid",
      payment_status: "paid",
      fulfillment_status: "pending",
      placed_at: body.placed_at || nowIso,
      paid_at: body.paid_at || nowIso,
      updated_at: nowIso,
    };

    let orderRow: any = null;
    let created = false;

    if (existingOrder) {
      const updatePayload: any = {
        updated_at: nowIso,
      };

      if (!existingOrder.status || existingOrder.status !== "paid") updatePayload.status = "paid";
      if (!existingOrder.payment_status || existingOrder.payment_status !== "paid") updatePayload.payment_status = "paid";
      if (!existingOrder.paid_at) updatePayload.paid_at = orderInsertBase.paid_at;
      if (!existingOrder.placed_at) updatePayload.placed_at = orderInsertBase.placed_at;

      if (!existingOrder.buyer_name && buyer_name) updatePayload.buyer_name = buyer_name;
      if (!existingOrder.buyer_email && buyer_email) updatePayload.buyer_email = buyer_email;
      if (!existingOrder.contact_phone && buyer_phone) updatePayload.contact_phone = buyer_phone;
      if (!existingOrder.customer_name && buyer_name) updatePayload.customer_name = buyer_name;
      if (!existingOrder.customer_email && buyer_email) updatePayload.customer_email = buyer_email;
      if (!existingOrder.customer_phone && buyer_phone) updatePayload.customer_phone = buyer_phone;

      if (existingOrder.total_cents == null || Number(existingOrder.total_cents) <= 0) {
        updatePayload.subtotal_cents = amountCents;
        updatePayload.total_cents = amountCents;
        updatePayload.total = Math.round(amountCents) / 100;
      }

      let updateRes = await s
        .from("orders")
        .update({ ...updatePayload, order_kind: "product" })
        .eq("id", existingOrder.id)
        .select()
        .single();

      if (updateRes.error && /order_kind/i.test(updateRes.error.message || "")) {
        updateRes = await s.from("orders").update(updatePayload).eq("id", existingOrder.id).select().single();
      }

      if (updateRes.error) throw updateRes.error;
      orderRow = updateRes.data;
    } else {
      let insertRes = await s
        .from("orders")
        .insert({ ...orderInsertBase, order_kind: "product" })
        .select()
        .single();

      if (insertRes.error && /order_kind/i.test(insertRes.error.message || "")) {
        insertRes = await s.from("orders").insert(orderInsertBase).select().single();
      }

      if (insertRes.error) throw insertRes.error;
      orderRow = insertRes.data;
      created = true;
    }

    const items = Array.isArray(body.items) ? body.items : null;
    if (created) {
      const itemRows =
        items && items.length
          ? items.map((it: any) => {
              const qty = Number(it.qty ?? it.quantity ?? 1) || 1;
              const unit = asCents(it.unit_price_cents) ?? asRandsToCents(it.unit_price) ?? Math.round(amountCents / qty);
              return {
                order_id: orderRow.id,
                product_id: it.product_id ?? null,
                sku: it.sku ?? null,
                name: String(it.name || it.product_name || body.item_name || `BLOM Order ${order_number}`),
                variant: it.variant ?? null,
                quantity: qty,
                unit_price_cents: unit,
                line_total_cents: unit * qty,
                variant_index: it.variant_index !== undefined ? it.variant_index : null,
              };
            })
          : [
              {
                order_id: orderRow.id,
                product_id: null,
                sku: null,
                name: String(body.item_name || `BLOM Order ${order_number}`),
                variant: null,
                quantity: 1,
                unit_price_cents: amountCents,
                line_total_cents: amountCents,
                variant_index: null,
              },
            ];

      const { error: itemsErr } = await s.from("order_items").insert(itemRows);
      if (itemsErr) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ ok: true, order_id: orderRow.id, created, warning: `Order items insert failed: ${itemsErr.message}` }),
        };
      }
    }

    try {
      const { error: payErr } = await s.from("payments").insert({
        order_id: orderRow.id,
        provider: String(body.provider || "manual"),
        amount_cents: amountCents,
        status: "succeeded",
        raw: body,
        provider_txn_id: payment_id,
        method: body.method || null,
        amount: Math.round(amountCents) / 100,
        paid_at: orderInsertBase.paid_at,
      });
      if (payErr && payErr.code !== "23505") {
        console.error("Payment insert failed:", payErr);
      }
    } catch (e) {
      console.error("Payment insert failed:", e);
    }

    let invoice_url: string | null = orderRow.invoice_url || null;
    if (!invoice_url) {
      try {
        const base =
          process.env.URL ||
          process.env.SITE_URL ||
          process.env.PUBLIC_SITE_URL ||
          "https://blom-cosmetics.co.za";
        const fnUrl = `${base.replace(/\/$/, "")}/.netlify/functions/invoice-pdf?return_url=1`;

        const ac = new AbortController();
        const t = setTimeout(() => ac.abort(), 20000);
        try {
          const invRes = await fetch(fnUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ m_payment_id, order_id: orderRow.id, return_url: true }),
            signal: ac.signal,
          });
          if (invRes.ok) {
            const data = await invRes.json().catch(() => null);
            invoice_url = data?.invoice_url || null;
          }
        } finally {
          clearTimeout(t);
        }
      } catch (e) {
        console.error("Invoice generation failed:", e);
      }
    }

    const shouldNotify = body.trigger_notify !== false;
    if (shouldNotify) {
      try {
        const notifyPayload = {
          order_id: orderRow.id,
          order_number: orderRow.order_number,
          customer_name: orderRow.buyer_name || orderRow.customer_name || null,
          customer_email: orderRow.buyer_email || orderRow.customer_email || null,
          customer_phone: orderRow.contact_phone || orderRow.customer_phone || null,
          payment_status: "PAID",
          invoice_url: invoice_url,
        };

        const ac = new AbortController();
        const t = setTimeout(() => ac.abort(), 20000);
        try {
          await fetch("https://dockerfile-1n82.onrender.com/webhook/notify-order", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "User-Agent": "BLOM-Admin/1.0",
            },
            body: JSON.stringify(notifyPayload),
            signal: ac.signal,
          });
        } finally {
          clearTimeout(t);
        }
      } catch (e) {
        console.error("Notify-order webhook failed:", e);
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, order_id: orderRow.id, created, invoice_url }),
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ ok: false, error: err?.message || String(err) }),
    };
  }
};

export const handler = withAdminAuth(baseHandler);
