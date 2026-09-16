# 🛠️ MANUAL SOLUTION - Add "Sweet Peach" Variant to Cuticle Oils

## QUICKEST METHOD - Use Your Browser

**Step 1:** Open this file in your browser: 
```
file:///c:/Users/User/Desktop/Repo Clones/blom-admin/variant-add-quick.html
```

**Step 2:** Click the "Add Sweet Peach Variant" button

**Step 3:** Wait for the success message

## ALTERNATIVE METHODS

### Method 1: Direct Admin Access
1. Go to your admin dashboard
2. Navigate to Products
3. Search for "Core Acrylics" or SKU: ACR-746344
4. Click "Edit Product"
5. Scroll to "Variants & Highlights" section
6. Click "+ Add variant"
7. Enter: **Sweet Peach**
8. Upload this image: `https://res.cloudinary.com/dnlgohkcc/image/upload/v1763740353/peach-cuticile_pd063t.jpg`
9. Save the product

### Method 2: Database Direct (If you have access)
```sql
-- Find the Core Acrylics product
SELECT id, name, variants FROM products WHERE sku = 'ACR-746344' OR name ILIKE '%core%acrylic%';

-- Add the variant (replace YOUR_PRODUCT_ID with actual ID)
UPDATE products 
SET variants = COALESCE(variants, '[]'::jsonb) || '[{"name": "Sweet Peach", "image": "https://res.cloudinary.com/dnlgohkcc/image/upload/v1763740353/peach-cuticile_pd063t.jpg"}]'::jsonb,
    updated_at = NOW()
WHERE id = 'YOUR_PRODUCT_ID';
```

### Method 3: API Call (if you have the correct product ID)
```bash
curl -X POST "https://blom-admin.netlify.app/.netlify/functions/save-product" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "YOUR_PRODUCT_ID",
    "partial_update": true,
    "variants": [
      {
        "name": "Sweet Peach",
        "image": "https://res.cloudinary.com/dnlgohkcc/image/upload/v1763740353/peach-cuticile_pd063t.jpg"
      }
    ]
  }'
```

## FILES CREATED FOR YOU

- `variant-add-quick.html` - Browser-based tool (RECOMMENDED)
- `manual-variant-add.html` - Advanced browser tool with debug info
- `add-variant-direct.html` - Simple direct addition tool
- `scripts/add-variant-final.js` - Node.js script (requires setup)
- `scripts/add-variant-simple.sh` - Shell script template

## RECOMMENDATION

Start with `variant-add-quick.html` - it's the easiest and most reliable method!

## IF NOTHING WORKS

1. Check that your Core Acrylics product exists in the admin
2. Try finding it by SKU: ACR-746344
3. If still not found, the product might have a different name
4. Use the manual admin method to add the variant directly

---

**The variant to add:**
- **Name:** Sweet Peach  
- **Image:** https://res.cloudinary.com/dnlgohkcc/image/upload/v1763740353/peach-cuticile_pd063t.jpg
- **Target Product:** Core Acrylics (SKU: ACR-746344)