import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { withAdminAuth } from "./_lib/with-admin-auth";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const baseHandler: Handler = async (event) => {
  try {
    if (event.httpMethod !== "GET") return { statusCode: 405, body: "Method Not Allowed" };
    const id = event.queryStringParameters?.id;
    if (!id) return { statusCode: 400, body: "Missing id" };

    const { data: bundle, error: bErr } = await supabase
      .from("bundles")
      .select("id, name, slug, price, active, created_at, updated_at")
      .eq("id", id)
      .single();
    if (bErr) throw bErr;

    const { data: items, error: iErr } = await supabase
      .from("bundle_items")
      .select("id, product_id, quantity, product:products(id, name, price, sku)")
      .eq("bundle_id", id);
    if (iErr) throw iErr;

    return { statusCode: 200, body: JSON.stringify({ bundle, items }) };
  } catch (e: any) {
    return { statusCode: 500, body: e.message || "Error" };
  }
};


export const handler = withAdminAuth(baseHandler);
