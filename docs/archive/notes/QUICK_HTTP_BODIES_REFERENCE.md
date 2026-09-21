# 🚀 Quick HTTP Bodies Reference

## 📋 **Use These Exact Bodies in Your Workflow**

### **1. Ready for Delivery (Delivery Orders)**
```json
{
  "status": "packed",
  "updated_at": "{{ $now }}",
  "order_packed_at": "{{ $now }}"
}
```

### **2. Ready for Collection (Collection Orders)**  
```json
{
  "status": "packed",
  "updated_at": "{{ $now }}",
  "order_packed_at": "{{ $now }}"
}
```

### **3. Out for Delivery**
```json
{
  "status": "out_for_delivery",
  "updated_at": "{{ $now }}",
  "order_out_for_delivery_at": "{{ $now }}"
}
```

## 🔑 **Key Points**
- Use **`status`** not `shipping_status`
- Same body works for collection & delivery (frontend routes to different webhooks)
- Extract order ID from webhook payload
- All use PATCH method to Supabase REST API

**That's it! These bodies will fix both issues.**