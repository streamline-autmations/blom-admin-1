import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { withAdminAuth } from "./_lib/with-admin-auth";

const getSupabaseAdmin = () => {
  const supabaseUrl = process.env.SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
};

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*'
};

const baseHandler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: 'Method Not Allowed' };
  }

  try {
    const supabase = getSupabaseAdmin();

    // Fetch from bundles: both product_type 'collection' and 'bundle' (Bundle Deals)
    const { data: rows, error } = await supabase
      .from('bundles')
      .select('*')
      .neq('status', 'deleted')
      .order('updated_at', { ascending: false });

    if (error) throw error;

    // Add items count from bundle_products or bundle_items; ensure product_type/category for list
    const list = (rows || []).map((b: any) => {
      const items = Array.isArray(b.bundle_products)
        ? b.bundle_products.filter((x: any) => x && x.product_id).length
        : 0;
      return {
        ...b,
        items: items > 0 ? items : (b.bundle_products?.length || 0),
      };
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(list),
    };

  } catch (e: any) {
    console.error('Fetch Bundles Error:', e);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: e.message })
    };
  }
};

export const handler = withAdminAuth(baseHandler);
