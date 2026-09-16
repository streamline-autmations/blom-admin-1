# 🔧 N8N Workflow Debugging Guide

## 🎯 **Current Situation Analysis**

I can see from your debug results and webhook payload that:

✅ **Admin Interface**: Working correctly, updating `status` field
✅ **N8N Payload**: Receiving correct data (`"new_status": "packed"`)
❌ **Database Update**: `status` field still shows "paid"

**Issue**: N8N workflow is receiving the correct payload but not updating the database properly.

## 🔍 **N8N Workflow Debug Steps**

### **Step 1: Check N8N Workflow Execution**

1. **Go to your N8N instance**
2. **Find the workflow** that handles `ready-for-delivery`
3. **Check execution history** for the recent order `9f9e0f93-e380-4756-ae78-ff08a22cc7c9`
4. **Look for any error messages** in the execution log

### **Step 2: Verify HTTP Request Node Settings**

Check your HTTP Request node in N8N:

**URL**: Should be your Supabase REST API endpoint
**Method**: `PATCH` or `POST`
**Headers**: 
```
Content-Type: application/json
Authorization: Bearer YOUR_SUPABASE_ANON_KEY
apikey: YOUR_SUPABASE_ANON_KEY
```

**Body**: Should be exactly:
```json
{
  "id": "9f9e0f93-e380-4756-ae78-ff08a22cc7c9",
  "status": "packed"
}
```

### **Step 3: Test the HTTP Request Directly**

Add a test HTTP Request node in N8N with:
- **URL**: `https://your-project.supabase.co/rest/v1/orders?id=eq.9f9e0f93-e380-4756-ae78-ff08a22cc7c9`
- **Method**: `PATCH`
- **Headers**: Same as above
- **Body**: 
```json
{
  "status": "packed",
  "order_packed_at": "{{ $now }}",
  "updated_at": "{{ $now }}"
}
```

### **Step 4: Check Supabase RLS Policies**

The update might be failing due to Row Level Security. Check:

```sql
-- Check RLS policies on orders table
SELECT schemaname, tablename, policyname, permissive, cmd, qual
FROM pg_policies 
WHERE tablename = 'orders';

-- Test if service role can update
SELECT update_order_status('9f9e0f93-e380-4756-ae78-ff08a22cc7c9', 'packed');
```

## 🛠️ **Common N8N Issues & Solutions**

### **Issue 1: Authentication Error**
**Symptoms**: 401 or 403 errors in N8N execution log
**Solution**: Check your Supabase API keys and permissions

### **Issue 2: Wrong HTTP Method**
**Symptoms**: 405 Method Not Allowed
**Solution**: Use `PATCH` for updates, not `POST`

### **Issue 3: Missing Headers**
**Symptoms**: 400 Bad Request
**Solution**: Ensure all required headers are present

### **Issue 4: RLS Policy Blocking**
**Symptoms**: Update appears to succeed but no changes in database
**Solution**: Check Row Level Security policies

## 🧪 **Quick Test - Manual Database Update**

Run this SQL to test if the UI will update:

```sql
UPDATE orders 
SET 
    status = 'packed',
    order_packed_at = NOW(),
    updated_at = NOW()
WHERE id = '9f9e0f93-e380-4756-ae78-ff08a22cc7c9';

-- Check if it worked
SELECT id, status, shipping_status, updated_at 
FROM orders 
WHERE id = '9f9e0f93-e380-4756-ae78-ff08a22cc7c9';
```

**If UI updates after this manual update** → Issue is with N8N workflow
**If UI still shows "paid"** → Issue is with frontend cache or API

## 🔄 **Alternative: Use Supabase RPC Function**

Instead of direct REST API, use the RPC function:

**HTTP Request Body**:
```json
{
  "order_id": "9f9e0f93-e380-4756-ae78-ff08a22cc7c9",
  "new_status": "packed",
  "timestamp": "{{ $now }}"
}
```

**URL**: `https://your-project.supabase.co/rest/v1/rpc/update_order_status`

## 📋 **Debugging Checklist**

- [ ] Check N8N execution log for errors
- [ ] Verify HTTP Request node settings
- [ ] Test direct API call from N8N
- [ ] Check Supabase RLS policies
- [ ] Run manual SQL update to test UI
- [ ] Verify frontend cache clearing
- [ ] Test with RPC function instead of REST

## 🚀 **Next Steps**

1. **Run the manual SQL update** I provided above
2. **Check if UI updates** immediately
3. **If UI updates**: Fix the N8N workflow
4. **If UI doesn't update**: Check frontend cache issues

This will help us determine if the issue is in N8N or in the frontend!