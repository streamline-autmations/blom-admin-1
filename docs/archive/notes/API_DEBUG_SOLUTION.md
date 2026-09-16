# API vs Database Debug Solution

## 🎯 **Root Cause Diagnosis**

Based on your Cursor report showing **database functions work** but **manual testing fails**, the issue is in the **frontend API layer**, not the database.

## 🔧 **Test Script Created**

I've created **`scripts/api_debug_test.js`** - run this to pinpoint the exact issue:

```bash
node scripts/api_debug_test.js
```

## 🔍 **Expected Test Results**

The script will tell us exactly what's wrong:

### ✅ **If Database Works + API Fails:**
```
🔧 ISSUE: Frontend API function (adjust-stock) has a bug
✅ Database functions work perfectly  
❌ Frontend API call to database fails
```

### ✅ **If Both Fail:**
```
🔧 ISSUE: Database function has a bug
❌ Even direct database calls fail
```

## 🛠️ **Most Likely Issues**

### **1. Frontend API Function Bug**
The `netlify/functions/adjust-stock.ts` function has a mismatch between:
- What it sends to database: `log_stock_movement(p_product_id, p_delta, p_reason)`
- What the database expects: Same signature ✅

**Check:** Look at the actual error in the test script output.

### **2. Parameter Mismatch**
Frontend sends:
```javascript
{
  productId: "uuid",
  delta: 5,
  reason: "manual_adjustment"
}
```

Database function expects:
```sql
log_stock_movement(p_product_id uuid, p_delta integer, p_reason text)
```

### **3. Permissions Issue**
The API function might not have permission to call the database function.

## 🚀 **Quick Fixes to Try**

### **Fix 1: Check API Function Logs**
```bash
# Check Netlify function logs for the adjust-stock function
# Look for error messages when you make a manual adjustment
```

### **Fix 2: Test Direct Database Call**
If the test shows API fails but direct DB works, the issue is in the API function.

### **Fix 3: Deploy Updated Functions**
Make sure you've deployed the updated `netlify/functions/adjust-stock.ts` to your Netlify environment.

## 📋 **Next Steps**

1. **Run the test script**: `node scripts/api_debug_test.js`
2. **Share the output** - it will tell us exactly what's wrong
3. **Deploy the updated functions** if they're not deployed
4. **Check Netlify function logs** for actual error messages

The database is working fine - we just need to fix the API bridge!