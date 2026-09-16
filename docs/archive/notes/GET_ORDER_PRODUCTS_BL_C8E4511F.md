# SQL QUERY: FIND ORDER AND PRODUCTS FOR "BL-C8E4511F"

Copy and run this SQL in your Supabase SQL Editor to find the order and its products:

```sql
-- QUERY TO FIND ORDER AND PRODUCTS FOR REFERENCE "BL-C8E4511F"
-- This will help us understand the order structure and product details

-- 1. FIND THE ORDER BY REFERENCE
SELECT 
    o.id as order_uuid,
    o.order_number,
    o.reference,
    o.status,
    o.created_at,
    o.updated_at,
    o.total_amount,
    o.customer_email,
    o.customer_name,
    CASE 
        WHEN o.id IS NOT NULL THEN 'ORDER FOUND'
        ELSE 'ORDER NOT FOUND'
    END as search_result
FROM orders o
WHERE o.order_number ILIKE '%BL-C8E4511F%'
   OR o.reference ILIKE '%BL-C8E4511F%'
   OR o.id::text ILIKE '%BL-C8E4511F%'
LIMIT 5;

-- 2. IF ORDER FOUND, GET ORDER ITEMS WITH PRODUCTS
DO $$
DECLARE
    found_order_id UUID;
    order_ref TEXT := 'BL-C8E4511F';
BEGIN
    -- Try to find the order
    SELECT o.id INTO found_order_id
    FROM orders o
    WHERE o.order_number ILIKE '%' || order_ref || '%'
       OR o.reference ILIKE '%' || order_ref || '%'
       OR o.id::text ILIKE '%' || order_ref || '%'
    LIMIT 1;
    
    IF found_order_id IS NOT NULL THEN
        RAISE NOTICE '✅ ORDER FOUND: %', found_order_id;
        
        RAISE NOTICE '📦 ORDER ITEMS AND PRODUCTS:';
        
        -- Get order items with product details
        SELECT 
            oi.id as order_item_id,
            oi.product_id,
            oi.variant_id,
            oi.quantity,
            oi.unit_price,
            oi.total_price,
            p.name as product_name,
            p.description as product_description,
            p.price as product_price,
            p.sku as product_sku,
            v.name as variant_name,
            v.price as variant_price,
            v.sku as variant_sku,
            v.stock_quantity as variant_stock
        FROM order_items oi
        LEFT JOIN products p ON oi.product_id = p.id
        LEFT JOIN product_variants v ON oi.variant_id = v.id
        WHERE oi.order_id = found_order_id
        ORDER BY oi.id;
        
    ELSE
        RAISE NOTICE '❌ ORDER NOT FOUND for reference: %', order_ref;
        
        -- Show some recent orders for reference
        RAISE NOTICE '📋 RECENT ORDERS FOR REFERENCE:';
        SELECT 
            o.order_number,
            o.reference,
            o.status,
            o.created_at,
            o.customer_email
        FROM orders o
        ORDER BY o.created_at DESC
        LIMIT 10;
    END IF;
END $$;

-- 3. COMPLETE ORDER SUMMARY IF FOUND
DO $$
DECLARE
    found_order_id UUID;
    order_ref TEXT := 'BL-C8E4511F';
BEGIN
    SELECT o.id INTO found_order_id
    FROM orders o
    WHERE o.order_number ILIKE '%' || order_ref || '%'
       OR o.reference ILIKE '%' || order_ref || '%'
    LIMIT 1;
    
    IF found_order_id IS NOT NULL THEN
        RAISE NOTICE '🎯 COMPLETE ORDER ANALYSIS FOR: %', found_order_id;
        
        -- Order Summary
        SELECT 
            'ORDER_SUMMARY' as section,
            o.id as order_uuid,
            o.order_number,
            o.reference,
            o.status,
            o.total_amount,
            o.customer_email,
            o.customer_name,
            o.created_at,
            EXTRACT(EPOCH FROM (NOW() - o.created_at))/3600 as hours_ago,
            o.order_packed_at IS NOT NULL as has_packed_timestamp,
            o.order_out_for_delivery_at IS NOT NULL as has_delivery_timestamp,
            o.fulfilled_at IS NOT NULL as has_fulfilled_timestamp
        FROM orders o
        WHERE o.id = found_order_id;
        
        -- Product Summary
        RAISE NOTICE '📦 PRODUCTS IN ORDER:';
        SELECT 
            'PRODUCT_SUMMARY' as section,
            COUNT(*) as total_items,
            SUM(oi.quantity) as total_quantity,
            SUM(oi.total_price) as items_total
        FROM order_items oi
        WHERE oi.order_id = found_order_id;
        
    END IF;
END $$;
```

## 🎯 WHAT THIS QUERY WILL SHOW

1. **Order Found**: The exact order details for "BL-C8E4511F"
2. **Products**: All products/items in this order with full details
3. **Order Status**: Current status and timestamps
4. **Customer Info**: Email and name if available
5. **Order Summary**: Complete analysis of the order

## 📋 EXPECTED OUTPUT

- ✅ Order UUID and details
- 📦 List of all products in the order
- 💰 Pricing and quantities
- 📅 Order timeline (created, packed, delivered timestamps)
- 👤 Customer information

Run this query and share the results to help us understand the order structure!