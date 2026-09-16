# 🚨 Order Status Update Fix - Payment Status Constraint Error

## Problem Analysis

You received this error when trying to update order status:
```
"new row for relation \"orders\" violates check constraint \"orders_payment_status_valid\""
```

**Root Cause:** You tried to set `payment_status: "packed"`, but `payment_status` field has constraints that only allow payment-related values like "paid", "unpaid", "pending", etc.

## The Fix - 3 Working Solutions

### Solution 1: Correct API Call (Recommended)
Only update the `status` field, leave `payment_status` unchanged:

```bash
curl -X PATCH "https://yvmnedjybrpvlupygusf.supabase.co/rest/v1/orders?id=eq.4fc6796e-3b62-4890-8d8d-0e645f6599a3" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "apikey: YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "packed",
    "updated_at": "2025-11-30T15:24:00.000Z",
    "order_packed_at": "2025-11-30T15:24:00.000Z"
  }'
```

**✅ This works immediately without database changes!**

### Solution 2: Database Constraint Fix
Apply the database migration to fix the constraint:
```bash
psql "$DATABASE_URL" -f db/migrations/fix_payment_status_constraint.sql
```

### Solution 3: RPC Function (Most Robust)
Use the existing RPC function that handles all constraints:
```sql
SELECT * FROM update_order_status(
    '4fc6796e-3b62-4890-8d8d-0e645f6599a3'::UUID, 
    'packed'
);
```

## Field Definitions

- **status**: Order fulfillment status
  - Values: `created`, `paid`, `packed`, `out_for_delivery`, `delivered`, `collected`, `cancelled`
  
- **payment_status**: Payment processing status  
  - Values: `pending`, `paid`, `unpaid`, `failed`, `refunded`, `cancelled`

## Quick Test Script

I've created `scripts/correct_order_status_update.sh` that you can run:

```bash
bash scripts/correct_order_status_update.sh
```

This script updates ONLY the status field correctly without touching payment_status.

## Why This Happened

The original error occurred because:
1. You sent: `{"status": "packed", "payment_status": "packed"}`
2. Database constraint `orders_payment_status_valid` rejected "packed" as payment_status
3. Payment status should remain as "paid", "unpaid", or "pending"

## Verification Commands

After running any solution, verify with:
```sql
SELECT id, status, payment_status, updated_at, order_packed_at 
FROM orders 
WHERE id = '4fc6796e-3b62-4890-8d8d-0e645f6599a3';
```

## Next Steps

1. **Immediate**: Use the API call in Solution 1
2. **Database**: Apply the migration in Solution 2 if needed
3. **Webhook**: Confirm your webhook still triggers with the status change
4. **Frontend**: Update any status buttons to only send `status` field