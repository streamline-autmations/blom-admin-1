import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { withAdminAuth } from "./_lib/with-admin-auth";

const s = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false }
});

const baseHandler: Handler = async () => {
  try {
    // Try view first (v_sales_daily); if missing, fall back to quick aggregates
    let rows: any[] = [];
    const { data, error } = await s.from("v_sales_daily" as any).select("*").order("day", { ascending: false }).limit(14);
    if (!error && Array.isArray(data)) {
      rows = data as any[];
    } else {
      // Fallback: compute today from orders table
      const today = new Date();
      today.setHours(0,0,0,0);
      const fromIso = today.toISOString();
      const { data: orders, error: oErr } = await s
        .from("orders")
        .select("created_at,total_cents,status,payment_status")
        .gte("created_at", fromIso)
        .in("payment_status", ["paid"]); // Only count paid orders
      if (oErr) throw oErr;
      const revenue = (orders || []).reduce((sum, o:any) => sum + Number(o.total_cents || 0) / 100, 0);
      rows = [{ day: fromIso, revenue, orders: (orders||[]).length }];
    }
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ ok: true, data: rows })
    };
  } catch (err:any) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ ok: false, error: err?.message || String(err) })
    };
  }
};



export const handler = withAdminAuth(baseHandler);
