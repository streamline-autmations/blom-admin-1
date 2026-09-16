-- Direct SQL script to add Sweet Peach variant to Core Acrylics
-- Run this in your Supabase SQL editor or PostgreSQL client

-- Step 1: Find the Core Acrylics product
SELECT id, name, sku, variants 
FROM products 
WHERE sku = 'ACR-746344' 
   OR name ILIKE '%core%acrylic%' 
   OR name ILIKE '%cuticle%oil%'
LIMIT 5;

-- Step 2: Add the Sweet Peach variant (replace YOUR_PRODUCT_ID with the actual ID from Step 1)
UPDATE products 
SET variants = COALESCE(variants, '[]'::jsonb) || 
       '[{"name": "Sweet Peach", "image": "https://res.cloudinary.com/dnlgohkcc/image/upload/v1763740353/peach-cuticile_pd063t.jpg"}]'::jsonb,
    updated_at = NOW()
WHERE id = 'YOUR_PRODUCT_ID';

-- Step 3: Verify the variant was added
SELECT name, variants->>0 as first_variant 
FROM products 
WHERE id = 'YOUR_PRODUCT_ID';

-- Alternative: If the product doesn't exist, you can create it
INSERT INTO products (
    name, 
    sku, 
    category, 
    price, 
    stock, 
    variants,
    status,
    is_active,
    created_at,
    updated_at
) VALUES (
    'Core Acrylics Cuticle Oil',
    'ACR-746344',
    'Prep & Finish',
    199.00,
    50,
    '[{"name": "Sweet Peach", "image": "https://res.cloudinary.com/dnlgohkcc/image/upload/v1763740353/peach-cuticile_pd063t.jpg"}]'::jsonb,
    'active',
    true,
    NOW(),
    NOW()
) ON CONFLICT (sku) DO UPDATE SET
    variants = EXCLUDED.variants,
    updated_at = NOW();