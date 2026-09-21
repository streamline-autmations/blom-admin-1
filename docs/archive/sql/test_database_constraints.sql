-- Test Database Constraints - Step by Step
-- Let's isolate exactly what's blocking the status update

-- Step 1: Try updating other fields to confirm basic updates work
UPDATE orders 
SET 
    updated_at = NOW()
WHERE id = '9f9e0f93-e380-4756-ae78-ff08a22cc7c9';

-- Step 2: Try updating shipping_status (should work if constraint allows it)
UPDATE orders 
SET 
    shipping_status = 'pending'
WHERE id = '9f9e0f93-e380-4756-ae78-ff08a22cc7c9';

-- Step 3: Try the RPC function (should bypass some constraints)
SELECT update_order_status('9f9e0f93-e380-4756-ae78-ff08a22cc7c9', 'packed');

-- Step 4: Try updating status via the admin-order Netlify function
-- (This would be through the API endpoint)

-- Step 5: Check what the actual constraint definition is
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'orders'::regclass 
    AND contype = 'c';

-- Step 6: See current status with full details
SELECT 
    id,
    status,
    status::text as status_exact,
    shipping_status,
    order_packed_at,
    updated_at,
    created_at,
    -- Show row version to detect updates
    xmin as row_version
FROM orders 
WHERE id = '9f9e0f93-e380-4756-ae78-ff08a22cc7c9';

-- Step 7: Test if we can insert a new order with "packed" status
-- (This will tell us if the constraint allows the value at all)
DO $$
DECLARE
    test_order_id UUID;
BEGIN
    -- Create a test order with packed status
    INSERT INTO orders (
        id, 
        status, 
        fulfillment_type, 
        created_at, 
        updated_at
    ) VALUES (
        gen_random_uuid(),
        'packed',
        'delivery',
        NOW(),
        NOW()
    ) RETURNING id INTO test_order_id;
    
    RAISE NOTICE '✅ Test order created with status "packed": %', test_order_id;
    
    -- Clean up the test order
    DELETE FROM orders WHERE id = test_order_id;
    RAISE NOTICE '🧹 Test order cleaned up';
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ Failed to create test order with "packed" status: %', SQLERRM;
END $$;