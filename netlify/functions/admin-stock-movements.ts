import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { withAdminAuth } from "./_lib/with-admin-auth";

const s = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const baseHandler: Handler = async (e) => {
  try {
    const limit = Number(e.queryStringParameters?.limit || 100);
    const filter = e.queryStringParameters?.filter || 'all'; // 'all', 'manual', 'order'
    
    // 1. Select stock movements AND the archived status of the related order
    let query = s
      .from("stock_movements")
      .select(`
        id,
        product_id,
        order_id,
        delta,
        reason,
        product_name,
        variant_index,
        movement_type,
        notes,
        created_at,
        product:products(id, name, slug),
        orders(archived)
      `)
      .order("created_at", { ascending: false })
      .limit(limit + 50); // Fetch extra to account for filtering

    // Apply type filters
    if (filter === 'manual') {
      query = query.eq('movement_type', 'manual');
    } else if (filter === 'order') {
      query = query.eq('movement_type', 'order_fulfillment');
    }

    const { data, error } = await query;
    
    if (error) {
      console.error('Stock movements query error:', error);
      return { statusCode: 500, body: JSON.stringify({ ok: false, error: error.message }) };
    }

    // 2. Filter out movements belonging to ARCHIVED orders
    // We keep the row if:
    // - It's NOT an order movement (e.g. manual adjustment)
    // - OR if the associated order is NOT archived
    const filteredData = (data || []).filter((row: any) => {
      if (row.orders && row.orders.archived === true) {
        return false; // Hide this movement
      }
      return true; // Show everything else
    });
    
    // Trim back to requested limit
    const finalData = filteredData.slice(0, limit);
    
    return { 
      statusCode: 200, 
      body: JSON.stringify({ 
        ok: true, 
        data: finalData,
        filter,
        count: finalData.length
      }) 
    };
  } catch (err: any) {
    console.error('Stock movements handler error:', err);
    return { statusCode: 500, body: err.message || "admin-stock-movements failed" };
  }
};

export const handler = withAdminAuth(baseHandler);
