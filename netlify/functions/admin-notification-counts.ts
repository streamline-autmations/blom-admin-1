import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { withAdminAuth } from "./_lib/with-admin-auth";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
};

const baseHandler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS };
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      statusCode: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({ ok: false, error: "Missing SUPABASE environment variables" }),
    };
  }

  const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  try {
    const qp = event.queryStringParameters || {};

    const lastOrders = qp.last_orders || "1970-01-01T00:00:00.000Z";
    const lastBookings = qp.last_course_bookings || "1970-01-01T00:00:00.000Z";
    const lastMessages = qp.last_messages || "1970-01-01T00:00:00.000Z";
    const lastReviews = qp.last_reviews || "1970-01-01T00:00:00.000Z";

    const [ordersRes, bookingsRes, messagesRes, reviewsRes] = await Promise.all([
      s.from("orders").select("id", { count: "exact", head: true }).gt("placed_at", lastOrders),
      s
        .from("course_purchases")
        .select("id", { count: "exact", head: true })
        .gt("created_at", lastBookings),
      s
        .from("contact_messages")
        .select("id", { count: "exact", head: true })
        .eq("status", "new")
        .gt("created_at", lastMessages),
      s
        .from("product_reviews")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending")
        .gt("created_at", lastReviews),
    ]);

    const errors = [ordersRes.error, bookingsRes.error, messagesRes.error, reviewsRes.error].filter(Boolean);
    if (errors.length > 0) {
      return {
        statusCode: 500,
        headers: { ...CORS, "Content-Type": "application/json" },
        body: JSON.stringify({ ok: false, error: (errors[0] as any).message || "Failed to fetch counts" }),
      };
    }

    return {
      statusCode: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: true,
        counts: {
          orders: ordersRes.count || 0,
          course_bookings: bookingsRes.count || 0,
          messages: messagesRes.count || 0,
          reviews: reviewsRes.count || 0,
        },
      }),
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({ ok: false, error: err?.message || String(err) }),
    };
  }
};

export const handler = withAdminAuth(baseHandler);
