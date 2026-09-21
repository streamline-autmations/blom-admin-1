-- COMPREHENSIVE FIX: All ambiguous column references
-- This fixes ALL potential conflicts between parameters and table columns

-- Drop the broken function completely
DROP FUNCTION IF EXISTS update_order_status(UUID, TEXT, TIMESTAMPTZ);

-- Create the FINAL fixed version with ALL column qualifiers
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
    -- Get current status - QUALIFY ALL COLUMN REFERENCES
    SELECT orders.status INTO v_old_status FROM orders WHERE orders.id = p_order_id;
    
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
    
    -- Perform the update with COMPLETE table qualifiers
    UPDATE orders 
    SET 
        orders.status = (v_update_data->>'status')::TEXT,
        orders.updated_at = (v_update_data->>'updated_at')::TIMESTAMPTZ,
        orders.order_packed_at = CASE 
            WHEN v_update_data ? 'order_packed_at' 
            THEN (v_update_data->>'order_packed_at')::TIMESTAMPTZ 
            ELSE orders.order_packed_at 
        END,
        orders.order_out_for_delivery_at = CASE 
            WHEN v_update_data ? 'order_out_for_delivery_at' 
            THEN (v_update_data->>'order_out_for_delivery_at')::TIMESTAMPTZ 
            ELSE orders.order_out_for_delivery_at 
        END,
        orders.fulfilled_at = CASE 
            WHEN v_update_data ? 'fulfilled_at' 
            THEN (v_update_data->>'fulfilled_at')::TIMESTAMPTZ 
            ELSE orders.fulfilled_at 
        END
    WHERE orders.id = p_order_id;
    
    RAISE NOTICE '✅ Order % updated successfully from % to %', p_order_id, v_old_status, p_new_status;
    
    -- Return the updated order with table qualifiers
    RETURN QUERY
    SELECT orders.id, orders.status, orders.updated_at, orders.order_packed_at, orders.order_out_for_delivery_at, orders.fulfilled_at
    FROM orders
    WHERE orders.id = p_order_id;
    
END $$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION update_order_status(UUID, TEXT, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION update_order_status(UUID, TEXT, TIMESTAMPTZ) TO authenticated;

-- IMMEDIATE TEST with your specific order
DO $$
DECLARE
    test_result RECORD;
    test_order_id UUID := '9f9e0f93-e380-4756-ae78-ff08a22cc7c9';
BEGIN
    RAISE NOTICE '🧪 Testing FIXED update_order_status function with order: %', test_order_id;
    
    -- Show current status before update
    SELECT orders.status INTO test_result FROM orders WHERE orders.id = test_order_id;
    RAISE NOTICE '📊 Before update: status = %', test_result.status;
    
    BEGIN
        -- Call the function
        SELECT * INTO test_result
        FROM update_order_status(test_order_id, 'packed', NOW());
        
        RAISE NOTICE '✅ Function call successful!';
        RAISE NOTICE '📊 After update: status = %, order_packed_at = %', test_result.status, test_result.order_packed_at;
        
        -- Verify the database was actually updated
        SELECT orders.status, orders.order_packed_at INTO test_result 
        FROM orders 
        WHERE orders.id = test_order_id;
        
        IF test_result.status = 'packed' THEN
            RAISE NOTICE '🎉 SUCCESS: Database shows status = "packed"!';
        ELSE
            RAISE NOTICE '❌ FAILURE: Database still shows status = "%"', test_result.status;
        END IF;
        
        -- Reset the status back to paid for future testing
        UPDATE orders 
        SET orders.status = 'paid', orders.order_packed_at = NULL, orders.updated_at = NOW()
        WHERE orders.id = test_order_id;
        
        RAISE NOTICE '🔄 Reset order status back to "paid" for future testing';
        
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ Function test failed: %', SQLERRM;
        RAISE;
    END;
END $$;