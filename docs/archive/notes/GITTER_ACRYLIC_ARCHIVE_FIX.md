go# Glitter Acrylic Product Archive Fix

## Problem Analysis

The Glitter Acrylic product was still displaying on the website even after being archived. This was caused by several issues:

### Root Cause
1. **API Filtering Issue**: The `admin-products.ts` endpoint was not filtering out archived products by default
2. **Inconsistent Archiving Methods**: There were two different approaches to archiving products:
   - Original method: `is_active = false` and `archived = true`
   - Corrected method: `status = 'archived'`
3. **Missing Default Filter**: The API endpoint only filtered when explicitly requested via query parameters

### Technical Details

The original code in `netlify/functions/admin-products.ts`:
```typescript
// Original filtering logic (lines 36-37)
if (active === "true") query = query.eq("is_active", true);
if (active === "false") query = query.eq("is_active", false);
```

This meant that when no `active` parameter was provided, ALL products were returned regardless of their archived status.

## Solution Implemented

### 1. Fixed API Filtering Logic

Updated `netlify/functions/admin-products.ts` to:

```typescript
// Default to showing only active products unless explicitly requested otherwise
// Support both filtering methods for compatibility
if (active === "false") {
  query = query.eq("is_active", false);
} else if (active === "archived") {
  // Show archived products (status = 'archived' OR is_active = false)
  query = query.or('status.eq.archived,is_active.eq.false');
} else {
  // Default: show only active products (is_active = true AND status != 'archived')
  query = query.eq("is_active", true).neq("status", "archived");
}
```

**Note**: The database uses `is_active` and `status` fields for product archiving. There is no separate `archived` column on the products table.

### 2. Updated Data Transformation

Improved the status mapping logic:

```typescript
status: product.status === 'archived' ? 'archived' : (product.is_active ? 'active' : 'inactive'),
active: product.is_active && product.status !== 'archived'
```

### 3. Created SQL Script for Comprehensive Archiving

Created `scripts/ensure_glitter_acrylic_archived.sql` to ensure all Glitter Acrylic products are properly archived using both methods.

## API Behavior Changes

### New Query Parameter Options

| Parameter | Behavior |
|-----------|----------|
| No parameter | Returns only active products (is_active=true AND status!='archived') |
| `active=true` | Returns only active products (same as default) |
| `active=false` | Returns only inactive products (is_active=false) |
| `active=archived` | Returns archived products (status='archived' OR is_active=false) |

### Backward Compatibility

The fix maintains backward compatibility:
- Existing calls with `active=true` continue to work
- Existing calls with `active=false` continue to work  
- New `active=archived` parameter provides additional flexibility
- Default behavior now properly filters out archived products

## Testing

### Test Script Created

Created `scripts/test_product_filtering.js` to verify:
1. Default behavior returns only active products
2. Explicit `active=true` returns only active products
3. `active=archived` returns archived/inactive products
4. Glitter Acrylic products are properly filtered

### Manual Testing Steps

1. **Verify Glitter Acrylic products are archived**:
   ```bash
   node scripts/check_glitter_acrylic_status.js
   ```

2. **Test API filtering**:
   ```bash
   node scripts/test_product_filtering.js
   ```

3. **Run SQL script to ensure proper archiving**:
   ```bash
   # Run this in your Supabase SQL editor or via psql
   \i scripts/ensure_glitter_acrylic_archived.sql
   ```

## Deployment

### Files Modified
- `netlify/functions/admin-products.ts` - Fixed filtering logic

### Files Created
- `scripts/ensure_glitter_acrylic_archived.sql` - SQL script for comprehensive archiving
- `scripts/test_product_filtering.js` - Test script for verification
- `scripts/check_glitter_acrylic_status.js` - Status check script

### Deployment Steps

1. **Deploy the fixed API function**:
   ```bash
   npm run deploy
   # or
   netlify deploy --prod
   ```

2. **Run the SQL script** (if needed):
   - Execute `scripts/ensure_glitter_acrylic_archived.sql` in your Supabase database

3. **Verify the fix**:
   - Check that Glitter Acrylic products no longer appear on the website
   - Test the API endpoints with different query parameters

## Expected Results

After implementing this fix:

1. **Glitter Acrylic products will no longer display** on the website by default
2. **Admin panel can still access archived products** when explicitly requested
3. **Consistent archiving behavior** across both archiving methods
4. **Improved performance** by not loading unnecessary archived products

## Rollback Plan

If issues arise, you can revert to the original behavior by:

1. Reverting the changes to `netlify/functions/admin-products.ts`
2. Using the original archive scripts if needed

## Additional Notes

- The fix handles both archiving methods (`is_active/archived` and `status`) for maximum compatibility
- The solution is backward compatible with existing API calls
- Default behavior now matches user expectations (only show active products)
- Admin users can still access archived products when needed