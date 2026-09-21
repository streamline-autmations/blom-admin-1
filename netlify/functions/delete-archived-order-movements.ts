import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { withAdminAuth } from "./_lib/with-admin-auth";

const s = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const baseHandler: Handler = async (e) => {
  try {
    // First, get all archived order IDs
    const { data: archivedOrders, error: orderError } = await s
      .from('orders')
      .select('id')
      .eq('archived', true);

    if (orderError) {
      throw new Error(`Failed to fetch archived orders: ${orderError.message}`);
    }

    const archivedOrderIds = archivedOrders?.map(order => order.id) || [];
    
    if (archivedOrderIds.length === 0) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ 
          ok: true, 
          message: 'No archived orders found',
          deletedCount: 0
        })
      };
    }

    // Delete stock movements for these archived orders
    const { data, error } = await s
      .from('stock_movements')
      .delete()
      .in('order_id', archivedOrderIds)
      .select('id, order_id, product_name');

    if (error) {
      throw new Error(`Failed to delete stock movements: ${error.message}`);
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ 
        ok: true, 
        message: `Successfully deleted ${data?.length || 0} stock movements for archived orders`,
        deletedCount: data?.length || 0,
        archivedOrdersCount: archivedOrderIds.length,
        deletedMovements: data || []
      })
    };
  } catch (err: any) {
    console.error('Delete archived order movements error:', err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ ok: false, error: err.message || String(err) })
    };
  }
};

export const handler = withAdminAuth(baseHandler);
