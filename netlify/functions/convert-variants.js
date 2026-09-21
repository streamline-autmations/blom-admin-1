// Netlify Function: Convert JSON variants to separate products
// This function will convert existing JSON variants into separate products

import { createClient } from '@supabase/supabase-js';
import { withAdminAuth } from "./_lib/admin-auth.js";

const baseHandler = async (event, _context) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: 'OK'
    };
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔄 Starting variant conversion...');

    // Step 1: Add variant columns if they don't exist
    console.log('📝 Adding variant columns...');
    
    await supabase.rpc('exec', {
      query: `
        -- Add variant columns if they don't exist
        DO $$ 
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'parent_product_id') THEN
            ALTER TABLE products ADD COLUMN parent_product_id uuid REFERENCES products(id);
          END IF;
          
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'variant_index') THEN
            ALTER TABLE products ADD COLUMN variant_index int;
          END IF;
          
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'variant_of_product') THEN
            ALTER TABLE products ADD COLUMN variant_of_product uuid REFERENCES products(id);
          END IF;
          
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'is_variant') THEN
            ALTER TABLE products ADD COLUMN is_variant boolean DEFAULT false;
          END IF;
          
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'variant_name') THEN
            ALTER TABLE products ADD COLUMN variant_name text;
          END IF;
          
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'has_variants') THEN
            ALTER TABLE products ADD COLUMN has_variants boolean DEFAULT false;
          END IF;
        END $$;
      `
    });

    // Step 2: Get products with variants
    console.log('📋 Fetching products with variants...');
    
    const { data: productsWithVariants, error: fetchError } = await supabase
      .from('products')
      .select('*')
      .not('variants', 'is', null)
      .not('variants', 'eq', '[]')
      .not('variants', 'eq', 'null');

    if (fetchError) {
      throw new Error(`Failed to fetch products: ${fetchError.message}`);
    }

    console.log(`📊 Found ${productsWithVariants.length} products with variants`);

    if (productsWithVariants.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          ok: true,
          message: 'No products with variants found to convert',
          converted: 0
        })
      };
    }

    let convertedCount = 0;
    let parentProducts = new Set();

    // Step 3: Convert each product's variants to separate products
    for (const product of productsWithVariants) {
      console.log(`🔄 Converting variants for product: ${product.name}`);
      
      try {
        const variants = product.variants;
        
        if (!Array.isArray(variants) || variants.length === 0) {
          console.log(`⚠️ No valid variants for product ${product.name}`);
          continue;
        }

        // Process each variant
        for (let i = 0; i < variants.length; i++) {
          const variant = variants[i];
          
          if (!variant) {
            console.log(`⚠️ Empty variant at index ${i} for product ${product.name}`);
            continue;
          }

          // Extract variant data
          const variantName = variant.name || variant.label || `Variant ${i + 1}`;
          const variantStock = variant.stock || product.stock || 0;
          const variantPrice = variant.price || product.price;
          const variantImage = variant.image || variant.image_url || product.image_url;
          const variantSKU = variant.sku || `${product.sku || 'SKU'}-${variantName.replace(/\s+/g, '-')}`;
          
          // Create the variant product
          const variantProduct = {
            name: `${product.name} - ${variantName}`,
            slug: `${product.name}-${variantName}`.toLowerCase().replace(/\s+/g, '-'),
            price: variantPrice,
            price_cents: variantPrice,
            stock: variantStock,
            stock_qty: variantStock,
            sku: variantSKU,
            short_description: product.short_description || '',
            long_description: product.long_description || '',
            image_url: variantImage,
            status: product.status,
            is_active: product.is_active,
            is_featured: product.is_featured,
            category: product.category,
            tags: product.tags,
            weight_grams: product.weight_grams,
            length_cm: product.length_cm,
            width_cm: product.width_cm,
            height_cm: product.height_cm,
            
            // Link to parent
            parent_product_id: product.id,
            variant_index: i,
            variant_of_product: product.id,
            is_variant: true,
            variant_name: variantName
          };

          console.log(`✅ Creating variant: ${variantProduct.name}`);
          
          const { error: insertError } = await supabase
            .from('products')
            .insert([variantProduct]);

          if (insertError) {
            console.error(`❌ Failed to insert variant: ${insertError.message}`);
            continue;
          }

          convertedCount++;
          parentProducts.add(product.id);
        }

        console.log(`✅ Converted ${variants.length} variants for ${product.name}`);

      } catch (productError) {
        console.error(`❌ Error processing product ${product.name}:`, productError);
        continue;
      }
    }

    // Step 4: Update parent products
    console.log('📝 Updating parent products...');
    
    if (parentProducts.size > 0) {
      const { error: updateError } = await supabase
        .from('products')
        .update({ 
          has_variants: true,
          variants: null
        })
        .in('id', Array.from(parentProducts));

      if (updateError) {
        console.error('❌ Failed to update parent products:', updateError);
      }
    }

    // Step 5: Add indexes
    console.log('🔧 Adding performance indexes...');
    
    await supabase.rpc('exec', {
      query: `
        CREATE INDEX IF NOT EXISTS idx_products_parent_product_id ON products(parent_product_id);
        CREATE INDEX IF NOT EXISTS idx_products_variant_of_product ON products(variant_of_product);
        CREATE INDEX IF NOT EXISTS idx_products_is_variant ON products(is_variant);
        CREATE INDEX IF NOT EXISTS idx_products_variant_index ON products(variant_index);
      `
    });

    console.log('🎉 Variant conversion completed!');
    
    // Return success response
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        message: 'Variant conversion completed successfully',
        converted: convertedCount,
        parentProducts: parentProducts.size,
        details: {
          totalProductsWithVariants: productsWithVariants.length,
          variantsCreated: convertedCount,
          parentProductsUpdated: parentProducts.size
        }
      })
    };

  } catch (error) {
    console.error('❌ Variant conversion failed:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        ok: false,
        error: error.message,
        message: 'Variant conversion failed'
      })
    };
  }
};

export const handler = withAdminAuth(baseHandler);
