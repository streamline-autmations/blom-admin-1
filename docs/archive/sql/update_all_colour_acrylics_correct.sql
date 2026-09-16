-- SQL to update ALL Colour Acrylics products with CORRECT format
-- Uses proper ARRAY format for features, ingredients, claims
-- Based on Colour Acrylics - 019 successful template

-- Step 1: Update all product information with correct array format
UPDATE products SET 
    short_description = 'Professional grade polymer powder for perfect sculpting and strength.',
    description = 'Our Core Acrylic Powder is a professional-grade polymer designed for superior adhesion, smooth application, and exceptional strength. The self-leveling formula ensures a flawless finish with minimal filing required. Available in essential shades for every nail technician.',
    how_to_use = '1. Prep natural nail and apply primer\n2. Dip brush into monomer, then into powder\n3. Place bead onto nail and guide into place\n4. Allow to cure before filing',
    inci_ingredients = 'Polyethylmethacrylate, Polymethyl Methacrylate, Benzoyl Peroxide, Silica',
    features = ARRAY['Superior adhesion and longevity', 'Self-leveling buttery consistency', 'Non-yellowing formula', 'Medium setting time for perfect control', 'Bubble-free application'],
    key_ingredients = ARRAY['Advanced Polymers – for strength and flexibility', 'UV Inhibitors – prevents yellowing', 'Fine grade powder – for smooth consistency'],
    claims = ARRAY['HEMA-Free', 'Professional Grade', 'Non-Yellowing'],
    size = '15g',
    shelf_life = '24 months'
WHERE name LIKE 'Colour Acrylics -%';

-- Step 2: Verify the updates
SELECT 
    name,
    short_description,
    SUBSTRING(description, 1, 80) as description_preview,
    how_to_use as usage_instructions,
    inci_ingredients as inci_list,
    features as feature_list,
    key_ingredients as key_ingredients_list,
    claims as claim_list,
    size,
    shelf_life,
    is_active
FROM products 
WHERE name LIKE 'Colour Acrylics -%'
ORDER BY name;