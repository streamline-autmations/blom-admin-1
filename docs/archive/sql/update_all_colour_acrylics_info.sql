-- SQL to update ALL product information for Colour Acrylics products
-- This updates descriptions, features, usage, ingredients for all 32 variants
-- Based on the successful Colour Acrylics - 019 template

-- Step 1: Update all product information fields
UPDATE products SET 
    short_description = 'Professional grade polymer powder for perfect sculpting and strength.',
    description = 'Our Core Acrylic Powder is a professional-grade polymer designed for superior adhesion, smooth application, and exceptional strength. The self-leveling formula ensures a flawless finish with minimal filing required. Available in essential shades for every nail technician.',
    how_to_use = '<ol><li>Prep natural nail and apply primer</li><li>Dip brush into monomer, then into powder</li><li>Place bead onto nail and guide into place</li><li>Allow to cure before filing</li></ol>',
    inci_ingredients = '<p><strong>INCI Names:</strong><br>Polyethylmethacrylate<br>Polymethyl Methacrylate<br>Benzoyl Peroxide<br>Silica</p><p><strong>Key Ingredients:</strong></p><ul><li>Advanced Polymers – for strength and flexibility</li><li>UV Inhibitors – prevents yellowing</li><li>Fine grade powder – for smooth consistency</li></ul>',
    features = '<ul><li>Superior adhesion and longevity</li><li>Self-leveling buttery consistency</li><li>Non-yellowing formula</li><li>Medium setting time for perfect control</li><li>Bubble-free application</li></ul>',
    details = '<ul><li><strong>Size:</strong> 15g</li><li><strong>Shelf Life:</strong> 24 months</li><li><strong>Claims:</strong> HEMA-Free, Professional Grade, Non-Yellowing</li></ul>'
WHERE name LIKE 'Colour Acrylics -%';

-- Step 2: Verify the updates
SELECT 
    name,
    short_description,
    SUBSTRING(description, 1, 80) as description_preview,
    SUBSTRING(how_to_use, 1, 50) as how_to_preview,
    SUBSTRING(inci_ingredients, 1, 50) as inci_preview,
    is_active
FROM products 
WHERE name LIKE 'Colour Acrylics -%'
ORDER BY name;