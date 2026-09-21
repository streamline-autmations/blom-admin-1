/**
 * Netlify Function: Apply Product Duplicate Consolidation
 * 
 * This function applies the product duplicate consolidation migration
 * to fix stock deduction and analytics issues.
 */

import { createClient } from '@supabase/supabase-js';
import { withAdminAuth } from "./_lib/with-admin-auth";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function baseHandler(_event, _context) {
  try {
    console.log('🚀 Starting Product Duplicate Consolidation...');
    
    // Step 1: Check current duplicates
    console.log('📊 Checking current duplicates...');
    const { data: currentProducts, error: fetchError } = await supabase
      .from('products')
      .select('id, name, stock, sku, is_active')
      .eq('is_active', true);
      
    if (fetchError) {
      throw new Error(`Failed to fetch products: ${fetchError.message}`);
    }
    
    console.log(`Found ${currentProducts.length} active products`);
    
    // Check for duplicates
    const productGroups = {};
    currentProducts.forEach(product => {
      const normalizedName = product.name.trim().toLowerCase();
      if (!productGroups[normalizedName]) {
        productGroups[normalizedName] = [];
      }
      productGroups[normalizedName].push(product);
    });
    
    const duplicates = Object.keys(productGroups).filter(name => 
      productGroups[name].length > 1
    );
    
    if (duplicates.length === 0) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          ok: true,
          message: 'No duplicates found - products already consolidated',
          duplicates: []
        })
      };
    }
    
    console.log(`Found ${duplicates.length} duplicate product groups`);
    
    // Step 2: Apply the consolidation migration for the known duplicates
    console.log('🔧 Applying consolidation for known duplicates...');
    
    // Define the duplicate mappings
    const duplicateMappings = [
      {
        remove: '5b006e50-c52f-464e-b39e-f6998120276b',
        keep: '23277fea-c7dc-4cbe-8efe-7f5b58718f81',
        name: 'Fairy Dust Top Coat'
      },
      {
        remove: 'd540fade-2e8d-442f-8082-a0c9eff34099',
        keep: 'a85cf490-9ae1-4a44-97f4-5918b4b03687',
        name: 'Orchid Manicure Table'
      }
    ];
    
    let totalUpdated = 0;
    const results = [];
    
    for (const mapping of duplicateMappings) {
      console.log(`Processing ${mapping.name}...`);
      
      // Check if remove product exists
      const { data: removeProduct } = await supabase
        .from('products')
        .select('id, stock')
        .eq('id', mapping.remove)
        .single();
        
      if (!removeProduct) {
        console.log(`Product ${mapping.remove} already removed or doesn't exist`);
        continue;
      }
      
      // Check order_items references
      const { data: orderItems } = await supabase
        .from('order_items')
        .select('id, order_id, quantity')
        .eq('product_id', mapping.remove);
        
      const orderItemCount = orderItems?.length || 0;
      console.log(`Found ${orderItemCount} order_items to update for ${mapping.name}`);
      
      // Update order_items references
      if (orderItemCount > 0) {
        const { error: updateOrderItemsError } = await supabase
          .from('order_items')
          .update({ product_id: mapping.keep })
          .eq('product_id', mapping.remove);
          
        if (updateOrderItemsError) {
          throw new Error(`Failed to update order_items for ${mapping.name}: ${updateOrderItemsError.message}`);
        }
        
        totalUpdated += orderItemCount;
      }
      
      // Check stock_movements references
      const { data: stockMovements } = await supabase
        .from('stock_movements')
        .select('id, quantity')
        .eq('product_id', mapping.remove);
        
      const stockMovementCount = stockMovements?.length || 0;
      console.log(`Found ${stockMovementCount} stock_movements to update for ${mapping.name}`);
      
      // Update stock_movements references
      if (stockMovementCount > 0) {
        const { error: updateStockMovementsError } = await supabase
          .from('stock_movements')
          .update({ product_id: mapping.keep })
          .eq('product_id', mapping.remove);
          
        if (updateStockMovementsError) {
          throw new Error(`Failed to update stock_movements for ${mapping.name}: ${updateStockMovementsError.message}`);
        }
        
        totalUpdated += stockMovementCount;
      }
      
      // Check bundle_items references
      const { data: bundleItems } = await supabase
        .from('bundle_items')
        .select('id, quantity')
        .eq('product_id', mapping.remove);
        
      const bundleItemCount = bundleItems?.length || 0;
      console.log(`Found ${bundleItemCount} bundle_items to update for ${mapping.name}`);
      
      // Update bundle_items references
      if (bundleItemCount > 0) {
        const { error: updateBundleItemsError } = await supabase
          .from('bundle_items')
          .update({ product_id: mapping.keep })
          .eq('product_id', mapping.remove);
          
        if (updateBundleItemsError) {
          throw new Error(`Failed to update bundle_items for ${mapping.name}: ${updateBundleItemsError.message}`);
        }
        
        totalUpdated += bundleItemCount;
      }
      
      // Get keep product to consolidate stock
      const { data: keepProduct } = await supabase
        .from('products')
        .select('stock')
        .eq('id', mapping.keep)
        .single();
        
      if (keepProduct) {
        // Consolidate stock: add remove product stock to keep product stock
        const newStock = (keepProduct.stock || 0) + (removeProduct.stock || 0);
        
        const { error: updateStockError } = await supabase
          .from('products')
          .update({ 
            stock: newStock,
            updated_at: new Date().toISOString()
          })
          .eq('id', mapping.keep);
          
        if (updateStockError) {
          throw new Error(`Failed to update stock for ${mapping.name}: ${updateStockError.message}`);
        }
        
        console.log(`Consolidated stock: ${mapping.name} = ${newStock} (was ${keepProduct.stock} + ${removeProduct.stock})`);
      }
      
      // Delete the duplicate product
      const { error: deleteError } = await supabase
        .from('products')
        .delete()
        .eq('id', mapping.remove);
        
      if (deleteError) {
        throw new Error(`Failed to delete duplicate product ${mapping.name}: ${deleteError.message}`);
      }
      
      results.push({
        name: mapping.name,
        removed_id: mapping.remove,
        kept_id: mapping.keep,
        order_items_updated: orderItemCount,
        stock_movements_updated: stockMovementCount,
        bundle_items_updated: bundleItemCount
      });
      
      console.log(`✅ Successfully consolidated ${mapping.name}`);
    }
    
    // Step 3: Verify the fix
    console.log('🔍 Verifying consolidation...');
    const { data: verifyProducts, error: verifyError } = await supabase
      .from('products')
      .select('id, name, stock, sku, is_active')
      .eq('is_active', true);
      
    if (verifyError) {
      throw new Error(`Verification failed: ${verifyError.message}`);
    }
    
    // Check for remaining duplicates
    const verifyGroups = {};
    verifyProducts.forEach(product => {
      const normalizedName = product.name.trim().toLowerCase();
      if (!verifyGroups[normalizedName]) {
        verifyGroups[normalizedName] = [];
      }
      verifyGroups[normalizedName].push(product);
    });
    
    const remainingDuplicates = Object.keys(verifyGroups).filter(name => 
      verifyGroups[name].length > 1
    );
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        ok: true,
        message: 'Product duplicate consolidation completed successfully',
        summary: {
          total_references_updated: totalUpdated,
          products_consolidated: results.length,
          remaining_duplicates: remainingDuplicates.length,
          total_products_after: verifyProducts.length
        },
        consolidated_products: results,
        remaining_duplicates: remainingDuplicates,
        verification: {
          total_products: verifyProducts.length,
          active_products: verifyProducts.filter(p => p.is_active).length
        }
      })
    };
    
  } catch (error) {
    console.error('❌ Consolidation failed:', error);
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        ok: false,
        error: error.message || 'Unknown error occurred'
      })
    };
  }
}

export const handler = withAdminAuth(baseHandler);
