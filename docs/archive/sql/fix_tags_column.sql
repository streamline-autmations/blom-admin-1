-- Fix: Add missing 'tags' column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS tags text[];

-- Drop and recreate the function without the tags column reference
DROP FUNCTION IF EXISTS convert_variants_to_products();

-- Create fixed function that doesn't reference missing tags column
CREATE OR REPLACE FUNCTION convert_variants_to_products()
RETURNS void AS $$
DECLARE
  parent_product RECORD;
  variant_json jsonb;
  variant_name text;
  variant_stock int;
  variant_price int;
  variant_image text;
  variant_sku text;
  variant_index int;
  new_product_id uuid;
  count_converted int := 0;
BEGIN
  -- Loop through each product with variants
  FOR parent_product IN 
    SELECT id, name, variants, price, stock, sku, image_url, status, is_active, is_featured, category, weight_grams, length_cm, width_cm, height_cm, short_description, long_description
    FROM products 
    WHERE variants IS NOT NULL 
    AND variants != '[]'::jsonb
    AND variants != 'null'
    AND jsonb_array_length(variants) > 0
  LOOP
    -- Loop through each variant in the JSON array
    FOR variant_index IN 0..(jsonb_array_length(parent_product.variants) - 1)
    LOOP
      -- Get variant data - extract individual fields
      variant_json := parent_product.variants -> variant_index;
      
      -- Extract variant information (safe extraction)
      variant_name := COALESCE(variant_json ->> 'name', variant_json ->> 'label', 'Variant ' || (variant_index + 1));
      variant_stock := COALESCE((variant_json ->> 'stock')::int, parent_product.stock, 0);
      variant_price := COALESCE((variant_json ->> 'price')::int, parent_product.price, parent_product.price);
      variant_image := COALESCE(variant_json ->> 'image', variant_json ->> 'image_url', parent_product.image_url);
      variant_sku := COALESCE(variant_json ->> 'sku', parent_product.sku || '-' || variant_name);
      
      -- Generate new product ID for variant
      new_product_id := gen_random_uuid();
      
      -- Create the variant product
      INSERT INTO products (
        id,
        name,
        slug,
        price,
        price_cents,
        stock,
        stock_qty,
        sku,
        short_description,
        long_description,
        image_url,
        status,
        is_active,
        is_featured,
        category,
        tags,
        weight_grams,
        length_cm,
        width_cm,
        height_cm,
        created_at,
        updated_at,
        -- Variant-specific fields
        parent_product_id,
        variant_index,
        variant_of_product,
        is_variant,
        variant_name
      )
      VALUES (
        new_product_id,
        parent_product.name || ' - ' || variant_name,
        parent_product.name || '-' || variant_name,
        variant_price,
        variant_price,
        variant_stock,
        variant_stock,
        variant_sku,
        parent_product.short_description,
        parent_product.long_description,
        variant_image,
        parent_product.status,
        parent_product.is_active,
        parent_product.is_featured,
        parent_product.category,
        NULL, -- No tags for now
        parent_product.weight_grams,
        parent_product.length_cm,
        parent_product.width_cm,
        parent_product.height_cm,
        NOW(),
        NOW(),
        -- Link to parent
        parent_product.id,
        variant_index,
        parent_product.id,
        true,
        variant_name
      );
      
      count_converted := count_converted + 1;
    END LOOP;
    
    -- Mark parent as having variants
    UPDATE products 
    SET has_variants = true
    WHERE id = parent_product.id;
  END LOOP;
  
  -- Clear variants from parent products
  UPDATE products 
  SET variants = NULL
  WHERE has_variants = true;
  
  RAISE NOTICE 'Converted % variants to separate products', count_converted;
END;
$$ LANGUAGE plpgsql;

-- Execute the conversion
SELECT convert_variants_to_products();

-- Summary query
DO $$
DECLARE
  parent_count int;
  variant_count int;
  regular_count int;
BEGIN
  SELECT COUNT(DISTINCT parent_product_id) INTO parent_count
  FROM products 
  WHERE is_variant = true;
  
  SELECT COUNT(*) INTO variant_count
  FROM products 
  WHERE is_variant = true;
  
  SELECT COUNT(*) INTO regular_count
  FROM products 
  WHERE (is_variant = false OR is_variant IS NULL) AND has_variants = false;
  
  RAISE NOTICE '=== VARIANT CONVERSION SUMMARY ===';
  RAISE NOTICE 'Parent Products with Variants: %', parent_count;
  RAISE NOTICE 'Total Variant Products Created: %', variant_count;
  RAISE NOTICE 'Regular Products (no variants): %', regular_count;
  RAISE NOTICE '=== CONVERSION COMPLETE ===';
END $$;