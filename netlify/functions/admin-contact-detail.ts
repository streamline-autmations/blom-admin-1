import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { withAdminAuth } from "./_lib/with-admin-auth";

const s = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const baseHandler: Handler = async (e) => {
  const url = new URL(e.rawUrl);
  const user_id = url.searchParams.get("user_id");

  if (!user_id) return { statusCode: 400, body: "Missing user_id" };

  // 1. Fetch contact details
  const { data: contact, error: contactError } = await s
    .from("contacts")
    .select("*")
    .eq("user_id", user_id)
    .single();

  if (contactError) return { statusCode: 500, body: `Contact error: ${contactError.message}` };

  // 2. Fetch last 5 paid orders
  const { data: orders, error: ordersError } = await s
    .from("orders")
    .select("id, order_number, total_cents, fulfillment_method, created_at, status")
    .eq("user_id", user_id)
    .eq("payment_status", "paid")
    .order("created_at", { ascending: false })
    .limit(5);

  if (ordersError) return { statusCode: 500, body: `Orders error: ${ordersError.message}` };

  // 3. Fetch active, unused coupons
  // Assuming coupons table has 'email_locked' column to match contact's email
  // and 'active' boolean, and maybe 'used' boolean or similar logic.
  // Based on instructions: "Fetches active, unused coupons from public.coupons where email_locked matches the contact's email."
  
  let coupons = [];
  if (contact.email) {
      const { data: couponsData, error: couponsError } = await s
        .from("coupons")
        .select("code, discount_type, discount_value, expires_at")
        .eq("email_locked", contact.email)
        .eq("active", true)
        .gt("expires_at", new Date().toISOString()); // Assuming expires_at is a timestamp
      
      if (couponsError) {
          console.error("Coupons error:", couponsError);
          // We don't fail the whole request if coupons fail, just log it
      } else {
          coupons = couponsData || [];
      }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      contact,
      orders: orders || [],
      coupons: coupons || []
    })
  };
};

export const handler = withAdminAuth(baseHandler);
