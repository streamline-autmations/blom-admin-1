-- Debug Script: Check Order Status Field Mapping
-- Run this to verify the status vs shipping_status issue

SELECT 
    id,
    status as main_status,
    shipping_status,
    fulfillment_type,
    order_packed_at,
    order_out_for_delivery_at,
    updated_at,
    -- Show the discrepancy
    CASE 
        WHEN status != COALESCE(shipping_status, 'pending') 
        THEN '⚠️ MISMATCH: Fields differ'
        ELSE '✅ CONSISTENT: Fields match'
    END as field_consistency,
    -- Show what UI will display
    CASE status
        WHEN 'paid' THEN '🟢 Will show as: PAID'
        WHEN 'packed' THEN '🔴 Will show as: PACKED' 
        WHEN 'out_for_delivery' THEN '🟠 Will show as: OUT FOR DELIVERY'
        WHEN 'delivered' THEN '✅ Will show as: DELIVERED'
        WHEN 'collected' THEN '✅ Will show as: COLLECTED'
        WHEN 'cancelled' THEN '❌ Will show as: CANCELLED'
        ELSE '❓ Will show as: UNKNOWN'
    END as ui_display_prediction
FROM orders 
ORDER BY updated_at DESC 
LIMIT 10;

-- Also check recent updates to see the pattern
SELECT 
    'Recent Status Updates' as analysis_type,
    status,
    shipping_status,
    COUNT(*) as order_count,
    MAX(updated_at) as last_update
FROM orders 
WHERE updated_at >= NOW() - INTERVAL '24 hours'
GROUP BY status, shipping_status
ORDER BY last_update DESC;