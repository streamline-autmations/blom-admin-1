-- SQL to update ALL Colour Acrylics products (including drafts)
-- This updates stock, cost_price, and product_prices for all 32 variants
-- You can manually set the main price in admin if needed

-- Step 1: Update main product fields (stock and cost_price) for ALL products
UPDATE products SET
    stock = 100,
    cost_price = 100.00
WHERE name LIKE 'Colour Acrylics -%';

-- Step 2: Update product_prices table (this is what admin likely reads)
-- First, delete any existing price entries for these products
DELETE FROM product_prices
WHERE product_id IN (
    SELECT id FROM products
    WHERE name LIKE 'Colour Acrylics -%'
);

-- Then insert new price entries
INSERT INTO product_prices (product_id, price, effective_at)
SELECT
    id,
    150.00,  -- Set to R150.00
    NOW()
FROM products
WHERE name LIKE 'Colour Acrylics -%';

-- Step 3: Verify the updates
SELECT
    p.name,
    p.stock as inventory,
    p.cost_price,
    pp.price as product_price,
    p.is_active
FROM products p
LEFT JOIN product_prices pp ON p.id = pp.product_id
WHERE p.name LIKE 'Colour Acrylics -%'
ORDER BY p.name;