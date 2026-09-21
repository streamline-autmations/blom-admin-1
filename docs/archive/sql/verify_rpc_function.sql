-- Verify if update_order_status RPC function exists and test it
-- Run this in your Supabase SQL editor

-- 1. Check if the RPC function exists
SELECT 
    routine_name,
    routine_type,
    security_type,
    data_type
FROM information_schema.routines 
WHERE routine_name = 'update_order_status'
    AND routine_schema = 'public';

-- 2. If function exists, test it (replace ORDER_ID with actual ID)
-- SELECT * FROM update_order_status('ORDER-ID-HERE', 'packed');

-- 3. Check recent order updates to see if timestamps are working
SELECT 
    id,
    status,
    updated_at,
    order_packed_at,
    order_out_for_delivery_at,
    fulfilled_at
FROM orders 
WHERE updated_at > NOW() - INTERVAL '1 hour'
ORDER BY updated_at DESC
LIMIT 5;