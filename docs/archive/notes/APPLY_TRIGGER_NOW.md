# 🚀 Apply Database Trigger - Quick Guide

## Step 1: Open SQL Editor
👉 **Click this link**: https://supabase.com/dashboard/project/yvmnedjybrpvlupygusf/sql/new

## Step 2: Copy This SQL

```sql
-- Migration: Auto-sync fulfillment_type from fulfillment_method
-- This ensures fulfillment_type is always populated when fulfillment_method is set

-- Create the trigger function
CREATE OR REPLACE FUNCTION sync_fulfillment_type()
RETURNS TRIGGER AS $$
BEGIN
  -- If fulfillment_type is null and fulfillment_method has a value, copy it
  IF NEW.fulfillment_type IS NULL AND NEW.fulfillment_method IS NOT NULL THEN
    NEW.fulfillment_type := NEW.fulfillment_method;
  END IF;

  -- Also sync from delivery_method as fallback
  IF NEW.fulfillment_type IS NULL AND NEW.delivery_method IS NOT NULL THEN
    NEW.fulfillment_type := NEW.delivery_method;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS sync_fulfillment_type_trigger ON orders;

CREATE TRIGGER sync_fulfillment_type_trigger
  BEFORE INSERT OR UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION sync_fulfillment_type();

-- Test comment
COMMENT ON FUNCTION sync_fulfillment_type() IS 'Auto-populates fulfillment_type from fulfillment_method or delivery_method';
```

## Step 3: Click "Run"

You should see: ✅ **"Success. No rows returned"**

## Step 4: Test It! (Optional)

Test that the trigger works by creating a test order:

```sql
-- Create test order
INSERT INTO orders (
  order_number,
  fulfillment_method,
  status,
  total
) VALUES (
  'TEST-TRIGGER-' || NOW()::text,
  'delivery',
  'placed',
  100
) RETURNING id, fulfillment_type, fulfillment_method;

-- Check result - fulfillment_type should be 'delivery'!
```

Then delete the test:
```sql
DELETE FROM orders WHERE order_number LIKE 'TEST-TRIGGER-%';
```

---

## ✅ What This Does

From now on, whenever an order is created or updated:
- If `fulfillment_type` is NULL
- And `fulfillment_method` has a value
- **Automatically** copy the value!

**Result**: No more null fulfillment_type! 🎉

---

## 🚨 Already Applied?

If you see an error like "trigger already exists", that's fine! It means it's already working.

To verify, run:
```sql
SELECT tgname, tgenabled
FROM pg_trigger
WHERE tgname = 'sync_fulfillment_type_trigger';
```

Should return: `sync_fulfillment_type_trigger | t` (t = enabled)
