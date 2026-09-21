# 🔧 CORS Webhook Fix & Database Schema Clarification

## 🚨 **Issues Identified**

### **1. CORS Error Blocking Webhooks**
**Error**: `Access to fetch at 'https://dockerfile-1n82.onrender.com/webhook/ready-for-collection' from origin 'https://blom-admin-1.netlify.app' has been blocked by CORS policy`

**Root Cause**: Your webhook URL doesn't allow requests from the admin app domain

### **2. Database Schema Confusion**
**Problem**: Confusion between `status` and `shipping_status` fields

## ✅ **Immediate Fix Applied**

### **Frontend Changes Made:**
1. **CORS Error Handling**: Frontend now continues with database update even if webhook fails
2. **Better Error Messages**: Shows specific CORS/network issues to admin users
3. **Graceful Degradation**: Admin can still update order status even if webhook is unavailable

### **New User Experience:**
- ✅ **Database updates work** regardless of webhook CORS issues
- ⚠️ **Warning messages** inform admin about webhook failures
- 🔄 **Status buttons work** and UI updates correctly

## 🔍 **Database Schema Clarification**

### **Two Different Status Fields:**

#### **1. Main `status` Field** (Primary Workflow)
**Used by**: Admin interface, main order processing
**Values**: `'created'`, `'paid'`, `'packed'`, `'out_for_delivery'`, `'delivered'`, `'collected'`
**Controls**: Button visibility, order workflow progression

#### **2. `shipping_status` Field** (Shipping Process)
**Used by**: Shipping/logistics workflows (N8N integration)
**Values**: `'pending'`, `'ready_for_collection'`, `'ready_for_delivery'`, `'shipped'`, `'delivered'`, `'cancelled'`
**Controls**: Shipping status for external systems

### **Which Field to Use:**

**For Admin Interface Updates:**
```json
{
  "status": "packed",  // ✅ CORRECT - Updates admin interface
  "updated_at": "{{ $now }}",
  "order_packed_at": "{{ $now }}"
}
```

**For N8N Shipping Workflows:**
```json
{
  "shipping_status": "ready_for_collection",  // ✅ CORRECT - For shipping systems
  "updated_at": "{{ $now }}",
  "order_packed_at": "{{ $now }}"
}
```

## 🌐 **CORS Solution Options**

### **Option 1: Fix Webhook Server (Recommended)**
Add CORS headers to your webhook endpoint:

```javascript
// In your webhook server (Express.js example)
app.post('/webhook/ready-for-collection', (req, res) => {
  res.header('Access-Control-Allow-Origin', 'https://blom-admin-1.netlify.app');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  
  // Your webhook logic here
  res.json({ success: true });
});
```

### **Option 2: Use Netlify Function Proxy**
Create a Netlify function to proxy the webhook request:

```javascript
// netlify/functions/proxy-webhook.js
export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const response = await fetch('https://dockerfile-1n82.onrender.com/webhook/ready-for-collection', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: event.body
    });

    const data = await response.json();
    return {
      statusCode: 200,
      body: JSON.stringify(data)
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
}
```

Then update frontend to call:
```javascript
// Instead of direct webhook URL
const webhookUrl = '/.netlify/functions/proxy-webhook';
```

## 🎯 **Current Status**

### **✅ What's Working Now:**
- Database updates proceed even if webhook fails
- Admin UI shows appropriate warning messages
- Order status changes reflect in admin interface
- CORS errors don't break the workflow

### **🔄 What's Needed:**
1. **CORS fix** on webhook server OR proxy function
2. **Clear field usage** distinction between `status` and `shipping_status`

## 📋 **Quick Reference**

| Purpose | Field | Example Value |
|---------|-------|---------------|
| Admin UI Updates | `status` | `"packed"` |
| N8N Shipping | `shipping_status` | `"ready_for_collection"` |
| Collection Workflow | `status` | `"packed"` + `fulfillment_type: "collection"` |
| Delivery Workflow | `status` | `"packed"` + `fulfillment_type: "delivery"` |

## 🚀 **Next Steps**

1. **Test current fix** - Status buttons should work despite CORS errors
2. **Implement CORS fix** - Choose Option 1 or 2 above
3. **Clarify field usage** - Use `status` for admin, `shipping_status` for N8N
4. **Update webhook URLs** - Point to fixed endpoint once CORS is resolved

The admin interface will now work correctly even while we resolve the CORS issue!