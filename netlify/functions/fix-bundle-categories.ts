import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { withAdminAuth } from "./_lib/with-admin-auth";

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*'
};

const baseHandler: Handler = async (event) => {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !serviceKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ ok: false, error: 'Missing Supabase environment variables' })
      };
    }
    
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    console.log('Starting Aggressive Category Merge: Bundles/Collections -> Bundle Deals');

    const results = {
      bundlesUpdated: 0,
      productsUpdated: 0,
      specificFixes: 0
    };

    // 1. Update BUNDLES table
    // Move anything with "Bundle" or "Collection" in the category name to "Bundle Deals"
    // Also set product_type to 'bundle'
    const { data: bundlesData, error: bundlesError } = await supabase
      .from('bundles')
      .update({ 
        category: 'Bundle Deals',
        product_type: 'bundle' 
      })
      .or('category.ilike.*Bundle*,category.ilike.*Collection*') 
      .neq('category', 'Bundle Deals') // Don't update if already correct (optional optimization)
      .select('id');
    
    if (bundlesError) {
        console.error('Error updating bundles:', bundlesError);
        // Fallback: try simpler query if wildcard fails (Supabase js sometimes tricky with OR + wildcards)
    } else {
        results.bundlesUpdated = bundlesData?.length || 0;
    }

    // 2. Update PRODUCTS table
    // Same logic
    const { data: productsData, error: productsError } = await supabase
      .from('products')
      .update({ 
        category: 'Bundle Deals'
        // We don't touch product_type here as it might not exist or be different structure
      })
      .or('category.ilike.*Bundle*,category.ilike.*Collection*')
      .neq('category', 'Bundle Deals')
      .select('id');

    if (productsError) {
         console.error('Error updating products:', productsError);
    } else {
        results.productsUpdated = productsData?.length || 0;
    }

    // 3. Force specific products (legacy list) just in case
    const targetNames = [
      'Red Collection',
      'High Tea Brigerton Combo',
      'Blossom Sugar Rush Collection',
      'Snowberry Christmas Collection',
      'Petal Collection Bundle',
      'Pastel Acrylic Collection',
      'Blooming Love Acrylic Collection'
    ];

    const { data: specificData, error: specificError } = await supabase
      .from('bundles')
      .update({ 
        product_type: 'bundle',
        category: 'Bundle Deals'
      })
      .in('name', targetNames)
      .select('id, name');

    if (specificError) throw specificError;
    results.specificFixes = specificData?.length || 0;

    console.log('Merge successful:', results);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        ok: true, 
        message: `Merged categories successfully.`,
        details: results
      })
    };

  } catch (e: any) {
    console.error('Script Error:', e);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ ok: false, error: e.message })
    };
  }
};

export const handler = withAdminAuth(baseHandler);
