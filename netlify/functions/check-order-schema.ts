import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { withAdminAuth } from "./_lib/with-admin-auth";

const s = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const baseHandler: Handler = async (e) => {
  try {
    const orderId = new URL(e.rawUrl).searchParams.get("order_id");
    
    if (!orderId) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ ok: false, error: "Missing order_id parameter" }) 
      };
    }

    // Get order with all status fields
    const { data: order, error: oErr } = await s.from("orders")
      .select(`
        id,
        order_number,
        status,
        shipping_status,
        fulfillment_type,
        payment_status,
        created_at,
        updated_at
      `)
      .eq("id", orderId)
      .single();

    if (oErr) throw oErr;

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ 
        ok: true, 
        order,
        status_fields: {
          main_status: order?.status,
          shipping_status: order?.shipping_status,
          payment_status: order?.payment_status
        }
      })
    };
  } catch (err:any) {
    console.error('❌ Schema check error:', err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ ok: false, error: err.message || String(err) })
    };
  }
};

export const handler = withAdminAuth(baseHandler);
