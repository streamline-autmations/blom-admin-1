import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { adminCorsHeaders, requireAdminUser } from "./_lib/require-admin-user";
import { withAdminAuth } from "./_lib/with-admin-auth";

const s = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const baseHandler: Handler = async (e) => {
  if (e.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: adminCorsHeaders, body: "" };
  }

  if (e.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: adminCorsHeaders,
      body: JSON.stringify({ ok: false, error: "Method not allowed" }),
    };
  }

  const auth = await requireAdminUser(e);
  if (!auth.ok) return auth.response;

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      statusCode: 500,
      headers: adminCorsHeaders,
      body: JSON.stringify({ ok: false, error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }),
    };
  }

  try {
    const url = new URL(e.rawUrl);
    const id = url.searchParams.get("id") || url.searchParams.get("purchase_id");

    if (!id) {
      return {
        statusCode: 400,
        headers: adminCorsHeaders,
        body: JSON.stringify({ ok: false, error: "Missing id" }),
      };
    }

    const selectWithBalance = `
      *,
      deposit_order:order_id (
        id,
        order_number,
        status,
        payment_status,
        total_cents,
        created_at,
        placed_at,
        paid_at,
        invoice_url
      ),
      balance_order:balance_order_id (
        id,
        order_number,
        status,
        payment_status,
        total_cents,
        created_at,
        placed_at,
        paid_at,
        invoice_url
      )
    `;

    const selectWithoutBalance = `
      *,
      deposit_order:order_id (
        id,
        order_number,
        status,
        payment_status,
        total_cents,
        created_at,
        placed_at,
        paid_at,
        invoice_url
      )
    `;

    let data: any = null;
    let error: any = null;

    const first = await s.from("course_purchases").select(selectWithBalance).eq("id", id).single();
    data = first.data;
    error = first.error;

    if (error && /balance_order_id/i.test(error.message || "")) {
      const second = await s.from("course_purchases").select(selectWithoutBalance).eq("id", id).single();
      data = second.data;
      error = second.error;
    }

    if (error) throw error;

    const { data: courseBenefit, error: benefitError } = await s
      .from("course_benefits")
      .select("id,coupon_code,status,claimed_at,redeemed_at,revoked_at,created_at")
      .eq("course_purchase_id", id)
      .maybeSingle();
    if (benefitError) {
      console.warn("Course benefit could not be loaded:", benefitError.message);
    }

    return {
      statusCode: 200,
      headers: adminCorsHeaders,
      body: JSON.stringify({
        ok: true,
        item: {
          ...data,
          booking_status: (() => {
            const orderPaid =
              (data as any)?.deposit_order?.payment_status === "paid" ||
              (data as any)?.deposit_order?.status === "paid" ||
              !!(data as any)?.deposit_order?.paid_at;

            if (!orderPaid) return (data as any)?.invitation_status || "pending";
            if ((data as any)?.course_type === "in-person")
              return (data as any)?.payment_kind === "full" ? "full_paid" : "deposit_paid";
            return "paid";
          })(),
          invoice_url: (data as any)?.deposit_order?.invoice_url || null,
          course_benefit: courseBenefit || null,
          order: (data as any)?.deposit_order || null,
          deposit_order: (data as any)?.deposit_order || null,
          balance_order: (data as any)?.balance_order || null,
        },
      }),
    };
  } catch (err: any) {
    console.error("Error in admin-course-purchase:", err);
    return {
      statusCode: 500,
      headers: adminCorsHeaders,
      body: JSON.stringify({ ok: false, error: err.message || String(err) }),
    };
  }
};

export const handler = withAdminAuth(baseHandler);
