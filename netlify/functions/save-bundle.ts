import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { withAdminAuth } from "./_lib/with-admin-auth";

const getSupabaseAdmin = () => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Missing Supabase environment variables');
  }
  
  return createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
};

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*'
};

// Helper to create a slug from a name
const slugify = (text: string) => {
  return text.toString().toLowerCase().trim()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
    .replace(/\-\-+/g, '-');        // Replace multiple - with single -
};

const baseHandler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    console.log('Received event body:', event.body);
    
    let payload;
    try {
      const body = JSON.parse(event.body || '{}');
      payload = body.payload || body; // Handle wrapped payload or direct body
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ ok: false, error: 'Invalid JSON in request body' })
      };
    }

    console.log('Processing bundle:', payload.name || 'Unnamed bundle');

    let supabase;
    try {
      supabase = getSupabaseAdmin();
    } catch (envError) {
      console.error('Environment variable error:', envError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ ok: false, error: 'Server configuration error: ' + envError.message })
      };
    }

    // Calculate price_cents from price if provided
    const priceCents = payload.price_cents ?? (payload.price ? Math.round(Number(payload.price) * 100) : 0);
    const compareAtPriceCents = payload.compare_at_price_cents ??
      (payload.compare_at_price ? Math.round(Number(payload.compare_at_price) * 100) : null);

    // product_type: 'collection' or 'bundle'
    // As per user request, ALL bundles/collections must be categorized as 'Bundle Deals' and type 'bundle'
    // const rawType = String(payload.product_type || '').toLowerCase();
    // const productType = (rawType === 'bundle' || rawType === 'bundle deals') ? 'bundle' : 'collection';
    const productType = 'bundle';
    
    // FORCE 'Bundle Deals' category regardless of type
    const category = 'Bundle Deals';

    // Ensure images/gallery has content
      const gallery = payload.gallery_urls || payload.images || [];
      if (gallery.length === 0 && payload.thumbnail_url) {
        gallery.push(payload.thumbnail_url);
      }

      // Create a default variant for the bundle so frontend product templates don't crash
      const defaultVariant = {
        id: `var_${Date.now()}`,
        name: 'Default Title',
        price: priceCents / 100,
        price_cents: priceCents,
        sku: payload.sku,
        inventory_quantity: 100, // Bundles are virtual, assume stock
        inventory_management: 'manual',
        option1: 'Default Title'
      };

      // Build bundle data for the bundles table
      const bundleData: any = {
        name: payload.name,
        slug: payload.slug || slugify(payload.name),
        sku: payload.sku || (productType === 'bundle' ? `BND-${Date.now()}` : `COL-${Date.now()}`),
        product_type: productType,
        category,
        status: 'active',
        is_active: true, 
        
        price_cents: priceCents,
        compare_at_price_cents: compareAtPriceCents,
        stock: 100, // Bundles are virtual — always in stock unless explicitly archived
        stock_label: 'In Stock',
        track_inventory: false,
        
        pricing_mode: payload.pricing_mode || 'manual',
        discount_value: payload.discount_value || null,
        
        short_desc: payload.short_description || payload.short_desc || '',
        long_desc: payload.overview || payload.long_desc || '',
        images: gallery,
        gallery_urls: gallery,
        thumbnail_url: payload.thumbnail_url || '',
        hover_image: payload.hover_url || payload.hover_image || null,
        
        badges: payload.badges || [],
        
        // Polyfill variants for frontend compatibility
        variants: [defaultVariant],

        // The components - saved as JSONB array in bundles table as well for easier access
      bundle_products: payload.bundle_products || [],
      
      updated_at: new Date().toISOString(),
    };

    let bundleResult;

    // Upsert: Update if ID exists, Insert if not
    if (payload.id) {
      // Update existing bundle
      const { data, error } = await supabase
        .from('bundles')
        .update(bundleData)
        .eq('id', payload.id)
        .select()
        .single();

      if (error) {
        console.error('Database Error updating bundle:', error);
        throw error;
      }
      bundleResult = data;
    } else {
      // Insert new bundle
      const { data, error } = await supabase
        .from('bundles')
        .insert(bundleData)
        .select()
        .single();

      if (error) {
        console.error('Database Error inserting bundle:', error);
        throw error;
      }
      bundleResult = data;
    }

    // Handle bundle_products (items) - save to bundle_items table
    if (payload.bundle_products && Array.isArray(payload.bundle_products) && payload.bundle_products.length > 0) {
      const bundleId = bundleResult.id;

      // First, delete existing items for this bundle
      const { error: deleteError } = await supabase
        .from('bundle_items')
        .delete()
        .eq('bundle_id', bundleId);

      if (deleteError) {
        console.error('Error deleting old bundle items:', deleteError);
        // Continue anyway, items might not exist yet
      }

      // Insert new items
      const bundleItems = payload.bundle_products
        .filter((item: any) => item.product_id)
        .map((item: any) => ({
          bundle_id: bundleId,
          product_id: item.product_id,
          variant_id: item.variant_id || null, // Save variant selection
          qty: item.quantity || item.qty || 1,
        }));

      if (bundleItems.length > 0) {
        const { error: insertError } = await supabase
          .from('bundle_items')
          .insert(bundleItems);

        if (insertError) {
          console.error('Error inserting bundle items:', insertError);
          throw insertError;
        }
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, bundle: bundleResult })
    };

  } catch (e: any) {
    console.error('Save Bundle Error:', e);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ ok: false, error: e.message })
    };
  }
};

export const handler = withAdminAuth(baseHandler);
