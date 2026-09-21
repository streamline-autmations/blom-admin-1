# 📋 Exact Fields to Update in Your Workflow

## 🔑 **HTTP Request Details**

### **Method:** PATCH
### **URL:** 
```
https://yvmnedjybrpvlupygusf.supabase.co/rest/v1/orders?id=eq.{order_id_from_payload}
```

### **Headers:**
```
Authorization: Bearer YOUR_SERVICE_ROLE_KEY
apikey: YOUR_SERVICE_ROLE_KEY
Content-Type: application/json
Prefer: return=minimal
```

## 📋 **Exact JSON Body for Each Status**

### **1. "Mark as Packed" Button**
```json
{
  "status": "packed",
  "updated_at": "2025-12-01T06:34:00.000Z",
  "order_packed_at": "2025-12-01T06:34:00.000Z"
}
```

### **2. "Mark Out for Delivery" Button**
```json
{
  "status": "out_for_delivery",
  "updated_at": "2025-12-01T06:34:00.000Z", 
  "order_out_for_delivery_at": "2025-12-01T06:34:00.000Z"
}
```

### **3. "Mark Delivered" Button**
```json
{
  "status": "delivered",
  "updated_at": "2025-12-01T06:34:00.000Z",
  "fulfilled_at": "2025-12-01T06:34:00.000Z",
  "order_delivered_at": "2025-12-01T06:34:00.000Z"
}
```

### **4. "Mark Collected" Button**
```json
{
  "status": "collected",
  "updated_at": "2025-12-01T06:34:00.000Z",
  "fulfilled_at": "2025-12-01T06:34:00.000Z", 
  "order_collected_at": "2025-12-01T06:34:00.000Z"
}
```

## 🔄 **Payload You'll Receive**

When user clicks a button, your workflow gets this payload:

```json
{
  "event": "order_status_change_request",
  "order_id": "4fc6796e-3b62-4890-8d8d-0e645f6599a3",
  "order_number": "BL-19ACBFB542B", 
  "previous_status": "paid",
  "new_status": "packed",
  "timestamp": "2025-12-01T06:34:00.000Z",
  "fulfillment_type": "delivery",
  "customer_info": {
    "name": "Customer Name",
    "email": "customer@email.com", 
    "phone": "0123456789"
  }
}
```

## 🎯 **Your Workflow Steps**

1. **Receive payload** (above)
2. **Extract** `order_id` and `new_status` 
3. **Choose JSON body** based on `new_status` (above)
4. **Send PATCH request** to Supabase with chosen body
5. **Return success response**

## 🔑 **Service Role Key**

Get from Supabase Dashboard → Settings → API → Copy "service_role" key

## ✅ **This Approach**

- ✅ **No Netlify functions needed**
- ✅ **No RLS blocking** (service role bypasses)
- ✅ **Direct database updates**
- ✅ **Frontend gets updated automatically**
- ✅ **Simple and reliable**

## 📝 **Summary**

You handle the database updates via HTTP in your workflow, while the frontend just sends you clean payloads with the order details and requested status change.