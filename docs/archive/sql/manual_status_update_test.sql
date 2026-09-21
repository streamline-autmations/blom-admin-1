-- Manual Status Update Test
-- Update the specific order to test if UI will reflect the change

-- Update the order status directly to see if UI updates
UPDATE orders 
SET 
    status = 'packed',
    order_packed_at = NOW(),
    updated_at = NOW()
WHERE id = '9f9e0f93-e380-4756-ae78-ff08a22cc7c9';

-- Verify the update worked
SELECT 
    id,
    status,
    shipping_status,
    order_packed_at,
    updated_at,
    fulfillment_type,
    CASE 
        WHEN status = 'packed' THEN '✅ STATUS UPDATED: Should show PACKED in UI'
        ELSE '❌ STATUS NOT UPDATED: Will still show as previous status'
    END as ui_expectation
FROM orders 
WHERE id = '9f9e0f93-e380-4756-ae78-ff08a22cc7c9';

-- If you want to reset it back to paid for testing:
-- UPDATE orders 
-- SET 
--     status = 'paid',
--     order_packed_at = NULL,
--     updated_at = NOW()
-- WHERE id = '9f9e0f93-e380-4756-ae78-ff08a22cc7c9';