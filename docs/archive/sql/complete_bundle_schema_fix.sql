-- Complete Bundle Table Schema Fix
-- This adds ALL columns that the bundle system actually uses
-- Run this SQL to fix all bundle table schema errors

-- Core bundle identification columns
ALTER TABLE bundles
ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS name TEXT NOT NULL,
ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS sku TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS product_type VARCHAR(50) DEFAULT 'bundle',
ADD COLUMN IF NOT EXISTS category VARCHAR(255) DEFAULT 'Bundle Deals',
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active',
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false,

-- Pricing columns
ADD COLUMN IF NOT EXISTS price_cents INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS compare_at_price_cents INTEGER,
ADD COLUMN IF NOT EXISTS pricing_mode VARCHAR(50) DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS discount_value DECIMAL(10,2),

-- Stock and inventory columns (CRITICAL - these are missing!)
ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS track_inventory BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS stock_label TEXT DEFAULT 'In Stock',

-- Content columns
ADD COLUMN IF NOT EXISTS short_desc TEXT,
ADD COLUMN IF NOT EXISTS long_desc TEXT,
ADD COLUMN IF NOT EXISTS description TEXT,

-- Image columns
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
ADD COLUMN IF NOT EXISTS hover_image TEXT,
ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS gallery_urls JSONB DEFAULT '[]'::jsonb,

-- Product details columns
ADD COLUMN IF NOT EXISTS variants JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS how_to_use JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS inci_ingredients JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS key_ingredients JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS size TEXT,
ADD COLUMN IF NOT EXISTS shelf_life TEXT,
ADD COLUMN IF NOT EXISTS claims JSONB DEFAULT '[]'::jsonb,

-- Bundle-specific columns
ADD COLUMN IF NOT EXISTS bundle_products JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb,

-- SEO and metadata columns
ADD COLUMN IF NOT EXISTS meta_title TEXT,
ADD COLUMN IF NOT EXISTS meta_description TEXT,
ADD COLUMN IF NOT EXISTS badges JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS related JSONB DEFAULT '[]'::jsonb,

-- Display columns
ADD COLUMN IF NOT EXISTS price_string TEXT,
ADD COLUMN IF NOT EXISTS weight DECIMAL(10,3),
ADD COLUMN IF NOT EXISTS barcode TEXT,

-- Timestamps (if not exists)
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Set primary key if not set
ALTER TABLE bundles ADD CONSTRAINT bundles_pkey PRIMARY KEY (id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_bundles_category ON bundles(category);
CREATE INDEX IF NOT EXISTS idx_bundles_product_type ON bundles(product_type);
CREATE INDEX IF NOT EXISTS idx_bundles_status ON bundles(status);
CREATE INDEX IF NOT EXISTS idx_bundles_is_active ON bundles(is_active);
CREATE INDEX IF NOT EXISTS idx_bundles_sku ON bundles(sku);
CREATE INDEX IF NOT EXISTS idx_bundles_slug ON bundles(slug);
CREATE INDEX IF NOT EXISTS idx_bundles_bundle_products ON bundles USING gin (bundle_products);
CREATE INDEX IF NOT EXISTS idx_bundles_images ON bundles USING gin (images);
CREATE INDEX IF NOT EXISTS idx_bundles_created_at ON bundles(created_at);

-- Add comments for documentation
COMMENT ON COLUMN bundles.stock IS 'Stock quantity for the bundle (always 0 for bundles)';
COMMENT ON COLUMN bundles.track_inventory IS 'Whether to track inventory for this bundle';
COMMENT ON COLUMN bundles.bundle_products IS 'JSON array of product IDs and quantities that make up this bundle';
COMMENT ON COLUMN bundles.images IS 'JSON array of image URLs for the bundle';
COMMENT ON COLUMN bundles.pricing_mode IS 'Pricing mode: manual, percent_off, or amount_off';
COMMENT ON COLUMN bundles.discount_value IS 'Discount value based on pricing mode';

-- Update existing bundles with proper defaults
UPDATE bundles SET 
  product_type = 'bundle',
  category = 'Bundle Deals',
  status = 'active',
  is_active = true,
  track_inventory = false,
  stock = 0,
  stock_label = 'In Stock'
WHERE product_type IS NULL;

-- Ensure timestamps are set
UPDATE bundles SET 
  created_at = NOW(),
  updated_at = NOW()
WHERE created_at IS NULL OR updated_at IS NULL;

-- Set the updated_at trigger if it doesn't exist
DROP TRIGGER IF EXISTS update_bundles_updated_at ON bundles;
CREATE TRIGGER update_bundles_updated_at
  BEFORE UPDATE ON bundles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();