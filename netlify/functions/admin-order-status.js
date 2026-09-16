import { createClient } from "@supabase/supabase-js";

const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Helper function to safely extract order data
function extractOrderData(order) {
  if (!order) return null;
  
  // 1. ROBUST DETECTION: Check both columns
  const rawType = (order.fulfillment_type || order.fulfillment_method || '').toLowerCase();
  
  // 2. NORMALIZE: Detect 'collection', 'pickup', or 'self-collect'
  let normalizedType = 'delivery'; // Default
  if (rawType.includes('collection') || rawType.includes('pickup')) {
    normalizedType = 'collection';
  }

  console.log(`🔍 Fulfillment Logic: Raw='${rawType}' -> Normalized='${normalizedType}'`);

  return {
    id: order.id,
    order_number: order.order_number,
    buyer_name: order.buyer_name,
    buyer_email: order.buyer_email,
    buyer_phone: order.buyer_phone,
    shipping_address: order.shipping_address,
    delivery_address: order.delivery_address,
    fulfillment_type: normalizedType, // <--- Uses the fixed value
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
    // CHANGE: Return ok: true. It's not an error, we just intentionally skipped it.
    return { called: false, ok: true, error: null }; 
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

export const handler = async (e) => {
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
          p_status: status,
          p_updated_at: now
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
    await sendStatusWebhook(orderData, status, currentStatus, orderItems);

    // 5. CRITICAL: Enhanced Stock Deduction + Analytics Update using Product Mapping System
    let stockProcessingResults = {
      itemsProcessed: 0,
      itemsSuccessful: 0,
      itemsFailed: 0,
      stockDeducted: false,
      analyticsUpdated: false,
      errors: []
    };

    if (status === 'paid' && currentStatus !== 'paid') {
      console.log(`💰 Processing paid order ${id} - Enhanced stock deduction + Analytics using mapping system`);
      
      try {
        // Get order items
        const { data: orderItems, error: itemsError } = await s
          .from('order_items')
          .select('id, order_id, product_id, name, quantity, unit_price_cents, line_total_cents')
          .eq('order_id', id);
          
        if (itemsError) {
          throw new Error(`Failed to fetch order items: ${itemsError.message}`);
        }
        
        if (!orderItems || orderItems.length === 0) {
          console.log(`⚠️ No items found for order ${id}`);
        } else {
          console.log(`📦 Processing ${orderItems.length} items with enhanced product mapping`);

          // Process each item using the enhanced matching system
          for (const item of orderItems) {
            try {
              console.log(`🔍 Processing item: ${item.name} (Qty: ${item.quantity})`);

              // Use the enhanced mapping function
              const { data: matchResult, error: matchError } = await s
                .rpc('find_product_match', { order_product_name: item.name });

              if (matchError) {
                console.error(`❌ Matching failed for ${item.name}:`, matchError);
                stockProcessingResults.errors.push(`Matching failed: ${item.name} - ${matchError.message}`);
                stockProcessingResults.itemsFailed++;
                continue;
              }

              if (!matchResult || !matchResult[0]?.found) {
                console.error(`❌ No product match found for: ${item.name}`);
                stockProcessingResults.errors.push(`No match found: ${item.name}`);
                stockProcessingResults.itemsFailed++;
                continue;
              }

              const match = matchResult[0];
              const productId = match.product_id;
              const productName = match.product_name;
              const method = match.method;
              const confidence = match.confidence;

              console.log(`✅ Match found: "${item.name}" -> "${productName}" (${method}, ${(confidence * 100).toFixed(1)}% confidence)`);

              // Check current stock
              const { data: currentStock } = await s
                .from('products')
                .select('stock, stock_qty')
                .eq('id', productId)
                .single();

              if (!currentStock) {
                console.error(`❌ Could not retrieve stock for product: ${productName}`);
                stockProcessingResults.errors.push(`Stock check failed: ${productName}`);
                stockProcessingResults.itemsFailed++;
                continue;
              }

              const currentStockLevel = currentStock.stock_qty || currentStock.stock || 0;
              
              if (currentStockLevel < item.quantity) {
                const errorMsg = `Insufficient stock for ${productName}: have ${currentStockLevel}, need ${item.quantity}`;
                console.error(`❌ ${errorMsg}`);
                stockProcessingResults.errors.push(errorMsg);
                stockProcessingResults.itemsFailed++;
                continue;
              }

              // Deduct stock
              const newStockLevel = currentStockLevel - item.quantity;

              const { error: updateError } = await s
                .from('products')
                .update({
                  stock: newStockLevel,
                  stock_qty: newStockLevel,
                  updated_at: new Date().toISOString()
                })
                .eq('id', productId);

              if (updateError) {
                console.error(`❌ Stock update failed for ${productName}:`, updateError);
                stockProcessingResults.errors.push(`Stock update failed: ${productName} - ${updateError.message}`);
                stockProcessingResults.itemsFailed++;
                continue;
              }

              // Create detailed stock movement
              const { data: orderData } = await s
                .from('orders')
                .select('order_number')
                .eq('id', id)
                .single();

              await s.from('stock_movements').insert({
                product_id: productId,
                movement_type: 'sale',
                quantity: -item.quantity,
                order_id: id,
                order_item_id: item.id,
                matching_method: method,
                confidence_score: confidence,
                notes: `Order ${orderData?.order_number || id} - "${item.name}" matched to "${productName}" via ${method} (${(confidence * 100).toFixed(1)}% confidence)`,
                created_at: new Date().toISOString()
              });

              console.log(`✅ Stock deducted: ${productName} (-${item.quantity}, new stock: ${newStockLevel}) via ${method}`);
              stockProcessingResults.itemsSuccessful++;
              stockProcessingResults.itemsProcessed++;

            } catch (itemError) {
              const errorMsg = `Error processing item ${item.id} (${item.name}): ${itemError.message}`;
              console.error(`❌ ${errorMsg}`, itemError);
              stockProcessingResults.errors.push(errorMsg);
              stockProcessingResults.itemsFailed++;
            }
          }

          // Update analytics if we had successful stock deductions
          if (stockProcessingResults.itemsSuccessful > 0) {
            try {
              console.log(`📊 Updating sales analytics for order ${id}...`);

              // Get order details for analytics
              const { data: orderForAnalytics } = await s
                .from('orders')
                .select('id, order_number, created_at, total_cents')
                .eq('id', id)
                .single();

              if (orderForAnalytics) {
                const { data: itemsForAnalytics } = await s
                  .from('order_items')
                  .select('name, quantity, line_total_cents')
                  .eq('order_id', id);

                if (itemsForAnalytics && itemsForAnalytics.length > 0) {
                  // Update daily sales
                  const orderDate = new Date(orderForAnalytics.created_at).toISOString().split('T')[0];
                  const totalRevenue = itemsForAnalytics.reduce((sum, item) => sum + (item.line_total_cents || 0), 0);
                  const totalUnits = itemsForAnalytics.reduce((sum, item) => sum + (item.quantity || 0), 0);

                  await s.from('daily_sales').upsert({
                    date: orderDate,
                    total_sales_cents: totalRevenue,
                    total_orders: 1,
                    total_items_sold: totalUnits,
                    updated_at: new Date().toISOString()
                  }, {
                    onConflict: 'date'
                  });

                  // Update product sales stats
                  const productSales = new Map();
                  
                  for (const item of itemsForAnalytics) {
                    const productName = item.name;
                    if (!productSales.has(productName)) {
                      productSales.set(productName, {
                        name: productName,
                        quantity: 0,
                        revenue: 0,
                        orders: new Set()
                      });
                    }
                    
                    const stats = productSales.get(productName);
                    stats.quantity += item.quantity || 0;
                    stats.revenue += item.line_total_cents || 0;
                    stats.orders.add(id);
                  }

                  // Insert/update each product's stats
                  for (const [productName, stats] of productSales.entries()) {
                    await s.from('product_sales_stats').upsert({
                      product_name: productName,
                      total_quantity_sold: stats.quantity,
                      total_revenue_cents: stats.revenue,
                      order_count: stats.orders.size,
                      last_sold_at: new Date().toISOString(),
                      updated_at: new Date().toISOString()
                    }, {
                      onConflict: 'product_name'
                    });
                  }

                  stockProcessingResults.analyticsUpdated = true;
                  console.log(`✅ Analytics updated: ${productSales.size} products, R${totalRevenue/100}, ${totalUnits} units`);
                }
              }
            } catch (analyticsError) {
              console.error(`❌ Analytics update failed for order ${id}:`, analyticsError);
              stockProcessingResults.errors.push(`Analytics failed: ${analyticsError.message}`);
            }
          }

          stockProcessingResults.stockDeducted = stockProcessingResults.itemsSuccessful > 0;
          console.log(`✅ Enhanced processing complete: ${stockProcessingResults.itemsSuccessful}/${orderItems.length} successful`);

        }
      } catch (processingError) {
        console.error(`❌ Order processing failed for ${id}:`, processingError);
        stockProcessingResults.errors.push(`Processing failed: ${processingError.message}`);
      }
    }

    // 6. CRITICAL: Send status-specific webhook notifications
    console.log(`📡 Sending webhook notifications for order ${id} status change: ${currentStatus} -> ${status}`);
    
    let webhookCalled = false;
    let webhookOk = false;
    let webhookError = null;
    let webhookUrl = null;

    try {
      // Get comprehensive order details for webhook
      console.log(`📡 Fetching order data for webhook...`);
      const { data: fullOrderData, error: webhookOrderError } = await s
        .from('orders')
        .select(`
          id, order_number, buyer_name, buyer_email, buyer_phone, buyer_address,
          shipping_address, delivery_address, status, fulfillment_type, 
          total_cents, subtotal_cents, shipping_cents, discount_cents, 
          created_at, paid_at, order_packed_at, order_out_for_delivery_at,
          order_collected_at, order_delivered_at, notes
        `)
        .eq('id', id)
        .single();

      console.log(`📡 Webhook order fetch result:`, { fullOrderData, webhookOrderError });

      if (webhookOrderError) {
        console.error(`❌ Failed to fetch order data for webhook:`, webhookOrderError);
        throw new Error(`Webhook order fetch failed: ${webhookOrderError.message}`);
      }

      if (!fullOrderData) {
        console.error(`❌ No order data found for webhook`);
        throw new Error('Order data not found for webhook');
      }

      const { data: orderItems, error: itemsFetchError } = await s
        .from('order_items')
        .select('name, product_name, quantity, unit_price_cents, line_total_cents, variant, sku')
        .eq('order_id', id);

      console.log(`📡 Order items fetch result:`, { orderItems, itemsFetchError });

      // Determine webhook URL based on status transition
      const webhookEndpoints = {
        'ready_for_collection': 'https://dockerfile-1n82.onrender.com/webhook/ready-for-collection',
        'ready_for_delivery': 'https://dockerfile-1n82.onrender.com/webhook/ready-for-delivery',
        'out_for_delivery': 'https://dockerfile-1n82.onrender.com/webhook/out-for-delivery'
      };

      // Map status to webhook endpoint
      if (status === 'packed' && fullOrderData.fulfillment_type === 'collection') {
        webhookUrl = webhookEndpoints.ready_for_collection;
      } else if (status === 'packed' && fullOrderData.fulfillment_type === 'delivery') {
        webhookUrl = webhookEndpoints.ready_for_delivery;
      } else if (status === 'out_for_delivery') {
        webhookUrl = webhookEndpoints.out_for_delivery;
      } else {
        console.log(`ℹ️ No specific webhook configured for status: ${status} (${fullOrderData.fulfillment_type})`);
        webhookCalled = false;
        webhookOk = true; // Not an error, just no webhook configured
      }

      if (webhookUrl) {
        // Comprehensive order data for webhook
        const orderData = {
          // Order identification
          order_id: fullOrderData.id,
          order_number: fullOrderData.order_number,
          
          // Customer contact information
          customer_name: fullOrderData.buyer_name,
          customer_email: fullOrderData.buyer_email,
          customer_phone: fullOrderData.buyer_phone,
          customer_address: fullOrderData.buyer_address,
          
          // Delivery information
          shipping_address: fullOrderData.shipping_address,
          delivery_address: fullOrderData.delivery_address,
          fulfillment_type: fullOrderData.fulfillment_type,
          
          // Order status and timing
          current_status: status,
          previous_status: currentStatus,
          status_changed_at: new Date().toISOString(),
          order_created_at: fullOrderData.created_at,
          paid_at: fullOrderData.paid_at,
          order_packed_at: fullOrderData.order_packed_at,
          order_out_for_delivery_at: fullOrderData.order_out_for_delivery_at,
          order_collected_at: fullOrderData.order_collected_at,
          order_delivered_at: fullOrderData.order_delivered_at,
          
          // Financial details
          total_cents: fullOrderData.total_cents,
          total_rands: (fullOrderData.total_cents || 0) / 100,
          subtotal_cents: fullOrderData.subtotal_cents,
          subtotal_rands: (fullOrderData.subtotal_cents || 0) / 100,
          shipping_cents: fullOrderData.shipping_cents,
          shipping_rands: (fullOrderData.shipping_cents || 0) / 100,
          discount_cents: fullOrderData.discount_cents,
          discount_rands: (fullOrderData.discount_cents || 0) / 100,
          
          // Order items
          order_items: (orderItems || []).map(item => ({
            name: item.name,
            product_name: item.product_name,
            quantity: item.quantity,
            unit_price_cents: item.unit_price_cents,
            unit_price_rands: (item.unit_price_cents || 0) / 100,
            line_total_cents: item.line_total_cents,
            line_total_rands: (item.line_total_cents || 0) / 100,
            variant: item.variant,
            sku: item.sku
          })),
          
          // Additional details
          notes: fullOrderData.notes,
          
          // System info
          webhook_endpoint: webhookUrl,
          system: 'BLOM-Admin',
          timestamp: new Date().toISOString()
        };

        console.log(`📡 Sending comprehensive webhook to: ${webhookUrl}`);
        console.log(`📦 Order ${fullOrderData.order_number} - ${fullOrderData.buyer_name} (${fullOrderData.buyer_email})`);
        console.log(`📍 ${fullOrderData.fulfillment_type} - Items: ${orderItems?.length || 0}, Total: R${(fullOrderData.total_cents || 0) / 100}`);

        const webhookResponse = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'BLOM-Admin/1.0',
            'X-Order-Status': status,
            'X-Fulfillment-Type': fullOrderData.fulfillment_type
          },
          body: JSON.stringify({
            event: 'order_status_changed',
            webhook_type: 'status_notification',
            timestamp: new Date().toISOString(),
            order: orderData
          })
        });

        webhookCalled = true;
        
        if (webhookResponse.ok) {
          webhookOk = true;
          console.log(`✅ Webhook sent successfully for order ${id} -> ${webhookUrl}`);
        } else {
          const errorText = await webhookResponse.text();
          webhookError = `HTTP ${webhookResponse.status}: ${errorText}`;
          console.error(`❌ Webhook failed for order ${id}:`, webhookError);
        }
      }

      // Send to additional notification webhook if configured
      const notificationUrl = process.env.NOTIFICATION_WEBHOOK_URL;
      if (notificationUrl) {
        try {
          const notificationResponse = await fetch(notificationUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'BLOM-Admin/1.0'
            },
            body: JSON.stringify({
              event: 'order_status_notification',
              timestamp: new Date().toISOString(),
              order_id: id,
              order_number: fullOrderData.order_number,
              customer_name: fullOrderData.buyer_name,
              customer_email: fullOrderData.buyer_email,
              status: status,
              fulfillment_type: fullOrderData.fulfillment_type,
              total_rands: (fullOrderData.total_cents || 0) / 100
            })
          });

          if (notificationResponse.ok) {
            console.log(`✅ Notification webhook sent for order ${id}`);
          } else {
            console.warn(`⚠️ Notification webhook failed for order ${id}: HTTP ${notificationResponse.status}`);
          }
        } catch (notifError) {
          console.warn(`⚠️ Notification webhook error for order ${id}:`, notifError.message);
        }
      }

    } catch (webhookErr) {
      webhookError = webhookErr.message;
      console.error(`❌ Webhook system error for order ${id}:`, webhookErr.message);
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ 
        ok: true, 
        order: updateResult,
        updateMethod,
        webhook: { called: webhookCalled, ok: webhookOk, error: webhookError },
        stockProcessing: stockProcessingResults,
        statusChange: {
          from: currentStatus,
          to: status,
          timestamp: now
        },
        debug: {
          orderId: id,
          orderNumber: order.order_number,
          updateSuccess: true,
          webhookCalled: webhookCalled,
          webhookOk: webhookOk
        }
      })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
};