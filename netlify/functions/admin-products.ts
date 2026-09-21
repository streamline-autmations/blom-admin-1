import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { withAdminAuth } from "./_lib/with-admin-auth";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Helper function to determine stock type based on category
const getStockType = (product: any) => {
  // Auto-detect based on category
  const category = (product.category || '').toLowerCase();
  if (category.includes('course') || category.includes('workshop') || category.includes('training')) {
    return 'unlimited';
  }
  if (category.includes('furniture')) {
    return 'made_on_demand';
  }
  return 'tracked';
};

const baseHandler: Handler = async (event) => {
  try {
    if (event.httpMethod !== "GET") return { statusCode: 405, body: "Method Not Allowed" };

    const page = Number(event.queryStringParameters?.page ?? 1);
    const pageSize = Number(event.queryStringParameters?.pageSize ?? 20);
    const q = (event.queryStringParameters?.q || "").trim();
    const active = event.queryStringParameters?.active;

    let query = supabase
      .from("products")
      .select("id, name, slug, sku, price, stock, category, status, is_active, cost_price_cents, created_at, updated_at")
      .order("created_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (q) query = query.ilike("name", `%${q}%`);
    
    // Default to showing only active products unless explicitly requested otherwise
    // Support both filtering methods for compatibility
    if (active === "false") {
      query = query.eq("is_active", false);
    } else if (active === "archived") {
      // Show archived products (status = 'archived' OR is_active = false)
      query = query.or('status.eq.archived,is_active.eq.false');
    } else {
      // Default: show only active products (is_active = true AND status != 'archived')
      query = query.eq("is_active", true).neq("status", "archived");
    }

    const { data, error } = await query;
    if (error) throw error;

    // Transform data to match frontend expectations
    const transformedData = data.map(product => ({
      ...product,
      // Map database fields to frontend expected fields
      price_cents: Math.round((product.price || 0) * 100),
      compare_at_price_cents: null, // Not available in current schema
      stock_qty: product.stock || 0,
      stock_type: getStockType(product),
      status: product.status === 'archived' ? 'archived' : (product.is_active ? 'active' : 'inactive'),
      active: product.is_active && product.status !== 'archived'
    }));

    return { statusCode: 200, body: JSON.stringify({ data: transformedData }) };
  } catch (e: any) {
    return { statusCode: 500, body: e.message || "Error" };
  }
};

export const handler = withAdminAuth(baseHandler);
