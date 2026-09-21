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
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ ok: false, error: 'Method Not Allowed' }) };
  }

  try {
    const { productId, delta, quantityChange, reason, costPrice } = JSON.parse(event.body || '{}');

    // Support both 'delta' and 'quantityChange' parameters for backward compatibility
    const quantityChangeValue = quantityChange !== undefined ? quantityChange : delta;

    if (!productId) {
      return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'Missing productId' }) };
    }

    const supabase = getSupabaseAdmin();

    // 1. Update Stock (if quantity changed)
    if (quantityChangeValue && quantityChangeValue !== 0) {
      // First update the stock
      const { error: stockError } = await supabase.rpc('adjust_stock', {
        product_uuid: productId,
        quantity_to_reduce: -quantityChangeValue // Negative to add, positive to reduce
      });
      
      if (stockError) {
        throw new Error(`Stock update failed: ${stockError.message}`);
      }

      // Log movement using the simple logging function
      const { error: logError } = await supabase.rpc('log_stock_movement', {
        p_product_id: productId,
        p_delta: quantityChangeValue,
        p_reason: `Manual stock adjustment: ${quantityChangeValue > 0 ? 'Added' : 'Removed'} ${Math.abs(quantityChangeValue)} units (${reason || 'manual_adjustment'})`
      });
      
      if (logError) {
        console.error('Stock movement log error:', logError);
        // Don't throw here, the stock was updated successfully
      }
    }

    // 2. Update Cost Price (if provided)
    if (costPrice !== undefined && costPrice !== null) {
      const costCents = Math.round(parseFloat(costPrice) * 100);
      const { error: costError } = await supabase
        .from('products')
        .update({
          cost_price_cents: costCents,
          updated_at: new Date().toISOString()
        })
        .eq('id', productId);

      if (costError) {
        throw new Error(`Cost price update failed: ${costError.message}`);
      }
    }

    // CRITICAL: Also invalidate products query so Products page updates
    // Even though we're updating via RPC, the products table doesn't auto-refresh
    const { error: refreshError } = await supabase
      .from('products')
      .select('id')
      .eq('id', productId)
      .limit(1);

    // This forces Supabase to acknowledge the change

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        ok: true,
        message: 'Stock adjusted successfully',
        productId,
        delta: quantityChangeValue,
        reason: reason || 'manual_adjustment'
      })
    };

  } catch (e: any) {
    console.error('Adjust Stock Error:', e);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ ok: false, error: e.message })
    };
  }
};




export const handler = withAdminAuth(baseHandler);
