import { createClient } from "@supabase/supabase-js";
import { withAdminAuth } from "./_lib/admin-auth.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const baseHandler = async (event) => {
  try {
    const url = new URL(event.rawUrl || 'http://localhost');
    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');

    let dateFilter = '';
    let params = [];

    if (startDate && endDate) {
      dateFilter = 'WHERE date BETWEEN $1 AND $2';
      params = [startDate, endDate];
    } else {
      // Default: last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];
      const todayStr = new Date().toISOString().split('T')[0];
      dateFilter = 'WHERE date BETWEEN $1 AND $2';
      params = [thirtyDaysAgoStr, todayStr];
    }

    // Query our pre-aggregated sales analytics tables
    const salesQuery = `
      SELECT 
        COALESCE(SUM(total_sales_cents), 0) as totalRevenueCents,
        COALESCE(SUM(total_orders), 0) as totalOrders,
        COALESCE(SUM(total_items_sold), 0) as totalItems
      FROM daily_sales 
      ${dateFilter}
    `;

    const { data: salesData, error: salesError } = await supabase.rpc('exec_sql', {
      query: salesQuery,
      params: params
    });

    if (salesError) {
      console.error("Error fetching sales data:", salesError);
      // Fallback to basic calculation
      throw salesError;
    }

    const salesResult = salesData?.[0] || {
      totalRevenueCents: 0,
      totalOrders: 0,
      totalItems: 0
    };

    // Get best selling variants from our analytics tables
    const bestSellersQuery = `
      SELECT
        pv.name as variant_name,
        p.name as product_name,
        COALESCE(SUM(oi.quantity), 0) as total_quantity_sold,
        COALESCE(SUM(oi.price_cents * oi.quantity), 0) as total_revenue_cents,
        COUNT(DISTINCT oi.order_id) as order_count
      FROM order_items oi
      LEFT JOIN product_variants pv ON oi.variant_id = pv.id
      LEFT JOIN products p ON pv.product_id = p.id
      ${startDate && endDate ? `WHERE oi.created_at::date BETWEEN '${startDate}' AND '${endDate}'` : ''}
      GROUP BY pv.id, p.name, pv.name
      ORDER BY total_quantity_sold DESC
      LIMIT 10
    `;

    const { data: bestSellers, error: bestSellersError } = await supabase.rpc('exec_sql', {
      query: bestSellersQuery,
      params: []
    });

    if (bestSellersError) {
      console.warn("Error fetching best sellers:", bestSellersError);
    }

    // Get COGS from existing logic (for backward compatibility)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString();

    const { data: paidOrders, error: ordersError } = await supabase
      .from('orders')
      .select('id')
      .eq('payment_status', 'paid')
      .gte('paid_at', thirtyDaysAgoStr);

    if (ordersError) {
      console.error("Error fetching paid orders:", ordersError);
    }

    let orderIds = paidOrders?.map(o => o.id) || [];
    
    const { data: orderItems, error: itemsError } = orderIds.length > 0
      ? await supabase
          .from('order_items')
          .select(`
            quantity,
            variant_id,
            product_variants (
              cost_price_cents
            )
          `)
          .in('order_id', orderIds)
      : { data: [], error: null };

    if (itemsError) {
      console.error("Error fetching order items:", itemsError);
    }

    // Calculate estimated COGS
    let estimatedCogs = 0;
    if (orderItems && Array.isArray(orderItems)) {
      for (const item of orderItems) {
        const costPrice = item.product_variants?.cost_price_cents || 0;
        estimatedCogs += (costPrice * item.quantity);
      }
    }

    // Get operating expenses
    const { data: expenses, error: expensesError } = await supabase
      .from('operating_costs')
      .select('amount, category, description, occurred_on')
      .gte('occurred_on', thirtyDaysAgoStr.split('T')[0])
      .order('occurred_on', { ascending: false });

    if (expensesError) {
      console.warn("Error fetching expenses:", expensesError);
    }

    const totalExpenses = Array.isArray(expenses) 
      ? expenses.reduce((sum, expense) => sum + (expense.amount || 0), 0) 
      : 0;

    // Calculate profit
    const profit = (salesResult.totalRevenueCents || 0) - estimatedCogs - totalExpenses;

    // Prepare response
    const result = {
      // Sales data from our analytics tables
      totalRevenueCents: salesResult.totalRevenueCents || 0,
      totalOrders: salesResult.totalOrders || 0,
      totalItems: salesResult.totalItems || 0,
      bestSellers: bestSellers || [],
      
      // Financial data (existing logic)
      revenue: salesResult.totalRevenueCents || 0, // in cents
      cogs: estimatedCogs, // in cents  
      expenses: totalExpenses, // in cents
      profit: profit, // in cents
      recentExpenses: expenses?.slice(0, 10) || []
    };

    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ok: true, data: result }),
    };
  } catch (e) {
    console.error("Admin sales analytics error:", e);
    return {
      statusCode: 500,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ 
        ok: false, 
        error: e.message || "Server error",
        fallback: true // Indicates this is fallback data
      }),
    };
  }
};

export const handler = withAdminAuth(baseHandler);
