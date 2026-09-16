-- Investigate Status Constraints and Triggers
-- This will help us find what's blocking the status update

-- 1. Check all constraints on the orders table
SELECT 
    tc.constraint_name,
    tc.constraint_type,
    cc.check_clause
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.check_constraints cc 
    ON tc.constraint_name = cc.constraint_name
WHERE tc.table_name = 'orders'
ORDER BY tc.constraint_type, tc.constraint_name;

-- 2. Check if there are any triggers that might be interfering
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'orders'
ORDER BY trigger_name;

-- 3. Check RLS policies that might be blocking updates
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'orders'
ORDER BY policyname;

-- 4. Check what status values are actually allowed
SELECT 
    con.conname as constraint_name,
    pg_get_constraintdef(con.oid) as constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
WHERE rel.relname = 'orders'
    AND con.contype = 'c'  -- Check constraints only
ORDER BY con.conname;

-- 5. Test the RPC function that should handle status updates
SELECT update_order_status('9f9e0f93-e380-4756-ae78-ff08a22cc7c9', 'packed');

-- 6. Check current order details
SELECT 
    id,
    status,
    status::text as status_text,
    shipping_status,
    fulfillment_type,
    created_at,
    updated_at,
    order_packed_at
FROM orders 
WHERE id = '9f9e0f93-e380-4756-ae78-ff08a22cc7c9';

-- 7. Test if there are any database functions that might be blocking
SELECT 
    p.proname as function_name,
    p.prosecdef as security_definer,
    pg_get_function_arguments(p.oid) as arguments,
    pg_get_function_result(p.oid) as return_type
FROM pg_proc p
JOIN pg_class c ON p.pronamespace = c.oid
WHERE c.relname = 'orders'
    AND p.proname LIKE '%status%'
ORDER BY p.proname;