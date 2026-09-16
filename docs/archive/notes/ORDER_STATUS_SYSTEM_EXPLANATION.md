# 📋 Complete Order Status System Explanation

## 🔄 **How Your Order Status Works**

### **Current Status Flow:**
```
Order Created → Payment → Packed → Out for Delivery → Delivered/Collected
```

### **Status Values & Meanings:**
1. **`created`** - Order placed but not paid
2. **`paid`** - Payment received  
3. **`packed`** - Order items prepared/packed
4. **`out_for_delivery`** - Package handed to courier
5. **`delivered`** - Successfully delivered to customer
6. **`collected`** - Customer collected from store

## 📊 **How Statuses Display in Orders Page**

### **Frontend Data Flow:**
1. **Orders Page** calls: `/.netlify/functions/admin-orders`
2. **Netlify function** fetches from Supabase `orders` table
3. **React Query** caches the data
4. **UI displays** status with color coding

### **Database Fields Updated:**
For each status change, these fields get updated:

**Mark as Packed:**
```sql
status: "packed"
updated_at: NOW()
order_packed_at: NOW()
```

**Mark Out for Delivery:**
```sql
status: "out_for_delivery" 
updated_at: NOW()
order_out_for_delivery_at: NOW()
```

**Mark Delivered:**
```sql
status: "delivered"
updated_at: NOW()
fulfilled_at: NOW()
order_delivered_at: NOW()
```

**Mark Collected:**
```sql
status: "collected"
updated_at: NOW() 
fulfilled_at: NOW()
order_collected_at: NOW()
```

## 🌐 **HTTP Call for Your Workflow**

Since you're getting the payload anyway, use this HTTP node call in your workflow:

### **Method:** PATCH
### **URL:** 
```
https://yvmnedjybrpvlupygusf.supabase.co/rest/v1/orders?id=eq.ORDER_ID_FROM_PAYLOAD
```

### **Headers:**
```
Authorization: Bearer YOUR_SERVICE_ROLE_KEY
apikey: YOUR_SERVICE_ROLE_KEY  
Content-Type: application/json
Prefer: return=minimal
```

### **Body (JSON):**
```json
{
  "status": "packed",
  "updated_at": "2025-12-01T06:22:00.000Z",
  "order_packed_at": "2025-12-01T06:22:00.000Z"
}
```

## 🔑 **Where to Get Your Service Role Key**

In Supabase Dashboard:
1. Go to Settings → API
2. Copy the "service_role" key (not the "anon" key)
3. Use this in your HTTP node

## 🎯 **Dynamic Values from Payload**

Your HTTP node should use data from your payload:

```json
{
  "status": "packed",
  "updated_at": "{{$now}}",
  "order_packed_at": "{{$now}}"
}
```

Where `{{$now}}` is your workflow's current timestamp, and you extract the order ID from your payload.

## ✅ **This Will Work Because:**

- Uses **service role key** (has write permissions)
- Bypasses **RLS restrictions** (service role is exempt)
- **Direct Supabase REST API** call
- **Immediate database update**
- **Triggers frontend cache refresh**

## 📝 **Summary for Your Workflow**

1. **Receive payload** (as you currently do)
2. **Extract order ID** from payload
3. **Add HTTP node** with the PATCH call above
4. **Status gets updated** in database
5. **Frontend updates** automatically
6. **Webhooks continue** to work

This approach bypasses the broken Netlify function entirely and updates the database directly!