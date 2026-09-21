/**
 * Ultimate Stock Deduction Function
 * This function handles stock deduction without relying on existing RPC functions
 */

import { createClient } from '@supabase/supabase-js';
import { withAdminAuth } from "./_lib/admin-auth.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function baseHandler(event, _context) {
  try {
    const { order_id } = JSON.parse(event.body || '{}');
    
    if (!order_id) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: false, error: 'Missing order_id' })
      };
    }

    console.log(`🔧 Starting manual stock deduction for order ${order_id}`);

    // Get order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, order_number, status, total_cents')
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      throw new Error(`Order not found: ${orderError?.message}`);
    }

    console.log(`📦 Processing order ${order.order_number} (${order.status})`);

    // Get order items
    const { data: orderItems, error: itemsError } = await supabase
      .from('order_items')
      .select('id, product_id, name, quantity, unit_price_cents')
      .eq('order_id', order_id);

    if (itemsError) {
      throw new Error(`Failed to fetch order items: ${itemsError.message}`);
    }

    if (!orderItems || orderItems.length === 0) {
      console.log(`⚠️ No items found for order ${order_id}`);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ok: true, 
          message: 'No items to process',
          order_id,
          items_processed: 0
        })
      };
    }

    console.log(`📋 Found ${orderItems.length} items to process`);

    let successful = 0;
    let failed = 0;
    const results = [];

    // Process each item
    for (const item of orderItems) {
      const result = {
        item_id: item.id,
        product_name: item.name,
        quantity: item.quantity,
        status: 'failed',
        error: null,
        product_id: null,
        stock_before: null,
        stock_after: null
      };

      try {
        let product = null;

        // Try to find product by ID first
        if (item.product_id) {
          const { data: productById } = await supabase
            .from('products')
            .select('id, name, stock, is_active')
            .eq('id', item.product_id)
            .single();

          if (productById && productById.is_active) {
            product = productById;
            console.log(`✅ Found product by ID: ${product.name}`);
          }
        }

        // If ID failed, try name matching
        if (!product) {
          const normalizedName = item.name.trim().toLowerCase();
          const { data: products } = await supabase
            .from('products')
            .select('id, name, stock, is_active')
            .eq('is_active', true);

          if (products) {
            const match = products.find(p => 
              p.name.trim().toLowerCase() === normalizedName ||
              p.name.trim().toLowerCase().includes(normalizedName) ||
              normalizedName.includes(p.name.trim().toLowerCase())
            );

            if (match) {
              product = match;
              console.log(`✅ Found product by name: ${product.name}`);
            }
          }
        }

        if (!product) {
          result.error = `Product not found: ${item.name}`;
          failed++;
          results.push(result);
          continue;
        }

        result.product_id = product.id;
        result.stock_before = product.stock || 0;

        // Check if we have enough stock
        if ((product.stock || 0) < item.quantity) {
          result.error = `Insufficient stock: need ${item.quantity}, have ${product.stock || 0}`;
          failed++;
          results.push(result);
          continue;
        }

        // Deduct stock
        const newStock = (product.stock || 0) - item.quantity;
        const { error: updateError } = await supabase
          .from('products')
          .update({ 
            stock: newStock,
            updated_at: new Date().toISOString()
          })
          .eq('id', product.id);

        if (updateError) {
          result.error = `Failed to update stock: ${updateError.message}`;
          failed++;
          results.push(result);
          continue;
        }

        result.stock_after = newStock;

        // Log stock movement
        const { error: movementError } = await supabase
          .from('stock_movements')
          .insert({
            product_id: product.id,
            movement_type: 'sale',
            quantity: -item.quantity,
            order_id: order_id,
            notes: `Manual stock deduction for order ${order.order_number}`,
            created_at: new Date().toISOString()
          });

        if (movementError) {
          console.warn(`⚠️ Failed to log stock movement: ${movementError.message}`);
        }

        result.status = 'success';
        successful++;
        console.log(`✅ Stock deducted: ${product.name} (-${item.quantity}, was ${result.stock_before}, now ${result.stock_after})`);

      } catch (itemError) {
        result.error = itemError.message;
        failed++;
      }

      results.push(result);
    }

    const summary = {
      order_id,
      total_items: orderItems.length,
      successful,
      failed,
      success_rate: Math.round((successful / orderItems.length) * 100)
    };

    console.log(`📊 Stock deduction complete: ${successful}/${orderItems.length} successful`);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: true,
        summary,
        results
      })
    };

  } catch (error) {
    console.error(`❌ Stock deduction failed:`, error);
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: false,
        error: error.message
      })
    };
  }
}

export const handler = withAdminAuth(baseHandler);
