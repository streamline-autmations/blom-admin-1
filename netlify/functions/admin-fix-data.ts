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

    console.log('Starting Data Repair: Variants & Images Polyfill');

    const results = {
      productsChecked: 0,
      productsFixed: 0,
      bundlesChecked: 0,
      bundlesFixed: 0
    };

    // 1. Fetch ALL products
    const { data: products, error: prodError } = await supabase
      .from('products')
      .select('*');

    if (prodError) throw prodError;
    results.productsChecked = products.length;

    for (const p of products) {
      let needsUpdate = false;
      const updates: any = {};

      // Check Images
      // Ensure images/gallery_urls is populated
      let gallery = p.gallery_urls || p.images || [];
      // If gallery is empty but thumbnail exists, add it
      if ((!gallery || gallery.length === 0) && p.thumbnail_url) {
        gallery = [p.thumbnail_url];
        updates.gallery_urls = gallery;
        updates.images = gallery;
        needsUpdate = true;
      }

      // Check Variants
      // If no variants, create a default one
      let variants = p.variants || [];
      if ((!variants || variants.length === 0) && p.price_cents > 0) {
        variants = [{
          id: `fix_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          name: 'Default',
          price: p.price || (p.price_cents / 100),
          price_cents: p.price_cents,
          sku: p.sku || p.slug,
          inventory_quantity: p.stock_qty || p.stock || 0,
          inventory_management: 'manual',
          option1: 'Default'
        }];
        updates.variants = variants;
        needsUpdate = true;
      }

      if (needsUpdate) {
        await supabase.from('products').update(updates).eq('id', p.id);
        results.productsFixed++;
      }
    }

    // 2. Fetch ALL bundles
    const { data: bundles, error: bundError } = await supabase
      .from('bundles')
      .select('*');
    
    if (bundError) throw bundError;
    results.bundlesChecked = bundles.length;

    for (const b of bundles) {
      let needsUpdate = false;
      const updates: any = {};

      // Check Images
      let gallery = b.gallery_urls || b.images || [];
      if ((!gallery || gallery.length === 0) && b.thumbnail_url) {
        gallery = [b.thumbnail_url];
        updates.gallery_urls = gallery;
        updates.images = gallery;
        needsUpdate = true;
      }

      // Check Variants (Polyfill for frontend compatibility)
      let variants = b.variants || [];
      if (!variants || variants.length === 0) {
        variants = [{
          id: `fix_bnd_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          name: 'Default Title',
          price: b.price_cents ? (b.price_cents / 100) : 0,
          price_cents: b.price_cents || 0,
          sku: b.sku,
          inventory_quantity: 100, 
          inventory_management: 'manual',
          option1: 'Default Title'
        }];
        updates.variants = variants;
        needsUpdate = true;
      }

      if (needsUpdate) {
        await supabase.from('bundles').update(updates).eq('id', b.id);
        results.bundlesFixed++;
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        ok: true, 
        message: `Data repair complete.`,
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
