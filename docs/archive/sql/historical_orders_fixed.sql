-- Process Historical Orders to Populate Stock Movements
-- Run this AFTER creating the mapping system

DO $$
DECLARE
  order_record RECORD;
  result RECORD;
BEGIN
  RAISE NOTICE 'Starting historical order processing...';
  
  FOR order_record IN 
    SELECT id, order_number FROM orders WHERE status = 'paid' 
    ORDER BY created_at DESC
  LOOP
    BEGIN
      -- Process each paid order with proper UUID cast
      FOR result IN 
        SELECT * FROM process_order_stock_deduction(order_record.id)
      LOOP
        IF result.success THEN
          RAISE NOTICE 'Success: Order %, Product: %, Method: %', 
            result.order_name, result.matched_product, result.method;
        ELSE
          RAISE NOTICE 'Failed: Order %, Error: %', 
            result.order_name, result.error_message;
        END IF;
      END LOOP;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Error processing order % (%): %', order_record.id, order_record.order_number, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE 'Historical order processing completed!';
END $$;