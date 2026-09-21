# DATABASE DIAGNOSTIC PROMPT FOR CURSOR

Copy and paste this prompt into Cursor to analyze your Supabase database and identify the exact type mismatch issue:

---

## 🔍 SUPABASE DATABASE DIAGNOSTIC ANALYSIS

I need to analyze the actual database schema to fix the PostgreSQL `text = uuid` type mismatch error. Please run these queries in your Supabase SQL Editor and provide the results:

### 1. SCHEMA ANALYSIS
```sql
-- Check the exact schema of the orders table
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'orders' 
ORDER BY ordinal_position;

-- Specifically check the id column type
SELECT 
    column_name, 
    data_type,
    udt_name
FROM information_schema.columns 
WHERE table_name = 'orders' AND column_name = 'id';
```

### 2. CURRENT RPC FUNCTION ANALYSIS
```sql
-- Check if the function exists and its definition
SELECT 
    p.proname,
    pg_get_function_identity_arguments(p.oid) as args,
    pg_get_function_result(p.oid) as return_type,
    p.prosrc
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'update_order_status';
```

### 3. SAMPLE DATA VERIFICATION
```sql
-- Check sample orders to understand data types
SELECT 
    id, 
    status, 
    created_at,
    pg_typeof(id) as id_type,
    pg_typeof(status) as status_type
FROM orders 
LIMIT 3;

-- Check the specific test order mentioned in the error
SELECT 
    id, 
    status,
    pg_typeof(id) as id_type
FROM orders 
WHERE id = '9f9e0f93-e380-4756-ae78-ff08a22cc7c9';
```

### 4. FUNCTION PERMISSIONS
```sql
-- Check function permissions and security settings
SELECT 
    p.proname,
    p.proowner,
    p.prosecdef,
    array_agg(DISTINCT r.rolname) as granted_roles
FROM pg_proc p
LEFT JOIN pg_proc_acl_explode(p.proacl) pae ON true
LEFT JOIN pg_roles r ON pae.grantee = r.oid
WHERE p.proname = 'update_order_status'
GROUP BY p.proname, p.proowner, p.prosecdef;
```

### 5. TYPE CASTING TEST
```sql
-- Test if the specific UUID casting works
SELECT 
    '9f9e0f93-e380-4756-ae78-ff08a22cc7c9'::UUID as casted_uuid,
    pg_typeof('9f9e0f93-e380-4756-ae78-ff08a22cc7c9'::UUID) as casted_type;

-- Test comparison that should work
SELECT 
    o.id,
    '9f9e0f93-e380-4756-ae78-ff08a22cc7c9'::UUID as test_uuid,
    o.id = '9f9e0f93-e380-4756-ae78-ff08a22cc7c9'::UUID as comparison_result
FROM orders o 
LIMIT 1;
```

### 6. FUNCTION EXECUTION TEST
```sql
-- Create a simple test function to isolate the issue
CREATE OR REPLACE FUNCTION test_uuid_comparison(
    test_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    result BOOLEAN;
BEGIN
    -- This should trigger the same error
    SELECT EXISTS(
        SELECT 1 FROM orders WHERE id = test_id
    ) INTO result;
    
    RETURN result;
END $$;

-- Test the problematic comparison
SELECT test_uuid_comparison('9f9e0f93-e380-4756-ae78-ff08a22cc7c9');
```

### 7. DROP AND RECREATE TEST
```sql
-- Drop the current function completely
DROP FUNCTION IF EXISTS update_order_status(UUID, TEXT, TIMESTAMPTZ) CASCADE;

-- Create a minimal test function to verify the basic pattern works
CREATE OR REPLACE FUNCTION test_order_lookup(
    p_order_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    v_status TEXT;
BEGIN
    SELECT status INTO v_status FROM orders WHERE id = p_order_id;
    RETURN v_status;
END $$;

-- Test with a real order ID
SELECT test_order_lookup('9f9e0f93-e380-4756-ae78-ff08a22cc7c9'::UUID);
```

---

## 📋 WHAT TO LOOK FOR:

1. **Column Types**: What is the actual data type of `orders.id`?
2. **Function Definition**: Does the current function match what we expect?
3. **Sample Data**: What UUID format are your actual order IDs in?
4. **Permissions**: Are there any security settings blocking the function?
5. **Minimal Test**: Does the basic UUID comparison work at all?

Please run these queries and share the results. The exact error will be much easier to identify once we see the actual database schema and function behavior.

---

**Expected Output**: I'll analyze your results and provide the exact fix needed for your specific database configuration.