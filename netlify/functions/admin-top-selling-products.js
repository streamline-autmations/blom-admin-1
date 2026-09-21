import { createClient } from '@supabase/supabase-js';
import { withAdminAuth } from "./_lib/with-admin-auth";

const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const baseHandler = async (e) => {
  try {
    const url = new URL(e.rawUrl);
    const period = url.searchParams.get('period') || '30'; // Default 30 days
    const limit = Number(url.searchParams.get('limit') || '10');
    const filter = url.searchParams.get('filter') || 'all'; // 'all', 'manual', 'order'
    
    // Calculate date range
    const now = new Date();
    const days = parseInt(period) || 30;
    const fromDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const fromIso = fromDate.toISOString();
    
    console.log(`🔍 Top Selling Products - Period: ${period} days, From: ${fromIso}`);

    // Query stock movements for sales data
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
        product:products(id, name, slug, status),
        orders:orders(id, archived, created_at, payment_status, total_cents)
      `)
      .gte("created_at", fromIso)
      .order("created_at", { ascending: false })
      .limit(1000); // Get more data for better analysis

    // Apply movement type filter (only sales/movements from orders)
    if (filter === 'order') {
      query = query.eq('movement_type', 'order');
    } else if (filter === 'manual') {
      query = query.eq('movement_type', 'manual');
    }

    const { data: movements, error } = await query;
    
    if (error) {
      console.error('Stock movements query error:', error);
      return { statusCode: 500, body: JSON.stringify({ ok: false, error: error.message }) };
    }
    
    console.log(`📊 Found ${movements?.length || 0} movements in period`);

    // Process movements to build product analytics
    const productAnalytics = {};
    
    // Filter for actual sales (negative delta means items were sold)
    const salesMovements = (movements || []).filter(movement => {
      // Only include movements that represent actual sales
      const isOrderMovement = movement.movement_type === 'order' || 
                            (movement.reason && movement.reason.toLowerCase().includes('order'));
      const isNegativeDelta = movement.delta < 0;
      const hasValidProduct = movement.product_id && (movement.product?.name || movement.product_name);
      
      return isOrderMovement && isNegativeDelta && hasValidProduct;
    });
    
    console.log(`🛒 Identified ${salesMovements.length} sales movements`);

    // Aggregate sales data by product
    salesMovements.forEach((movement) => {
      const productId = movement.product_id;
      const productName = movement.product?.name || movement.product_name || 'Unknown Product';
      
      if (!productAnalytics[productId]) {
        productAnalytics[productId] = {
          id: productId,
          name: productName,
          totalUnitsSold: 0,
          totalRevenueCents: 0,
          totalOrders: new Set(),
          lastSaleDate: null,
          avgOrderValue: 0,
          profitMargin: 0
        };
      }
      
      const analytics = productAnalytics[productId];
      const unitsSold = Math.abs(movement.delta); // Convert negative to positive
      
      analytics.totalUnitsSold += unitsSold;
      
      // Try to get revenue from associated order
      if (movement.orders && movement.orders.total_cents) {
        // Distribute order total proportionally by units sold
        analytics.totalRevenueCents += movement.orders.total_cents;
        analytics.totalOrders.add(movement.orders.id);
      }
      
      // Track last sale date
      const saleDate = new Date(movement.created_at);
      if (!analytics.lastSaleDate || saleDate > analytics.lastSaleDate) {
        analytics.lastSaleDate = saleDate;
      }
    });

    // Convert to array and calculate additional metrics
    const topProducts = Object.values(productAnalytics)
      .map((product) => {
        // Calculate additional metrics
        const totalOrders = product.totalOrders.size;
        product.totalOrders = totalOrders;
        product.avgOrderValue = totalOrders > 0 ? product.totalRevenueCents / totalOrders : 0;
        
        // Calculate profit margin (assuming 30% margin as fallback)
        const estimatedCOGS = product.totalRevenueCents * 0.7; // 70% of revenue as COGS
        const estimatedProfit = product.totalRevenueCents - estimatedCOGS;
        product.profitMargin = product.totalRevenueCents > 0 ? (estimatedProfit / product.totalRevenueCents) * 100 : 0;
        
        return product;
      })
      .sort((a, b) => b.totalUnitsSold - a.totalUnitsSold)
      .slice(0, limit);

    console.log(`🏆 Top ${topProducts.length} products:`, topProducts.map(p => `${p.name}: ${p.totalUnitsSold} units`));

    // Get summary statistics
    const totalUnitsSold = topProducts.reduce((sum, p) => sum + p.totalUnitsSold, 0);
    const totalRevenue = topProducts.reduce((sum, p) => sum + p.totalRevenueCents, 0);
    const totalOrders = topProducts.reduce((sum, p) => sum + p.totalOrders, 0);

    return { 
      statusCode: 200, 
      body: JSON.stringify({ 
        ok: true, 
        data: {
          period: {
            from: fromIso,
            to: now.toISOString(),
            days: parseInt(period)
          },
          topProducts,
          summary: {
            totalProducts: topProducts.length,
            totalUnitsSold,
            totalRevenueCents: totalRevenue,
            totalOrders,
            avgOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0
          }
        },
        filter,
        count: topProducts.length
      }) 
    };
  } catch (err) {
    console.error('Top selling products handler error:', err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: err.message || "admin-top-selling-products failed" }) };
  }
};

export const handler = withAdminAuth(baseHandler);
