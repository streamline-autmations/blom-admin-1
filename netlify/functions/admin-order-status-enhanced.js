// Enhanced Order Status Update with Comprehensive Webhook
// This function handles the complete order status update flow

import { createClient } from "@supabase/supabase-js";
import { withAdminAuth } from "./_lib/admin-auth.js";

const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Helper function to safely extract order data
function extractOrderData(order) {
  if (!order) return null;
  
  return {
    id: order.id,
    order_number: order.order_number,
    buyer_name: order.buyer_name,
    buyer_email: order.buyer_email,
    buyer_phone: order.buyer_phone,
    shipping_address: order.shipping_address,
    delivery_address: order.delivery_address,
    fulfillment_type: order.fulfillment_type || 'delivery',
    total_cents: order.total_cents || 0,
    subtotal_cents: order.subtotal_cents || 0,
    shipping_cents: order.shipping_cents || 0,
    discount_cents: order.discount_cents || 0,
    created_at: order.created_at,
    notes: order.notes,
    status: order.status
  };
}

// Helper function to safely extract order items
function extractOrderItems(items) {
  if (!items || !Array.isArray(items)) return [];
  
  return items.map(item => ({
    name: item.name,
    product_name: item.product_name,
    quantity: item.quantity,
    unit_price_cents: item.unit_price_cents,
    line_total_cents: item.line_total_cents,
    variant: item.variant,
    sku: item.sku
  }));
}

// Main webhook function
async function sendStatusWebhook(orderData, newStatus, currentStatus, orderItems) {
  console.log(`📡 Starting webhook for status change: ${currentStatus} -> ${newStatus}`);
  
  // Determine webhook URL based on status
  let webhookUrl = null;
  let webhookType = '';
  
  if (newStatus === 'packed' && orderData.fulfillment_type === 'collection') {
    webhookUrl = 'https://dockerfile-1n82.onrender.com/webhook/ready-for-collection';
    webhookType = 'ready_for_collection';
  } else if (newStatus === 'packed' && orderData.fulfillment_type === 'delivery') {
    webhookUrl = 'https://dockerfile-1n82.onrender.com/webhook/ready-for-delivery';
    webhookType = 'ready_for_delivery';
  } else if (newStatus === 'out_for_delivery') {
    webhookUrl = 'https://dockerfile-1n82.onrender.com/webhook/out-for-delivery';
    webhookType = 'out_for_delivery';
  }
  
  if (!webhookUrl) {
    console.log(`ℹ️ No webhook configured for status: ${newStatus} (${orderData.fulfillment_type})`);
    return { called: false, ok: false, error: null };
  }
  
  console.log(`📡 Sending webhook to: ${webhookUrl}`);
  
  // Comprehensive order payload
  const webhookPayload = {
    event: 'order_status_changed',
    webhook_type: 'status_notification',
    timestamp: new Date().toISOString(),
    system: 'BLOM-Admin',
    order: {
      // Order identification
      order_id: orderData.id,
      order_number: orderData.order_number,
      
      // Customer contact information
      customer_name: orderData.buyer_name,
      customer_email: orderData.buyer_email,
      customer_phone: orderData.buyer_phone,
      customer_address: orderData.shipping_address,
      
      // Delivery information
      shipping_address: orderData.shipping_address,
      delivery_address: orderData.delivery_address,
      fulfillment_type: orderData.fulfillment_type,
      
      // Order status and timing
      current_status: newStatus,
      previous_status: currentStatus,
      status_changed_at: new Date().toISOString(),
      order_created_at: orderData.created_at,
      
      // Financial details
      total_cents: orderData.total_cents,
      total_rands: (orderData.total_cents || 0) / 100,
      subtotal_cents: orderData.subtotal_cents,
      subtotal_rands: (orderData.subtotal_cents || 0) / 100,
      shipping_cents: orderData.shipping_cents,
      shipping_rands: (orderData.shipping_cents || 0) / 100,
      discount_cents: orderData.discount_cents,
      discount_rands: (orderData.discount_cents || 0) / 100,
      
      // Order items
      order_items: extractOrderItems(orderItems),
      
      // Additional details
      notes: orderData.notes,
      
      // System info
      webhook_endpoint: webhookUrl,
      system: 'BLOM-Admin'
    }
  };
  
  try {
    console.log(`📡 Webhook payload prepared for ${orderData.order_number}`);
    console.log(`📦 Customer: ${orderData.buyer_name} (${orderData.buyer_email})`);
    console.log(`📍 ${orderData.fulfillment_type} - Items: ${orderItems?.length || 0}, Total: R${(orderData.total_cents || 0) / 100}`);
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'BLOM-Admin/1.0',
        'X-Order-Status': newStatus,
        'X-Fulfillment-Type': orderData.fulfillment_type
      },
      body: JSON.stringify(webhookPayload)
    });
    
    if (response.ok) {
      console.log(`✅ Webhook sent successfully: ${webhookType}`);
      return { called: true, ok: true, error: null };
    } else {
      const errorText = await response.text();
      console.error(`❌ Webhook failed: HTTP ${response.status} - ${errorText}`);
      return { called: true, ok: false, error: `HTTP ${response.status}: ${errorText}` };
    }
  } catch (error) {
    console.error(`❌ Webhook error:`, error.message);
    return { called: true, ok: false, error: error.message };
  }
}

const baseHandler = async (e) => {
  if (e.httpMethod !== "POST") {
    return { 
      statusCode: 405, 
      headers: { "Content-Type": "application/json" }, 
      body: "Method Not Allowed" 
    };
  }

  try {
    const { id, status } = JSON.parse(e.body || "{}");
    console.log(`🔄 Order status update requested - ID: ${id}, Status: ${status}`);
    
    if (!id || !status) {
      console.error("❌ Missing required parameters:", { id, status });
      throw new Error("Missing id or status");
    }

    // 1. Get current order info
    console.log(`🔍 Fetching current order data...`);
    const { data: order, error: fetchErr } = await s
      .from("orders")
      .select("*")
      .eq("id", id)
      .single();

    console.log(`🔍 Current order data:`, { 
      order: order ? 'found' : 'not found', 
      error: fetchErr 
    });

    if (fetchErr || !order) {
      console.error(`❌ Failed to fetch order:`, fetchErr);
      throw new Error(`Order not found: ${fetchErr?.message || 'No error message'}`);
    }

    const currentStatus = order.status;
    console.log(`📋 Order ${order.order_number}: ${currentStatus} -> ${status}`);

    // 2. Enhanced order items fetch
    console.log(`🛒 Fetching order items...`);
    const { data: orderItems, error: itemsError } = await s
      .from('order_items')
      .select('name, product_name, quantity, unit_price_cents, line_total_cents, variant, sku')
      .eq('order_id', id);

    console.log(`🛒 Order items result:`, { 
      count: orderItems?.length || 0, 
      error: itemsError 
    });

    // 3. Try multiple update approaches
    let updateResult = null;
    let updateMethod = '';
    let updateError = null;

    // Approach 1: Standard update
    console.log(`📤 Attempting standard update...`);
    const now = new Date().toISOString();
    const patch = { 
      status, 
      updated_at: now 
    };

    // Add timestamp based on status
    if (status === 'packed') patch.order_packed_at = now;
    if (status === 'out_for_delivery') patch.order_out_for_delivery_at = now;
    if (status === 'collected') {
      patch.order_collected_at = now;
      patch.fulfilled_at = now;
    }
    if (status === 'delivered') {
      patch.order_delivered_at = now;
      patch.fulfilled_at = now;
    }

    try {
      const { data: updated, error } = await s
        .from("orders")
        .update(patch)
        .eq("id", id)
        .select("id, status, updated_at, order_packed_at")
        .single();

      console.log(`📤 Standard update result:`, { updated, error });

      if (!error && updated) {
        updateResult = updated;
        updateMethod = 'standard_update';
      } else {
        updateError = error;
      }
    } catch (err) {
      console.error(`❌ Standard update failed:`, err);
      updateError = err;
    }

    // Approach 2: RPC function if standard update failed
    if (!updateResult) {
      console.log(`📤 Attempting RPC update...`);
      try {
        const { data: rpcResult, error: rpcError } = await s.rpc('update_order_status', {
          p_order_id: id,
          p_new_status: status,
          p_timestamp: now
        });

        console.log(`📤 RPC update result:`, { rpcResult, rpcError });

        if (!rpcError && rpcResult) {
          updateResult = rpcResult;
          updateMethod = 'rpc_update';
        } else {
          console.error(`❌ RPC update failed:`, rpcError);
          if (!updateError) updateError = rpcError;
        }
      } catch (err) {
        console.error(`❌ RPC update error:`, err);
        if (!updateError) updateError = err;
      }
    }

    // Approach 3: Direct SQL if both approaches failed
    if (!updateResult) {
      console.log(`📤 Attempting direct SQL update...`);
      try {
        const { data: sqlResult, error: sqlError } = await s.rpc('exec', {
          query: `UPDATE orders SET status = '${status}', updated_at = '${now}' WHERE id = '${id}' RETURNING id, status, updated_at`
        });

        console.log(`📤 Direct SQL update result:`, { sqlResult, sqlError });

        if (!sqlError && sqlResult) {
          updateResult = sqlResult;
          updateMethod = 'direct_sql';
        } else {
          console.error(`❌ Direct SQL update failed:`, sqlError);
          if (!updateError) updateError = sqlError;
        }
      } catch (err) {
        console.error(`❌ Direct SQL update error:`, err);
        if (!updateError) updateError = err;
      }
    }

    // If no update method worked, throw the error
    if (!updateResult) {
      throw new Error(`All update methods failed. Last error: ${updateError?.message || 'Unknown error'}`);
    }

    console.log(`✅ Order updated successfully using ${updateMethod}`);

    // 4. Send webhook with comprehensive data
    const orderData = extractOrderData(order);
    const webhookResult = await sendStatusWebhook(orderData, status, currentStatus, orderItems);

    // 5. Return success response
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ 
        ok: true, 
        order: updateResult,
        updateMethod,
        webhook: webhookResult,
        statusChange: {
          from: currentStatus,
          to: status,
          timestamp: now
        },
        debug: {
          orderId: id,
          orderNumber: order.order_number,
          updateSuccess: true,
          webhookCalled: webhookResult.called,
          webhookOk: webhookResult.ok
        }
      })
    };

  } catch (err) {
    console.error("❌ Order status update failed:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        ok: false, 
        error: err.message,
        debug: {
          stack: err.stack,
          timestamp: new Date().toISOString()
        }
      })
    };
  }
};

export const handler = withAdminAuth(baseHandler);
