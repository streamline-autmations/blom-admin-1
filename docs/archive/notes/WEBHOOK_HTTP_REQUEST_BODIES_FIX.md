# 🔧 Webhook & Database Update Fix Guide

## 🚨 **Issues Identified & Solutions**

### **Issue 1: Wrong Field Name**
**Problem**: You're using `shipping_status: "packed"` but database expects `status: "packed"`

**Error**: `orders_shipping_status_check` constraint violation

### **Issue 2: Missing Webhook Trigger**
**Problem**: Collection orders not triggering `ready-for-collection` webhook

**Root Cause**: Database constraint preventing status update, so webhook never sent

## ✅ **Correct HTTP Request Bodies**

### **1. Ready for Delivery Webhook (Delivery Orders)**
**When**: Order marked as "packed" for delivery
**URL**: `https://yvmnedjybrpvlupygusf.supabase.co/rest/v1/orders?id=eq.ORDER_ID`

**Headers**:
```
Authorization: Bearer YOUR_SERVICE_ROLE_KEY
apikey: YOUR_SERVICE_ROLE_KEY
Content-Type: application/json
Prefer: return=minimal
```

**Body**:
```json
{
  "status": "packed",
  "updated_at": "{{ $now }}",
  "order_packed_at": "{{ $now }}"
}
```

### **2. Ready for Collection Webhook (Collection Orders)**
**When**: Order marked as "packed" for collection
**URL**: `https://yvmnedjybrpvlupygusf.supabase.co/rest/v1/orders?id=eq.ORDER_ID`

**Headers**: Same as above

**Body**:
```json
{
  "status": "packed",
  "updated_at": "{{ $now }}",
  "order_packed_at": "{{ $now }}"
}
```

### **3. Out for Delivery Webhook**
**When**: Order marked as "out_for_delivery"
**URL**: `https://yvmnedjybrpvlupygusf.supabase.co/rest/v1/orders?id=eq.ORDER_ID`

**Headers**: Same as above

**Body**:
```json
{
  "status": "out_for_delivery",
  "updated_at": "{{ $now }}",
  "order_out_for_delivery_at": "{{ $now }}"
}
```

## 🔍 **Key Differences Explained**

### **Why Same Body for Collection vs Delivery?**
Both use `status: "packed"` because:
- The `status` field controls the order workflow
- `fulfillment_type` (in the order data) determines the webhook URL
- Frontend checks `fulfillment_type` to route to correct webhook

### **Database Fields Used:**
- `status`: Main workflow status (`paid`, `packed`, `out_for_delivery`, etc.)
- `updated_at`: When the order was last modified
- `order_packed_at`: Timestamp when order was packed
- `order_out_for_delivery_at`: Timestamp when order went out for delivery

## 🎯 **Workflow Implementation**

### **In Your Workflow:**

1. **Extract order ID** from webhook payload
2. **Determine status change** from payload
3. **Use correct HTTP body** based on status:
   - `new_status: "packed"` → Use body #1 or #2 above
   - `new_status: "out_for_delivery"` → Use body #3 above
4. **Execute HTTP PATCH** to update database

## 🐛 **Debugging Steps**

### **If Collection Webhook Still Not Triggering:**

1. **Check order data**:
   ```javascript
   // In your workflow, log:
   console.log('Order fulfillment_type:', payload.fulfillment_type);
   console.log('Order status:', payload.new_status);
   ```

2. **Verify order has correct fulfillment_type**:
   ```sql
   SELECT id, fulfillment_type, status 
   FROM orders 
   WHERE id = 'ORDER_ID_FROM_PAYLOAD';
   ```

3. **Expected values**:
   - Collection orders: `fulfillment_type = 'collection'`
   - Delivery orders: `fulfillment_type = 'delivery'`

## ✅ **Complete Testing Flow**

1. **Update one order** with correct body
2. **Check database** - status should change
3. **Check webhook logs** - should receive payload
4. **Check admin UI** - status badge should update

## 📋 **Summary**

**Fixed Issues**:
- ✅ Use `status` not `shipping_status`
- ✅ Correct HTTP bodies for all 3 webhooks
- ✅ Same body works for collection & delivery (different URLs)
- ✅ Database constraint satisfied

**Your workflow should now work correctly with these exact bodies!**