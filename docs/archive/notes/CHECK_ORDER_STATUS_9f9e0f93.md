# SQL QUERY: Check Order Status for ID 9f9e0f93-e380-4756-ae78-ff08a22cc7c9

Copy and run this SQL in your Supabase SQL Editor to check the order status:

```sql
-- CHECK ORDER STATUS FOR SPECIFIC ORDER ID
-- Order ID: 9f9e0f93-e380-4756-ae78-ff08a22cc7c9

-- 1. MAIN ORDER STATUS CHECK
SELECT 
    o.id,
    o.order_number,
    o.reference,
    o.status,
    o.payment_status,
    o.created_at,
    o.updated_at,
    o.paid_at,
    o.order_packed_at,
    o.order_out_for_delivery_at,
    o.order_collected_at,
    o.order_delivered_at,
    o.fulfilled_at,
    o.total_amount,
    o.total_cents,
    o.customer_name,
    o.customer_email,
    o.buyer_name,
    o.buyer_email,
    o.fulfillment_type,
    CASE 
        WHEN o.updated_at >= NOW() - INTERVAL '1 hour' THEN 'RECENTLY UPDATED'
        WHEN o.updated_at >= NOW() - INTERVAL '1 day' THEN 'UPDATED TODAY'
        ELSE 'NOT RECENTLY UPDATED'
    END as update_status
FROM orders o
WHERE o.id = '9f9e0f93-e380-4756-ae78-ff08a22cc7c9';

-- 2. ORDER TIMELINE STATUS
SELECT 
    'ORDER_TIMELINE' as check_type,
    o.id,
    o.status as current_status,
    o.created_at as order_created,
    o.paid_at as payment_confirmed,
    o.order_packed_at as packed_timestamp,
    o.order_out_for_delivery_at as delivery_timestamp,
    o.order_collected_at as collected_timestamp,
    o.order_delivered_at as delivered_timestamp,
    EXTRACT(EPOCH FROM (NOW() - COALESCE(o.updated_at, o.created_at)))/3600 as hours_since_update
FROM orders o
WHERE o.id = '9f9e0f93-e380-4756-ae78-ff08a22cc7c9';

-- 3. ORDER ITEMS INFORMATION
SELECT 
    'ORDER_ITEMS' as check_type,
    oi.id as item_id,
    oi.product_id,
    oi.variant_id,
    oi.name as item_name,
    oi.quantity,
    oi.unit_price_cents,
    oi.line_total_cents,
    oi.created_at as item_created
FROM orders o
LEFT JOIN order_items oi ON o.id = oi.order_id
WHERE o.id = '9f9e0f93-e380-4756-ae78-ff08a22cc7c9'
ORDER BY oi.created_at;

-- 4. RECENT STATUS CHANGES (if any audit logs exist)
SELECT 
    'STATUS_HISTORY' as check_type,
    o.id,
    o.status as current_status,
    o.updated_at as last_update,
    o.order_packed_at,
    o.order_out_for_delivery_at,
    o.order_collected_at,
    o.order_delivered_at,
    -- Calculate status progression
    CASE 
        WHEN o.order_packed_at IS NOT NULL THEN 'PACKED_STAGE_REACHED'
        ELSE 'PACKED_STAGE_NOT_REACHED'
    END as packed_status,
    CASE 
        WHEN o.order_out_for_delivery_at IS NOT NULL THEN 'DELIVERY_STAGE_REACHED'
        WHEN o.fulfillment_type = 'collection' AND o.order_collected_at IS NOT NULL THEN 'COLLECTION_STAGE_REACHED'
        ELSE 'DELIVERY/COLLECTION_STAGE_NOT_REACHED'
    END as fulfillment_status
FROM orders o
WHERE o.id = '9f9e0f93-e380-4756-ae78-ff08a22cc7c9';

-- 5. STATUS UPDATE FUNCTION TEST
-- Test if the RPC function can update this order
DO $$
DECLARE
    test_order_id UUID := '9f9e0f93-e380-4756-ae78-ff08a22cc7c9'::UUID;
    current_status TEXT;
    test_result RECORD;
BEGIN
    -- Get current status
    SELECT status INTO current_status FROM orders WHERE id = test_order_id;
    
    RAISE NOTICE '🔍 ORDER STATUS CHECK: %', test_order_id;
    RAISE NOTICE '📊 Current status: %', current_status;
    
    IF current_status IS NULL THEN
        RAISE NOTICE '❌ Order not found!';
    ELSE
        RAISE NOTICE '✅ Order found with status: %', current_status;
        
        -- Show detailed timeline
        SELECT 
            id,
            status,
            created_at,
            paid_at,
            order_packed_at,
            order_out_for_delivery_at,
            order_collected_at,
            order_delivered_at,
            updated_at
        INTO test_result
        FROM orders 
        WHERE id = test_order_id;
        
        RAISE NOTICE '📅 ORDER TIMELINE:';
        RAISE NOTICE '   Created: %', test_result.created_at;
        RAISE NOTICE '   Paid: %', test_result.paid_at;
        RAISE NOTICE '   Packed: %', test_result.order_packed_at;
        RAISE NOTICE '   Out for Delivery: %', test_result.order_out_for_delivery_at;
        RAISE NOTICE '   Collected: %', test_result.order_collected_at;
        RAISE NOTICE '   Delivered: %', test_result.order_delivered_at;
        RAISE NOTICE '   Last Updated: %', test_result.updated_at;
    END IF;
END $$;

-- 6. COMPARISON: RECENT SIMILAR ORDERS
SELECT 
    'COMPARISON_ORDERS' as check_type,
    o.id,
    o.order_number,
    o.status,
    o.fulfillment_type,
    o.created_at,
    o.updated_at,
    EXTRACT(EPOCH FROM (NOW() - o.updated_at))/3600 as hours_ago
FROM orders o
WHERE o.fulfillment_type = (
    SELECT fulfillment_type 
    FROM orders 
    WHERE id = '9f9e0f93-e380-4756-ae78-ff08a22cc7c9'
)
AND o.created_at >= NOW() - INTERVAL '7 days'
ORDER BY o.updated_at DESC
LIMIT 5;
```

## 🎯 WHAT THIS QUERY SHOWS

1. **Current Status**: The exact status of order 9f9e0f93-e380-4756-ae78-ff08a22cc7c9
2. **Timeline**: When each status change happened (paid, packed, delivered, etc.)
3. **Order Items**: What products are in this order
4. **Recent Updates**: Whether the order was recently modified
5. **Function Test**: Check if the RPC function can access this order
6. **Comparison**: Similar recent orders for context

## 📋 EXPECTED RESULTS

- **Status Field**: Current status (paid, packed, out_for_delivery, delivered, etc.)
- **Timestamps**: When each status change occurred
- **Update Status**: How recently the order was modified
- **Items**: Products in the order
- **Function Test**: Confirmation that the order can be accessed by the RPC function

Run this SQL and share the results to see the complete status of order 9f9e0f93-e380-4756-ae78-ff08a22cc7c9!