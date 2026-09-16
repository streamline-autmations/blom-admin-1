# Sign-up Coupons Fix

## Problem
Sign-up coupons (with pattern `BLOM####-XXXXXX`) are being created with 0% discount instead of 10%, and they need to be single-use only.

## Solution

### Option 1: Use the Admin UI (Recommended)
1. Go to the Coupons page in the admin panel
2. Look for the "Fix Sign-up Coupons" button (appears when there are coupons that need fixing)
3. Click the button to automatically fix all sign-up coupons

This will update all sign-up coupons to:
- Type: `percentage`
- Value: `10` (10% discount)
- Max Uses: `1` (single use only)

### Option 2: Run the Node.js Script
If you have access to the server environment variables:

```bash
# Set environment variables first
export SUPABASE_URL="your-supabase-url"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Run the script
node scripts/fix-signup-coupons.mjs
```

### Option 3: Run SQL Migration Directly
Execute the SQL file in Supabase SQL Editor:

```sql
-- File: db/migrations/fix_signup_coupons.sql
UPDATE coupons
SET 
  type = 'percentage',
  value = 10,
  max_uses = 1,
  is_active = true
WHERE code LIKE 'BLOM____-%'
  AND (
    type != 'percentage' 
    OR value != 10 
    OR max_uses != 1
    OR value IS NULL
    OR value = 0
  );
```

## Verification
After running the fix, verify in the Coupons page that:
1. All sign-up coupons show "10%" in the Value column
2. All sign-up coupons show "1" in the Max Uses column
3. The Type column shows "Percentage"

## Prevention
The fix has been applied to the backend function that creates sign-up coupons, so new coupons should be created correctly going forward.

## Single-Use Enforcement
The coupon system enforces single-use through:
1. `max_uses` field set to `1`
2. `used_count` incremented when coupon is applied to a paid order
3. Backend validation prevents reuse when `used_count >= max_uses`

**Note:** The enforcement of single-use happens in the checkout/payment flow on the customer-facing website. Make sure that repo also properly increments `used_count` when a payment is completed.
