#!/usr/bin/env node

/**
 * Admin Stock Deduction Integration Test
 * 
 * This script verifies that the admin-order-status function properly deducts stock
 * when orders are marked as "paid" through the admin interface.
 * 
 * Test Flow:
 * 1. Create a test order with stock products
 * 2. Record initial stock levels
 * 3. Mark order as "paid" via admin-order-status function
 * 4. Verify stock was deducted correctly
 * 5. Verify stock movements were recorded
 */

import { createClient } from '@supabase/supabase-js';

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

console.log('🧪 Starting Admin Stock Deduction Integration Test...\n');

// Test configuration
let testOrderId = null;
let testProductId = null;
let initialStock = 0;

async function runTest() {
  try {
    // Step 1: Find or create a test product with stock
    console.log('📦 Step 1: Finding test product with stock...');
    const { data: products, error: productError } = await supabase
      .from('products')
      .select('id, name, stock, variants')
      .neq('stock', null)
      .gt('stock', 10)
      .limit(1);

    if (productError || !products || products.length === 0) {
      throw new Error('No suitable test product found. Need a product with stock > 10');
    }

    testProductId = products[0].id;
    initialStock = products[0].stock || 0;
    console.log(`✅ Found test product: ${products[0].name} (Stock: ${initialStock})`);

    // Step 2: Create a test order
    console.log('\n🛒 Step 2: Creating test order...');
    const testOrderData = {
      order_number: `TEST-${Date.now()}`,
      status: 'created',
      payment_status: 'unpaid',
      buyer_name: 'Test Customer',
      buyer_email: 'test@example.com',
      buyer_phone: '+27123456789',
      total_cents: 10000,
      subtotal_cents: 8000,
      shipping_cents: 2000,
      fulfillment_type: 'delivery'
    };

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert(testOrderData)
      .select()
      .single();

    if (orderError || !order) {
      throw new Error(`Failed to create test order: ${orderError.message}`);
    }

    testOrderId = order.id;
    console.log(`✅ Created test order: ${testOrderData.order_number} (ID: ${testOrderId})`);

    // Step 3: Add order item
    console.log('\n📝 Step 3: Adding order item...');
    const orderItemData = {
      order_id: testOrderId,
      product_id: testProductId,
      quantity: 2,
      name: 'Test Product',
      unit_price_cents: 4000,
      line_total_cents: 8000
    };

    const { data: orderItem, error: itemError } = await supabase
      .from('order_items')
      .insert(orderItemData)
      .select()
      .single();

    if (itemError || !orderItem) {
      throw new Error(`Failed to create order item: ${itemError.message}`);
    }

    console.log(`✅ Added order item: ${orderItemData.quantity}x ${orderItemData.name}`);

    // Step 4: Record stock before payment
    console.log('\n📊 Step 4: Recording stock before payment...');
    const { data: currentProduct, error: fetchError } = await supabase
      .from('products')
      .select('stock')
      .eq('id', testProductId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch current product stock: ${fetchError.message}`);
    }

    console.log(`📈 Stock before payment: ${currentProduct.stock}`);

    // Step 5: Mark order as paid via admin function
    console.log('\n💳 Step 5: Marking order as paid via admin-order-status function...');
    
    const response = await fetch('/.netlify/functions/admin-order-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: testOrderId,
        status: 'paid'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Admin order status function failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('📡 Admin function response:', result);

    if (!result.ok) {
      throw new Error(`Admin function returned error: ${result.error}`);
    }

    // Step 6: Verify stock was deducted
    console.log('\n🔍 Step 6: Verifying stock deduction...');
    
    // Wait a moment for database consistency
    await new Promise(resolve => setTimeout(resolve, 1000));

    const { data: updatedProduct, error: updateError } = await supabase
      .from('products')
      .select('stock')
      .eq('id', testProductId)
      .single();

    if (updateError) {
      throw new Error(`Failed to fetch updated product stock: ${updateError.message}`);
    }

    const expectedStock = initialStock - 2; // Should be reduced by order quantity
    const actualStock = updatedProduct.stock;

    console.log(`📉 Stock after payment: ${actualStock}`);
    console.log(`🎯 Expected stock: ${expectedStock}`);

    if (actualStock === expectedStock) {
      console.log('✅ Stock correctly deducted!');
    } else {
      throw new Error(`Stock deduction failed! Expected ${expectedStock}, got ${actualStock}`);
    }

    // Step 7: Verify stock movement was recorded
    console.log('\n📋 Step 7: Verifying stock movement records...');
    
    const { data: movements, error: movementError } = await supabase
      .from('stock_movements')
      .select('*')
      .eq('order_id', testOrderId)
      .order('created_at', { ascending: false });

    if (movementError) {
      throw new Error(`Failed to fetch stock movements: ${movementError.message}`);
    }

    if (!movements || movements.length === 0) {
      throw new Error('No stock movements recorded for the order!');
    }

    console.log(`📊 Stock movements found: ${movements.length}`);
    
    const saleMovement = movements.find(m => m.reason === 'order_fulfillment' && m.delta < 0);
    if (!saleMovement) {
      throw new Error('No order fulfillment stock movement found!');
    }

    console.log(`📝 Movement record: Delta ${saleMovement.delta}, Reason: ${saleMovement.reason}`);

    if (saleMovement.delta === -2) {
      console.log('✅ Stock movement correctly recorded!');
    } else {
      throw new Error(`Incorrect movement delta! Expected -2, got ${saleMovement.delta}`);
    }

    // Step 8: Test edge case - marking as paid again should not deduct stock twice
    console.log('\n🔄 Step 8: Testing double-payment protection...');
    
    const doubleResponse = await fetch('/.netlify/functions/admin-order-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: testOrderId,
        status: 'paid' // Mark as paid again
      })
    });

    const doubleResult = await doubleResponse.json();
    console.log('📡 Double-payment test response:', doubleResult);

    // Wait and check stock hasn't changed
    await new Promise(resolve => setTimeout(resolve, 1000));

    const { data: finalProduct } = await supabase
      .from('products')
      .select('stock')
      .eq('id', testProductId)
      .single();

    if (finalProduct.stock === actualStock) {
      console.log('✅ Double-payment protection working - stock unchanged');
    } else {
      console.log(`⚠️  Warning: Stock changed from ${actualStock} to ${finalProduct.stock} on second payment`);
    }

    // Cleanup
    console.log('\n🧹 Step 9: Cleaning up test data...');
    
    await supabase.from('order_items').delete().eq('order_id', testOrderId);
    await supabase.from('orders').delete().eq('id', testOrderId);
    
    console.log('✅ Test data cleaned up');

    // Final verification
    console.log('\n🎉 ALL TESTS PASSED!');
    console.log('\n📋 Summary:');
    console.log(`   • Test product: ${testProductId}`);
    console.log(`   • Initial stock: ${initialStock}`);
    console.log(`   • Stock after payment: ${actualStock}`);
    console.log(`   • Expected stock: ${expectedStock}`);
    console.log(`   • Stock movements recorded: ${movements.length}`);
    console.log(`   • Order ID: ${testOrderId}`);
    console.log('\n✅ Admin stock deduction is working correctly!');

  } catch (error) {
    console.error('\n❌ TEST FAILED!');
    console.error('Error:', error.message);
    
    // Cleanup on failure
    if (testOrderId) {
      try {
        await supabase.from('order_items').delete().eq('order_id', testOrderId);
        await supabase.from('orders').delete().eq('id', testOrderId);
        console.log('🧹 Cleaned up test data after failure');
      } catch (cleanupError) {
        console.error('⚠️  Failed to cleanup test data:', cleanupError.message);
      }
    }
    
    process.exit(1);
  }
}

// Run the test
runTest();