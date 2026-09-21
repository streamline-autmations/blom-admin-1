import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { withAdminAuth } from "./_lib/with-admin-auth";

const s = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const baseHandler: Handler = async (e) => {
  try {
    const url = new URL(e.rawUrl);
    const period = url.searchParams.get('period') || '30';
    const productId = url.searchParams.get('product_id');
    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');
    
    let fromDate: Date;
    const now = new Date();
    
    if (startDate && endDate) {
      fromDate = new Date(startDate);
    } else {
      const days = parseInt(period) || 30;
      fromDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    }
    
    const fromIso = fromDate.toISOString();

    // 1. TOP SELLING PRODUCTS - Updated Selection
    let topProductsQuery = s
      .from("order_items")
      .select(`
        product_id,
        bundle_id,
        qty,
        quantity,
        line_total_cents,
        line_total,
        unit_price_cents,
        unit_price,
        orders!inner (
          id,
          created_at,
          status,
          payment_status,
          subtotal_cents,
          total_cents,
          discount_cents,
          fulfillment_method,
          customer_email,
          archived
        ),
        products (
          id,
          name,
          cost_price_cents,
          stock_qty
        ),
        bundles (
          id,
          name
        )
      `)
      .gte("orders.created_at", fromIso)
      // Standardize status filtering
      .or('payment_status.eq.paid,status.in.(paid,packed,collected,out_for_delivery,delivered)', { foreignTable: 'orders' })
      .or('archived.is.null,archived.eq.false', { foreignTable: 'orders' });

    if (productId) {
      topProductsQuery = topProductsQuery.eq("product_id", productId);
    }

    const { data: orderItems, error: itemsError } = await topProductsQuery;
    if (itemsError) throw itemsError;

    const productAnalytics: Record<string, any> = {};
    
    (orderItems || []).forEach((item: any) => {
      // A line item is either a product or a bundle. Bundles live outside the `products`
      // table, so they arrive with product_id null and bundle_id set -- before this they
      // were dropped by an inner join and never showed up in reporting at all. Course
      // items have neither id and are still skipped.
      const isBundle = !item.product_id && !!item.bundle_id;
      const entityId = item.product_id || item.bundle_id;
      const entityName = isBundle ? item.bundles?.name : item.products?.name;

      if (!entityId || !entityName) return;

      // Namespace bundle keys so a bundle can never collide with a product id.
      const pId = isBundle ? `bundle:${entityId}` : entityId;

      if (!productAnalytics[pId]) {
        productAnalytics[pId] = {
          id: entityId,
          isBundle,
          name: entityName,
          totalUnitsSold: 0,
          totalRevenueCents: 0,
          totalOrders: 0,
          uniqueCustomers: new Set(),
          estimatedCOGS: 0,
          estimatedProfitCents: 0,
          dailySales: {} as Record<string, number>
        };
      }
      
      const analytics = productAnalytics[pId];
      
      // SMART DATA RESOLUTION: Check both field names
      const qty = item.quantity || item.qty || 0;
      // Prefer cents, fallback to float * 100
      const revenueCents = item.line_total_cents || (item.line_total ? Math.round(item.line_total * 100) : 0);
      
      analytics.totalUnitsSold += qty;
      analytics.totalRevenueCents += revenueCents;
      analytics.totalOrders += 1;
      
      if (item.orders?.customer_email) {
        analytics.uniqueCustomers.add(item.orders.customer_email);
      }
      
      // Bundles carry no cost_price_cents, so their margin is genuinely unknown. Leave
      // COGS and profit at 0 rather than counting the full sale as profit, which would
      // inflate the dashboard's profit figures. Units and revenue are still exact.
      if (!isBundle) {
        const costPrice = item.products?.cost_price_cents || 0;
        analytics.estimatedCOGS += (costPrice * qty);
        analytics.estimatedProfitCents += (revenueCents - (costPrice * qty));
      }
      
      const orderDate = new Date(item.orders?.created_at).toISOString().split('T')[0];
      analytics.dailySales[orderDate] = (analytics.dailySales[orderDate] || 0) + qty;
    });

    const topProducts = Object.values(productAnalytics)
      .map((product: any) => ({
        ...product,
        uniqueCustomers: product.uniqueCustomers.size,
        avgOrderValue: product.totalOrders > 0 ? product.totalRevenueCents / product.totalOrders : 0,
        profitMargin: product.totalRevenueCents > 0 ? (product.estimatedProfitCents / product.totalRevenueCents) * 100 : 0
      }))
      .sort((a, b) => b.totalUnitsSold - a.totalUnitsSold)
      .slice(0, 10);

    // 2. FULFILLMENT & OTHER METRICS (Keep existing structure but add status filters)
    const { data: fulfillmentData, error: fulfillmentError } = await s
      .from("orders")
      .select("id, total_cents, subtotal_cents, fulfillment_method, created_at, payment_status, customer_email")
      .gte("created_at", fromIso)
      .or('payment_status.eq.paid,status.in.(paid,packed,collected,out_for_delivery,delivered)')
      .or('archived.is.null,archived.eq.false');

    if (fulfillmentError) throw fulfillmentError;

    const deliveryAnalytics = {
      delivery: { count: 0, revenueCents: 0, totalProfitCents: 0, customers: new Set() },
      collection: { count: 0, revenueCents: 0, totalProfitCents: 0, customers: new Set() }
    };

    (fulfillmentData || []).forEach((order: any) => {
      // Normalize 'delivery' vs 'courier', 'collection' vs 'pickup'
      let method = 'collection';
      if (order.fulfillment_method && (order.fulfillment_method.includes('delivery') || order.fulfillment_method.includes('courier'))) {
        method = 'delivery';
      }
      
      const analytics = deliveryAnalytics[method];
      analytics.count += 1;
      analytics.revenueCents += order.total_cents || 0;
      
      if (order.customer_email) {
        analytics.customers.add(order.customer_email);
      }
    });

    // 3. CUSTOMER ANALYTICS
    const { data: customersData, error: customersError } = await s
      .from("orders")
      .select("customer_email, total_cents, created_at")
      .gte("created_at", fromIso)
      .not("customer_email", "is", null)
      .or('payment_status.eq.paid,status.in.(paid,packed,collected,out_for_delivery,delivered)')
      .or('archived.is.null,archived.eq.false');

    if (customersError) throw customersError;

    const customerAnalytics = {
      totalCustomers: new Set(),
      newCustomers: new Set(),
      repeatCustomers: new Set(),
      totalCustomerRevenue: 0
    };

    const customerOrders: Record<string, any[]> = {};
    (customersData || []).forEach((order: any) => {
      const email = order.customer_email;
      if (!email) return;
      
      customerAnalytics.totalCustomers.add(email);
      
      if (!customerOrders[email]) {
        customerOrders[email] = [];
        customerAnalytics.newCustomers.add(email);
      } else {
        customerAnalytics.repeatCustomers.add(email);
        customerAnalytics.newCustomers.delete(email);
      }
      
      customerOrders[email].push(order);
      customerAnalytics.totalCustomerRevenue += order.total_cents || 0;
    });

    // ... (Keep existing Conversion & Inventory sections as they were) ...
    // 4. CONVERSION RATE ANALYTICS
    const { data: contactsData } = await s.from("contacts").select("created_at").gte("created_at", fromIso);
    const { data: productsData } = await s.from("products").select("id, name, stock_qty, cost_price_cents, price_cents, status");

    const conversionAnalytics = {
      totalContacts: (contactsData || []).length,
      totalOrders: (fulfillmentData || []).length,
      conversionRate: (contactsData || []).length > 0 ? ((fulfillmentData || []).length / (contactsData || []).length) * 100 : 0,
      averageOrderValue: (fulfillmentData || []).length > 0 ? (fulfillmentData || []).reduce((sum, o) => sum + (o.total_cents || 0), 0) / (fulfillmentData || []).length : 0,
      customerLifetimeValue: customerAnalytics.totalCustomers.size > 0 ? customerAnalytics.totalCustomerRevenue / customerAnalytics.totalCustomers.size : 0
    };

    const inventoryAnalytics = {
      totalProducts: (productsData || []).length,
      activeProducts: (productsData || []).filter(p => p.status === 'active').length,
      lowStockProducts: (productsData || []).filter(p => (p.stock_qty || 0) < 5).length,
      outOfStockProducts: (productsData || []).filter(p => (p.stock_qty || 0) === 0).length,
      totalInventoryValue: (productsData || []).reduce((sum, p) => sum + ((p.stock_qty || 0) * (p.cost_price_cents || 0)), 0),
      averageInventoryTurnover: 0
    };

    // 6. SALES TRENDS
    const salesTrends = {};
    const ordersTrends = {};
    
    for (let i = 0; i < parseInt(period); i++) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateKey = date.toISOString().split('T')[0];
      salesTrends[dateKey] = 0;
      ordersTrends[dateKey] = 0;
    }

    (fulfillmentData || []).forEach((order: any) => {
      const dateKey = new Date(order.created_at).toISOString().split('T')[0];
      if (salesTrends.hasOwnProperty(dateKey)) {
        salesTrends[dateKey] += order.total_cents || 0;
        ordersTrends[dateKey] += 1;
      }
    });

    const trendData = Object.entries(salesTrends).map(([date, revenue]) => ({
      date,
      revenueCents: revenue,
      orders: ordersTrends[date] || 0
    })).sort((a, b) => a.date.localeCompare(b.date));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        ok: true,
        data: {
          period: { from: fromIso, to: now.toISOString(), days: parseInt(period) },
          topProducts: topProducts.slice(0, 3),
          allTopProducts: topProducts,
          fulfillment: {
            delivery: {
              count: deliveryAnalytics.delivery.count,
              revenueCents: deliveryAnalytics.delivery.revenueCents,
              avgOrderValue: deliveryAnalytics.delivery.count > 0 ? deliveryAnalytics.delivery.revenueCents / deliveryAnalytics.delivery.count : 0,
              uniqueCustomers: deliveryAnalytics.delivery.customers.size
            },
            collection: {
              count: deliveryAnalytics.collection.count,
              revenueCents: deliveryAnalytics.collection.revenueCents,
              avgOrderValue: deliveryAnalytics.collection.count > 0 ? deliveryAnalytics.collection.revenueCents / deliveryAnalytics.collection.count : 0,
              uniqueCustomers: deliveryAnalytics.collection.customers.size
            }
          },
          customers: {
            totalCustomers: customerAnalytics.totalCustomers.size,
            newCustomers: customerAnalytics.newCustomers.size,
            repeatCustomers: customerAnalytics.repeatCustomers.size,
            repeatCustomerRate: customerAnalytics.totalCustomers.size > 0 ? (customerAnalytics.repeatCustomers.size / customerAnalytics.totalCustomers.size) * 100 : 0,
            totalCustomerRevenue: customerAnalytics.totalCustomerRevenue,
            avgCustomerValue: customerAnalytics.totalCustomers.size > 0 ? customerAnalytics.totalCustomerRevenue / customerAnalytics.totalCustomers.size : 0
          },
          conversions: conversionAnalytics,
          inventory: inventoryAnalytics,
          trends: trendData,
          summary: {
            totalRevenueCents: (fulfillmentData || []).reduce((sum, order) => sum + (order.total_cents || 0), 0),
            totalOrders: (fulfillmentData || []).length,
            avgOrderValue: conversionAnalytics.averageOrderValue,
            avgProfitPerTransaction: topProducts.length > 0 ? topProducts.reduce((sum, p) => sum + p.estimatedProfitCents, 0) / (fulfillmentData || []).length : 0
          }
        }
      })
    };

  } catch (err: any) {
    console.error("Advanced Analytics Error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ ok: false, error: err.message || "Failed to fetch advanced analytics" })
    };
  }
};

export const handler = withAdminAuth(baseHandler);
