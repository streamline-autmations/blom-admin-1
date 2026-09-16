-- Bundle Table Schema Fix - CRITICAL COLUMNS
-- This migration adds the missing stock and track_inventory columns that save-bundle.ts needs
-- Run this SQL to fix the "Could not find column" error

-- Add the CRITICAL missing columns that save-bundle.ts is trying to use
ALTER TABLE bundles
ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS track_inventory BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS stock_label TEXT DEFAULT 'In Stock';

-- Add other commonly used bundle columns
ALTER TABLE bundles
ADD COLUMN IF NOT EXISTS product_type VARCHAR(50) DEFAULT 'bundle',
ADD COLUMN IF NOT EXISTS category VARCHAR(255) DEFAULT 'Bundle Deals',
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active',
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS pricing_mode VARCHAR(50) DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS discount_value DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS short_desc TEXT,
ADD COLUMN IF NOT EXISTS long_desc TEXT,
ADD COLUMN IF NOT EXISTS hover_image TEXT,
ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS gallery_urls JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS bundle_products JSONB DEFAULT '[]'::jsonb;

-- Add timestamps if missing
ALTER TABLE bundles
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_bundles_category ON bundles(category);
CREATE INDEX IF NOT EXISTS idx_bundles_product_type ON bundles(product_type);
CREATE INDEX IF NOT EXISTS idx_bundles_status ON bundles(status);
CREATE INDEX IF NOT EXISTS idx_bundles_is_active ON bundles(is_active);
CREATE INDEX IF NOT EXISTS idx_bundles_bundle_products ON bundles USING gin (bundle_products);

-- Update existing bundles with proper defaults
UPDATE bundles SET 
  product_type = COALESCE(product_type, 'bundle'),
  category = COALESCE(category, 'Bundle Deals'),
  status = COALESCE(status, 'active'),
  is_active = COALESCE(is_active, true),
  track_inventory = COALESCE(track_inventory, false),
  stock = COALESCE(stock, 0),
  stock_label = COALESCE(stock_label, 'In Stock'),
  pricing_mode = COALESCE(pricing_mode, 'manual')
WHERE product_type IS NULL 
   OR category IS NULL 
   OR status IS NULL 
   OR is_active IS NULL 
   OR track_inventory IS NULL 
   OR stock IS NULL 
   OR stock_label IS NULL 
   OR pricing_mode IS NULL;

-- Ensure timestamps exist
UPDATE bundles SET 
  created_at = COALESCE(created_at, NOW()),
  updated_at = COALESCE(updated_at, NOW())
WHERE created_at IS NULL OR updated_at IS NULL;

-- Add helpful comments
COMMENT ON COLUMN bundles.stock IS 'Stock quantity for bundles (always 0 - bundles are virtual)';
COMMENT ON COLUMN bundles.track_inventory IS 'Whether to track inventory for this bundle (always false for bundles)';
COMMENT ON COLUMN bundles.bundle_products IS 'JSON array of {product_id, quantity} objects that make up this bundle';