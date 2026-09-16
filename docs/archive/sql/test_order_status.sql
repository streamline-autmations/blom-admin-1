-- Quick SQL Test for Order Status Updates
-- Run this in your Supabase SQL editor to test the update_order_status function

-- 1. Find a test order (replace with actual order ID)
SELECT id, status, order_number 
FROM orders 
WHERE status = 'paid' 
LIMIT 1;

-- 2. Test the RPC function (replace ORDER_ID with actual ID)
-- SELECT * FROM update_order_status('ORDER-ID-HERE', 'packed');

-- 3. Verify the update worked
-- SELECT id, status, updated_at, order_packed_at 
-- FROM orders 
-- WHERE id = 'ORDER-ID-HERE';

-- 4. Reset the test order back to 'paid' if needed
-- UPDATE orders 
-- SET status = 'paid', updated_at = NOW(), order_packed_at = NULL 
-- WHERE id = 'ORDER-ID-HERE';