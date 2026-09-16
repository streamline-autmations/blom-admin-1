-- Fix Bundle Table Schema - Missing Columns
-- Run this SQL to fix the "Could not find the 'category' column" error

-- Add the missing category column to bundles table
ALTER TABLE bundles
ADD COLUMN IF NOT EXISTS category VARCHAR(255) DEFAULT 'Bundle Deals';

-- Add hover_image column if it doesn't exist
ALTER TABLE bundles
ADD COLUMN IF NOT EXISTS hover_image TEXT;

-- Add bundle_products column to bundles table for storing bundle product information
ALTER TABLE bundles
ADD COLUMN IF NOT EXISTS bundle_products JSONB DEFAULT '[]'::jsonb;

-- Add additional missing columns that might be needed
ALTER TABLE bundles
ADD COLUMN IF NOT EXISTS product_type VARCHAR(50) DEFAULT 'bundle',
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
ADD COLUMN IF NOT EXISTS gallery_urls JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS variants JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS how_to_use JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS inci_ingredients JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS key_ingredients JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS size TEXT,
ADD COLUMN IF NOT EXISTS shelf_life TEXT,
ADD COLUMN IF NOT EXISTS claims JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS meta_title TEXT,
ADD COLUMN IF NOT EXISTS meta_description TEXT,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS badges JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS related JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS stock_label TEXT DEFAULT 'In Stock',
ADD COLUMN IF NOT EXISTS price_string TEXT,
ADD COLUMN IF NOT EXISTS sku TEXT;

-- Add comments for documentation
COMMENT ON COLUMN bundles.category IS 'Product category for the bundle';
COMMENT ON COLUMN bundles.hover_image IS 'Hover image URL for bundle display';
COMMENT ON COLUMN bundles.bundle_products IS 'Array of product IDs and quantities that make up a bundle';
COMMENT ON COLUMN bundles.product_type IS 'Type of product (bundle)';
COMMENT ON COLUMN bundles.sku IS 'Stock keeping unit for the bundle';

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_bundles_category ON bundles(category);
CREATE INDEX IF NOT EXISTS idx_bundles_bundle_products ON bundles USING gin (bundle_products);
CREATE INDEX IF NOT EXISTS idx_bundles_product_type ON bundles(product_type);
CREATE INDEX IF NOT EXISTS idx_bundles_sku ON bundles(sku);

-- Update any existing bundles to have the default values if they are NULL
UPDATE bundles
SET category = 'Bundle Deals'
WHERE category IS NULL;

UPDATE bundles
SET product_type = 'bundle'
WHERE product_type IS NULL;

UPDATE bundles
SET stock_label = 'In Stock'
WHERE stock_label IS NULL;

UPDATE bundles
SET is_active = true
WHERE is_active IS NULL;

UPDATE bundles
SET is_featured = false
WHERE is_featured IS NULL;