import { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { withAdminAuth } from "./_lib/with-admin-auth";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const baseHandler: Handler = async (event) => {
  try {
    const period = event.queryStringParameters?.period || '30';
    console.log(`📊 Calculating finance stats for period: ${period}`);
    
    const now = new Date();
    let startDate = new Date();
    
    if (period === 'today' || period === '1') {
      // Use Rolling 24 Hours for today's stats (to account for time zone differences)
      startDate.setTime(now.getTime() - (24 * 60 * 60 * 1000));
      console.log(`Using rolling 24h period: ${startDate.toISOString()} to ${now.toISOString()}`);
    } else {
      const days = parseInt(period) || 30;
      startDate.setDate(now.getDate() - days);
    }

    // 2. Fetch Products (for accurate Cost calculation)
    const { data: products } = await supabase.from('products').select('id, name, cost_price_cents, price_cents');
    const productMap = new Map();
    products?.forEach(p => {
      // Use cost price, falling back to 0 if null, or a safe estimate (e.g., 40% of selling price)
      const cost = p.cost_price_cents || 0; 
      productMap.set(p.id, { cost, name: p.name });
    });

    // 3. Fetch Orders - CORE FIX: STRICTLY filter for PAID/ACTIVE/NOT-JUNK orders at the DB level
    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          product_id, 
          quantity,
          qty,
          name
        )
      `)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', now.toISOString())
      // 🚨 CORE FILTER 1: Must be Paid or in a definitive active fulfillment status.
      .or('payment_status.eq.paid,status.in.(paid,packed,collected,out_for_delivery,delivered)')
      // 🚨 CORE FILTER 2: Must NOT be Cancelled
      .not('status', 'eq', 'cancelled')
      // 🚨 CORE FILTER 3: Must NOT be Archived
      .or('archived.is.null,archived.eq.false')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // 4. Calculate Stats (now iterating over a clean list of orders)
    let totalRevenue = 0;
    let totalCOGS = 0;
    let totalOrders = 0;
    let totalItemsSold = 0;
    let totalDiscounts = 0;
    const productSales = new Map<string, number>();

    orders?.forEach(order => {
      // Since the DB query is now strict, every order in this loop is counted for Total Orders
      totalOrders++;
      totalRevenue += (order.total_cents || 0);
      totalDiscounts += (order.discount_cents || 0);

      const items = order.order_items || [];
      items.forEach((item: any) => {
        const qty = item.quantity || item.qty || 0;
        totalItemsSold += qty;

        if (item.product_id) {
          const pInfo = productMap.get(item.product_id);
          if (pInfo) {
            totalCOGS += (pInfo.cost * qty);
            
            const prodName = pInfo.name || item.name || 'Unknown Product';
            const currentQty = productSales.get(prodName) || 0;
            productSales.set(prodName, currentQty + qty);
          }
        }
      });
    });

    // 5. Find Top Product
    let topProduct = "No sales yet";
    let topCount = 0;
    for (const [name, count] of productSales.entries()) {
      if (count > topCount) {
        topCount = count;
        topProduct = name;
      }
    }

    // 6. Expenses
    const { data: expenses } = await supabase
      .from('operating_costs')
      .select('amount')
      .gte('occurred_on', startDate.toISOString());

    const totalOperatingCosts = expenses?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;

    // 7. Net Profit
    const netProfit = totalRevenue - totalCOGS - totalOperatingCosts;

    console.log(`✅ Stats Calculated: ${totalOrders} orders, R${totalRevenue/100} revenue`);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        ok: true,
        data: {
          orders_count: totalOrders,
          items_sold: totalItemsSold,
          revenue: totalRevenue,
          netRevenue: totalRevenue, 
          cogs: totalCOGS,
          expenses: totalOperatingCosts,
          profit: netProfit,
          top_selling_product: topProduct,
          top_selling_count: topCount,
          totalDiscounts: totalDiscounts,
          period_label: period === 'today' || period === '1' ? 'Last 24 Hours' : `Last ${period} Days`
        }
      })
    };

  } catch (error: any) {
    console.error('Finance stats error:', error);
    return { 
      statusCode: 500, 
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: false, error: error.message }) 
    };
  }
};

export const handler = withAdminAuth(baseHandler);
