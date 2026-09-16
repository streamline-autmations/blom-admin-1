# Database Diagnosis & Fix Prompt for Cursor

Copy and paste this entire prompt into Cursor to analyze and fix the stock management issues:

## 🔍 **Step 1: Check Current Database State**

```sql
-- Check if stock_movements table exists and its structure
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'stock_movements' 
ORDER BY ordinal_position;

-- Check if our functions exist
SELECT routine_name, routine_type, data_type, routine_definition
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('log_stock_movement', 'process_order_stock_deduction', 'adjust_stock');

-- Check existing stock movements
SELECT COUNT(*) as total_movements FROM stock_movements;
```

## 🔧 **Step 2: Clean Up & Reset**

```sql
-- If there are conflicts, clean up by dropping functions and recreating
DROP FUNCTION IF EXISTS log_stock_movement(uuid, integer, text) CASCADE;
DROP FUNCTION IF EXISTS process_order_stock_deduction(uuid) CASCADE;
DROP FUNCTION IF EXISTS adjust_stock(uuid, int) CASCADE;

-- Create the minimal working versions
CREATE OR REPLACE FUNCTION log_stock_movement(
  p_product_id uuid,
  p_delta integer,
  p_reason text
) RETURNS void AS $$
BEGIN
  INSERT INTO stock_movements (
    product_id,
    delta,
    reason,
    created_at
  ) VALUES (
    p_product_id,
    p_delta,
    p_reason,
    now()
  );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION adjust_stock(product_uuid uuid, quantity_to_reduce int)
RETURNS void AS $$
BEGIN
  UPDATE products SET stock = stock - quantity_to_reduce WHERE id = product_uuid;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION log_stock_movement(uuid, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION adjust_stock(uuid, int) TO service_role;
```

## 🧪 **Step 3: Test Functions Manually**

```sql
-- Test the log_stock_movement function with a real product
SELECT id, name, stock FROM products WHERE is_active = true LIMIT 1;

-- Replace YOUR_PRODUCT_ID with actual product ID from above
SELECT log_stock_movement(
  'YOUR_PRODUCT_ID'::uuid, 
  5, 
  'Test manual adjustment'
);

-- Check if the movement was created
SELECT * FROM stock_movements ORDER BY created_at DESC LIMIT 1;
```

## 🔍 **Step 4: Check the Frontend API Calls**

```sql
-- Check if the stock_movements API is accessible
-- This will show recent movements with proper product names
SELECT 
  sm.id,
  sm.product_id,
  sm.delta,
  sm.reason,
  sm.created_at,
  p.name as product_name
FROM stock_movements sm
LEFT JOIN products p ON sm.product_id = p.id
ORDER BY sm.created_at DESC
LIMIT 10;
```

## 📋 **Step 5: Debug Order Processing**

```sql
-- Check if there are any paid orders that should have deducted stock
SELECT o.id, o.status, COUNT(oi.id) as item_count
FROM orders o
JOIN order_items oi ON o.id = oi.order_id
WHERE o.status = 'paid'
GROUP BY o.id, o.status
ORDER BY o.created_at DESC
LIMIT 5;

-- Check order items with missing product_ids
SELECT oi.order_id, oi.name, oi.product_id, oi.quantity
FROM order_items oi
WHERE oi.product_id IS NULL
LIMIT 5;
```

## 🛠️ **Step 6: Create Order Deduction Function (if needed)**

```sql
-- Simple order processing function
CREATE OR REPLACE FUNCTION process_order_stock_deduction(p_order_id uuid)
RETURNS json AS $$
DECLARE
  item RECORD;
  product_found uuid;
  stock_before integer;
  stock_after integer;
  results json := '[]'::json;
  success_count integer := 0;
  fail_count integer := 0;
BEGIN
  FOR item IN
    SELECT oi.id, oi.product_id, oi.name, oi.quantity
    FROM order_items oi 
    WHERE oi.order_id = p_order_id
  LOOP
    BEGIN
      product_found := item.product_id;
      
      -- If no product_id, try to find by name
      IF product_found IS NULL THEN
        SELECT p.id INTO product_found
        FROM products p 
        WHERE LOWER(p.name) = LOWER(item.name)
        LIMIT 1;
      END IF;
      
      -- If still no match, skip this item
      IF product_found IS NULL THEN
        results := results || json_build_object('item_id', item.id, 'status', 'failed', 'error', 'Product not found')::json;
        fail_count := fail_count + 1;
        CONTINUE;
      END IF;
      
      -- Get current stock and deduct
      SELECT p.stock INTO stock_before FROM products p WHERE p.id = product_found;
      stock_after := stock_before - item.quantity;
      
      UPDATE products SET stock = stock_after WHERE id = product_found;
      
      -- Log the movement
      PERFORM log_stock_movement(product_found, -item.quantity, 'Order deduction: ' || item.name);
      
      results := results || json_build_object('item_id', item.id, 'status', 'success', 'product_id', product_found)::json;
      success_count := success_count + 1;
      
    EXCEPTION WHEN OTHERS THEN
      results := results || json_build_object('item_id', item.id, 'status', 'failed', 'error', SQLERRM)::json;
      fail_count := fail_count + 1;
    END;
  END LOOP;
  
  RETURN json_build_object('successful', success_count, 'failed', fail_count, 'results', results);
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION process_order_stock_deduction(uuid) TO service_role;
```

## 🎯 **Step 7: Final Test**

```sql
-- Test with a real order
SELECT process_order_stock_deduction('YOUR_ORDER_ID'::uuid);

-- Check results
SELECT * FROM stock_movements ORDER BY created_at DESC LIMIT 10;
SELECT name, stock FROM products WHERE id IN (
  SELECT DISTINCT product_id FROM stock_movements ORDER BY created_at DESC LIMIT 5
);
```

## 📝 **Notes for Cursor:**

1. **Run each step sequentially** and show me the results
2. **If Step 3 fails**, we know the basic function isn't working
3. **If Step 3 works but movements don't show in admin**, the API is the issue
4. **If order processing doesn't work**, we need to debug the PayFast webhook

**Report back with:**
- Results from each SQL query
- Any error messages
- Current state of the stock_movements table
- Whether the functions are working

This will give us a complete diagnosis of what's wrong and how to fix it.