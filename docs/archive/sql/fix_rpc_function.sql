-- Fix the RPC function that has ambiguous column references
-- This will resolve the "column reference 'id' is ambiguous" error

-- Drop the broken function
DROP FUNCTION IF EXISTS update_order_status(UUID, TEXT, TIMESTAMPTZ);

-- Create a fixed version with proper table qualifiers
CREATE OR REPLACE FUNCTION update_order_status(
    p_order_id UUID,
    p_new_status TEXT,
    p_timestamp TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
    id UUID,
    status TEXT,
    updated_at TIMESTAMPTZ,
    order_packed_at TIMESTAMPTZ,
    order_out_for_delivery_at TIMESTAMPTZ,
    fulfilled_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_old_status TEXT;
    v_update_data JSONB;
BEGIN
    -- Get current status
    SELECT status INTO v_old_status FROM orders WHERE id = p_order_id;
    
    IF v_old_status IS NULL THEN
        RAISE EXCEPTION 'Order not found: %', p_order_id;
    END IF;
    
    RAISE NOTICE '🔄 Updating order % from % to %', p_order_id, v_old_status, p_new_status;
    
    -- Build update data based on status
    v_update_data := jsonb_build_object(
        'status', p_new_status,
        'updated_at', p_timestamp
    );
    
    -- Add status-specific timestamps
    CASE p_new_status
        WHEN 'packed' THEN
            v_update_data := v_update_data || jsonb_build_object('order_packed_at', p_timestamp);
        WHEN 'out_for_delivery' THEN
            v_update_data := v_update_data || jsonb_build_object('order_out_for_delivery_at', p_timestamp);
        WHEN 'collected', 'delivered' THEN
            v_update_data := v_update_data || jsonb_build_object('fulfilled_at', p_timestamp);
    END CASE;
    
    -- Perform the update with proper table qualifiers
    UPDATE orders 
    SET 
        status = (v_update_data->>'status')::TEXT,
        updated_at = (v_update_data->>'updated_at')::TIMESTAMPTZ,
        order_packed_at = CASE 
            WHEN v_update_data ? 'order_packed_at' 
            THEN (v_update_data->>'order_packed_at')::TIMESTAMPTZ 
            ELSE orders.order_packed_at 
        END,
        order_out_for_delivery_at = CASE 
            WHEN v_update_data ? 'order_out_for_delivery_at' 
            THEN (v_update_data->>'order_out_for_delivery_at')::TIMESTAMPTZ 
            ELSE orders.order_out_for_delivery_at 
        END,
        fulfilled_at = CASE 
            WHEN v_update_data ? 'fulfilled_at' 
            THEN (v_update_data->>'fulfilled_at')::TIMESTAMPTZ 
            ELSE orders.fulfilled_at 
        END
    WHERE orders.id = p_order_id
    RETURNING orders.id, orders.status, orders.updated_at, orders.order_packed_at, orders.order_out_for_delivery_at, orders.fulfilled_at;
    
    RAISE NOTICE '✅ Order % updated successfully from % to %', p_order_id, v_old_status, p_new_status;
    
    -- Return the updated order
    RETURN QUERY
    SELECT orders.id, orders.status, orders.updated_at, orders.order_packed_at, orders.order_out_for_delivery_at, orders.fulfilled_at
    FROM orders
    WHERE orders.id = p_order_id;
    
END $$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION update_order_status(UUID, TEXT, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION update_order_status(UUID, TEXT, TIMESTAMPTZ) TO authenticated;

-- Test the fixed function with our specific order
DO $$
DECLARE
    test_result RECORD;
BEGIN
    RAISE NOTICE '🧪 Testing fixed update_order_status function with order: 9f9e0f93-e380-4756-ae78-ff08a22cc7c9';
    
    BEGIN
        SELECT * INTO test_result
        FROM update_order_status('9f9e0f93-e380-4756-ae78-ff08a22cc7c9', 'packed', NOW());
        
        RAISE NOTICE '✅ Function test successful!';
        RAISE NOTICE 'Result: status=%, order_packed_at=%', test_result.status, test_result.order_packed_at;
        
        -- Reset the status back to paid for future testing
        UPDATE orders 
        SET status = 'paid', order_packed_at = NULL, updated_at = NOW()
        WHERE id = '9f9e0f93-e380-4756-ae78-ff08a22cc7c9';
        
        RAISE NOTICE '🔄 Reset order status back to paid for testing';
        
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ Function test failed: %', SQLERRM;
    END;
END $$;