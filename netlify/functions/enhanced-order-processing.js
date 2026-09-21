import { createClient } from "@supabase/supabase-js";
import { withAdminAuth } from "./_lib/admin-auth.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// Enhanced Order Processing: Stock Deduction + Sales Analytics Update
const baseHandler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { 
      statusCode: 405, 
      headers: { "Content-Type": "application/json" }, 
      body: "Method Not Allowed" 
    };
  }

  try {
    const { orderId, status, force } = JSON.parse(event.body || "{}");
    
    if (!orderId || !status) {
      throw new Error("Missing orderId or status");
    }

    console.log(`🔄 Enhanced order processing: Order ${orderId} -> Status ${status}`);

    // Get current order
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      throw new Error(`Order not found: ${orderError?.message}`);
    }

    const currentStatus = order.status;
    const now = new Date().toISOString();

    // Prepare update patch
    const updatePatch = {
      status,
      updated_at: now,
    };

    // Add status-specific timestamps
    if (status === 'paid') updatePatch.paid_at = now;
    if (status === 'packed') updatePatch.order_packed_at = now;
    if (status === 'out_for_delivery') updatePatch.order_out_for_delivery_at = now;
    if (status === 'collected' || status === 'delivered') {
      updatePatch.fulfilled_at = now;
    }

    console.log(`📤 Updating order ${orderId} from ${currentStatus} to ${status}`);

    // Update order status
    const { data: updatedOrder, error: updateError } = await supabase
      .from("orders")
      .update(updatePatch)
      .eq("id", orderId)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Order update failed: ${updateError.message}`);
    }

    console.log(`✅ Order ${orderId} status updated successfully`);

    let results = {
      orderUpdated: true,
      stockDeducted: false,
      analyticsUpdated: false,
      errors: []
    };

    // CRITICAL: Process stock deduction and analytics when order becomes "paid"
    if ((status === 'paid' && currentStatus !== 'paid') || force) {
      console.log(`💰 Processing paid order: Stock deduction + Analytics update`);

      try {
        // Get order items with product information
        const { data: orderItems, error: itemsError } = await supabase
          .from('order_items')
          .select(`
            id, name, quantity, unit_price_cents, line_total_cents,
            product_id, sku, variant
          `)
          .eq('order_id', orderId);

        if (itemsError) {
          results.errors.push(`Failed to fetch order items: ${itemsError.message}`);
          throw itemsError;
        }

        if (!orderItems || orderItems.length === 0) {
          console.log(`⚠️ No items found for order ${orderId}`);
        } else {
          console.log(`📦 Processing ${orderItems.length} items for order ${orderId}`);

          let stockDeductionCount = 0;
          let analyticsData = {
            totalRevenue: 0,
            totalUnits: 0,
            productSales: new Map()
          };

          // Process each item
          for (const item of orderItems) {
            try {
              console.log(`🔍 Processing item: ${item.name} (Qty: ${item.quantity})`);

              // 1. CALL THE SMART DB FUNCTION
              // This attempts Dictionary Match -> Exact Match -> Fuzzy Match in one go
              const { data: matchResult, error: matchError } = await supabase
                .rpc('find_product_match', { order_product_name: item.name });

              let product = null;
              let matchMethod = 'failed';

              if (!matchError && matchResult && matchResult.length > 0 && matchResult[0].found) {
                 const match = matchResult[0];
                 console.log(`✅ Database matched "${item.name}" to "${match.product_name}" (Method: ${match.method})`);
                 
                 // Fetch full product details to get stock levels
                 const { data: fullProduct } = await supabase
                    .from('products')
                    .select('id, name, stock, stock_qty, is_active')
                    .eq('id', match.product_id)
                    .single();
                    
                 product = fullProduct;
                 matchMethod = match.method;
              }

              // 2. Fallback: Try Variant ID matching if DB match failed but we have variant info
              if (!product && item.variant) {
                  console.log(`🔍 Trying variant fallback: ${item.variant}`);
                  const { data: variantProducts } = await supabase
                    .from('products')
                    .select('id, name, stock, stock_qty, is_active, variant_name')
                    .eq('is_active', true)
                    .not('variant_name', 'is', null);

                  if (variantProducts) {
                    const variantMatch = variantProducts.find(p => 
                      p.variant_name?.toLowerCase().includes(item.variant.toLowerCase())
                    );
                    if (variantMatch) {
                      product = variantMatch;
                      matchMethod = 'variant_fallback';
                      console.log(`✅ Found product by variant fallback: ${product.name}`);
                    }
                  }
              }

              if (!product) {
                results.errors.push(`Product not found for item: ${item.name}`);
                // CRITICAL: Log this failure to the mapping table so you can fix it later
                console.log(`⚠️ Auto-creating mapping entry for: ${item.name}`);
                // Optional: Insert into a 'missing_mappings' table
                try {
                  await supabase
                    .from('missing_mappings')
                    .upsert({
                      order_product_name: item.name,
                      order_sku: item.sku,
                      order_variant: item.variant,
                      last_seen_at: now,
                      created_at: now
                    }, {
                      onConflict: 'order_product_name'
                    });
                } catch (logError) {
                  console.warn(`Failed to log missing mapping for ${item.name}:`, logError.message);
                }
                continue;
              }

              // Stock deduction logic
              const currentStock = product.stock_qty || product.stock || 0;
              const requiredQuantity = item.quantity || 1;

              if (currentStock < requiredQuantity) {
                results.errors.push(`Insufficient stock for ${product.name}: need ${requiredQuantity}, have ${currentStock}`);
                console.error(`❌ Insufficient stock for ${product.name}: need ${requiredQuantity}, have ${currentStock}`);
                continue;
              }

              const newStock = currentStock - requiredQuantity;

              // Update stock
              const { error: stockUpdateError } = await supabase
                .from('products')
                .update({ 
                  stock: newStock,
                  stock_qty: newStock,
                  updated_at: now
                })
                .eq('id', product.id);

              if (stockUpdateError) {
                results.errors.push(`Stock update failed for ${product.name}: ${stockUpdateError.message}`);
                console.error(`❌ Stock update failed for ${product.name}:`, stockUpdateError);
                continue;
              }

              // Log stock movement
              await supabase.from('stock_movements').insert({
                product_id: product.id,
                movement_type: 'sale',
                quantity: -requiredQuantity,
                order_id: orderId,
                notes: `Stock deducted via ${matchMethod} matching - Order ${order.order_number}`,
                created_at: now
              });

              console.log(`✅ Stock deducted: ${product.name} (-${requiredQuantity}, new stock: ${newStock})`);
              stockDeductionCount++;

              // Prepare analytics data
              analyticsData.totalRevenue += item.line_total_cents || 0;
              analyticsData.totalUnits += requiredQuantity;
              
              const productKey = product.name;
              if (!analyticsData.productSales.has(productKey)) {
                analyticsData.productSales.set(productKey, {
                  name: product.name,
                  quantity: 0,
                  revenue: 0,
                  orders: new Set()
                });
              }
              
              const productStats = analyticsData.productSales.get(productKey);
              productStats.quantity += requiredQuantity;
              productStats.revenue += item.line_total_cents || 0;
              productStats.orders.add(orderId);

            } catch (itemError) {
              const errorMsg = `Error processing item ${item.id}: ${itemError.message}`;
              results.errors.push(errorMsg);
              console.error(`❌ ${errorMsg}`, itemError);
            }
          }

          // Update analytics tables
          if (analyticsData.totalRevenue > 0 || analyticsData.totalUnits > 0) {
            try {
              console.log(`📊 Updating sales analytics...`);

              // Update daily sales summary
              const orderDate = new Date(order.created_at).toISOString().split('T')[0];
              
              const { error: salesError } = await supabase
                .from('daily_sales')
                .upsert({
                  date: orderDate,
                  total_sales_cents: analyticsData.totalRevenue,
                  total_orders: 1,
                  total_items_sold: analyticsData.totalUnits,
                  updated_at: now
                }, {
                  onConflict: 'date'
                });

              if (salesError) {
                console.error('❌ Failed to update daily sales:', salesError);
                results.errors.push(`Daily sales update failed: ${salesError.message}`);
              }

              // Update best selling products
              for (const [productName, stats] of analyticsData.productSales.entries()) {
                const { error: productError } = await supabase
                  .from('product_sales_stats')
                  .upsert({
                    product_name: productName,
                    total_quantity_sold: stats.quantity,
                    total_revenue_cents: stats.revenue,
                    order_count: stats.orders.size,
                    last_sold_at: now,
                    updated_at: now
                  }, {
                    onConflict: 'product_name'
                  });

                if (productError) {
                  console.error(`❌ Failed to update product stats for ${productName}:`, productError);
                  results.errors.push(`Product stats update failed for ${productName}: ${productError.message}`);
                } else {
                  console.log(`📈 Updated product analytics: ${productName} (${stats.quantity} units, R${stats.revenue/100})`);
                }
              }

              console.log(`✅ Analytics updated for ${analyticsData.productSales.size} products`);
              results.analyticsUpdated = true;

            } catch (analyticsError) {
              results.errors.push(`Analytics update failed: ${analyticsError.message}`);
              console.error(`❌ Analytics update failed:`, analyticsError);
            }
          }

          results.stockDeducted = stockDeductionCount > 0;
          console.log(`✅ Stock processing complete: ${stockDeductionCount}/${orderItems.length} items processed`);

        }
      } catch (processingError) {
        results.errors.push(`Order processing failed: ${processingError.message}`);
        console.error(`❌ Order processing failed for ${orderId}:`, processingError);
      }
    }

    // Send webhooks for status notifications
    let webhookResults = {
      called: false,
      success: false,
      error: null
    };

    try {
      webhookResults = await sendOrderWebhook(orderId, currentStatus, status, order);
    } catch (webhookError) {
      webhookResults.error = webhookError.message;
      console.warn(`⚠️ Webhook failed for order ${orderId}:`, webhookError);
    }

    return {
      statusCode: 200,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        ok: true,
        order: updatedOrder,
        processing: results,
        webhook: webhookResults,
        timestamp: now,
        message: `Order ${orderId} processed successfully`
      })
    };

  } catch (error) {
    console.error(`❌ Enhanced order processing failed:`, error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        ok: false,
        error: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};

// Helper function to send order status webhooks
async function sendOrderWebhook(orderId, fromStatus, toStatus, order) {
  const webhookEndpoints = {
    'ready_for_collection': process.env.COLLECTION_WEBHOOK_URL || 'https://your-collection-webhook.com',
    'ready_for_delivery': process.env.DELIVERY_WEBHOOK_URL || 'https://your-delivery-webhook.com',
    'out_for_delivery': process.env.OUT_FOR_DELIVERY_WEBHOOK_URL || 'https://your-out-for-delivery-webhook.com'
  };

  let webhookUrl = null;

  // Determine webhook URL based on status transition
  if (toStatus === 'packed' && order.fulfillment_type === 'collection') {
    webhookUrl = webhookEndpoints.ready_for_collection;
  } else if (toStatus === 'packed' && order.fulfillment_type === 'delivery') {
    webhookUrl = webhookEndpoints.ready_for_delivery;
  } else if (toStatus === 'out_for_delivery') {
    webhookUrl = webhookEndpoints.out_for_delivery;
  }

  if (!webhookUrl) {
    return { called: false, success: true, error: null }; // No webhook needed
  }

  try {
    const webhookPayload = {
      event: 'order_status_changed',
      timestamp: new Date().toISOString(),
      order: {
        id: order.id,
        order_number: order.order_number,
        customer_name: order.buyer_name,
        customer_email: order.buyer_email,
        status: toStatus,
        previous_status: fromStatus,
        fulfillment_type: order.fulfillment_type,
        total_rands: (order.total_cents || 0) / 100
      }
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'BLOM-Admin-Enhanced/1.0'
      },
      body: JSON.stringify(webhookPayload)
    });

    return {
      called: true,
      success: response.ok,
      error: response.ok ? null : `HTTP ${response.status}`
    };

  } catch (error) {
    return {
      called: true,
      success: false,
      error: error.message
    };
  }
}

export const handler = withAdminAuth(baseHandler);
