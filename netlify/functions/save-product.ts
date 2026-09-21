import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { withAdminAuth } from "./_lib/with-admin-auth";

const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

const baseHandler: Handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, headers, body: JSON.stringify({ ok: false, error: 'Method Not Allowed' }) };
    }
    if (!event.body) {
      return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'Empty body' }) };
    }

    // Parse body defensively
    let body: any;
    try {
      body = typeof event.body === 'string'
        ? (event.body ? JSON.parse(event.body) : {})
        : (event.body || {});
    } catch (e) {
      return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'Invalid JSON: ' + (e instanceof Error ? e.message : String(e)) }) };
    }

    // Unwrap payload if wrapped
    if (body.payload) {
      body = body.payload;
    }

    // Diagnostic dryRun
    if (body?.dryRun) {
      const supabaseUrl = process.env.SUPABASE_URL!;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
      if (!supabaseUrl || !serviceKey) {
        return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: 'Server not configured (SUPABASE envs missing)' }) };
      }
      const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
      const { data, error } = await admin.from('products').select('id').limit(1);
      if (error) {
        return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: `products select failed: ${error.message}` }) };
      }
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, note: 'products selectable', sample: (data||[]).map((r:any)=>r.id) }) };
    }

    // Handle delete action
    if (body?.action === 'delete' || body?._action === 'delete') {
      const id = body.id;
      const slug = body.slug;

      if (!id && !slug) {
        return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'Delete requires id or slug' }) };
      }

      const supabaseUrl = process.env.SUPABASE_URL!;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
      if (!supabaseUrl || !serviceKey) {
        return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: 'Server not configured (SUPABASE envs missing)' }) };
      }
      const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

      const { error } = await admin
        .from('products')
        .delete()
        .match(id ? { id } : { slug });

      if (error) {
        return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: `DB error: ${error.message}` }) };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok: true, deleted: true })
      };
    }

    // Handle archive/partial update (status change only) - when id is provided but no name/slug
    // IMPORTANT: Skip this path if price is provided (for price-only updates)
    if (body?.id && body?.status && !body?.name && !body?.slug && body?.price === undefined) {
      const supabaseUrl = process.env.SUPABASE_URL!;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
      if (!supabaseUrl || !serviceKey) {
        return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: 'Server not configured (SUPABASE envs missing)' }) };
      }
      const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

      // Validate status
      const validStatuses = ['draft', 'active', 'published', 'archived'];
      const status = validStatuses.includes(body.status) ? body.status : null;
      if (!status) {
        return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'Invalid status value' }) };
      }

      const updateData: any = {
        status: status,
        is_active: status === 'active' || status === 'published',
        updated_at: new Date().toISOString(),
      };

      // Include is_active if explicitly provided
      if (body.is_active !== undefined) {
        updateData.is_active = body.is_active;
      }

      const { data, error } = await admin
        .from('products')
        .update(updateData)
        .eq('id', body.id)
        .select('*')
        .single();

      if (error) {
        return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: `DB error: ${error.message}` }) };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok: true, product: data })
      };
    }

    // Handle PARTIAL updates - when id is provided with only specific fields to update
    // This preserves all other fields (like images) that weren't explicitly provided
    if (body?.id && body?.partial_update === true) {
      const supabaseUrl = process.env.SUPABASE_URL!;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
      if (!supabaseUrl || !serviceKey) {
        return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: 'Server not configured (SUPABASE envs missing)' }) };
      }
      const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      // Only include fields that are explicitly provided in the request
      if (body.name !== undefined) updateData.name = String(body.name).trim();
      if (body.slug !== undefined) updateData.slug = String(body.slug).trim();
      if (body.sku !== undefined) updateData.sku = body.sku;
      if (body.category !== undefined) updateData.category = body.category;

      if (body.status !== undefined) {
        const validStatuses = ['draft', 'active', 'published', 'archived'];
        if (validStatuses.includes(body.status)) {
          updateData.status = body.status;
          updateData.is_active = body.status === 'active' || body.status === 'published';
        }
      }

      // Price fields
      if (body.price !== undefined) {
        const price = Number(body.price);
        if (Number.isFinite(price)) {
          updateData.price = price;
          updateData.price_cents = Math.round(price * 100);
        }
      }
      if (body.compare_at_price !== undefined) {
        const compareAt = body.compare_at_price == null ? null : Number(body.compare_at_price);
        updateData.compare_at_price = compareAt;
        updateData.compare_at_price_cents = compareAt != null ? Math.round(compareAt * 100) : null;
      }

      // Stock fields - sync all stock columns
      if (body.stock !== undefined || body.inventory_quantity !== undefined) {
        const stock = Number(body.stock ?? body.inventory_quantity ?? 0);
        if (Number.isFinite(stock)) {
          updateData.stock = stock;
          updateData.stock_on_hand = stock;
          updateData.stock_qty = stock;
          updateData.stock_quantity = stock;
        }
      }

      // Description fields
      if (body.short_description !== undefined) updateData.short_description = body.short_description;
      if (body.overview !== undefined) updateData.overview = body.overview;

      // Image fields
      if (body.thumbnail_url !== undefined) updateData.thumbnail_url = body.thumbnail_url;
      if (body.gallery_urls !== undefined) updateData.gallery_urls = Array.isArray(body.gallery_urls) ? body.gallery_urls : [];
      if (body.hover_url !== undefined || body.hover_image !== undefined) {
        updateData.hover_url = body.hover_url || body.hover_image || null;
      }

      // Product details arrays
      const rawVariants = Array.isArray(body.variants) ? body.variants : [];
      // Ensure at least one variant exists if price is set, to prevent frontend crashes
      if (rawVariants.length === 0 && Number.isFinite(price)) {
        rawVariants.push({
          id: crypto.randomUUID(), // Generate a temporary ID if needed, or let DB handle it if it's a separate table. 
          // However, for JSONB variants column, we just need the object.
          name: 'Default',
          price: price,
          price_cents: Math.round(price * 100),
          sku: body.sku || slug,
          inventory_quantity: stock,
          inventory_management: 'manual',
          option1: 'Default'
        });
      }

      // Ensure images array has at least the thumbnail if empty
      let gallery = Array.isArray(body.gallery_urls) ? body.gallery_urls : [];
      if (gallery.length === 0 && body.thumbnail_url) {
        gallery = [body.thumbnail_url];
      }

      updateData.variants = rawVariants;
      updateData.gallery_urls = gallery;
      
      // Only set 'images' column if it exists in schema (legacy support)
      // Since 'images' column might be removed or not in cache, we should rely on gallery_urls
      // But for compatibility with older code reading 'images', we keep it if possible.
      // If DB error occurs about missing column, we should probably remove this line or handle it.
      // For now, let's keep it but be aware. 
      // UPDATE: User reported "Could not find the 'images' column". 
      // We should remove this sync or wrap it.
      // Better yet, just don't send it if we suspect it's gone.
      // updateData.images = gallery; 

      if (body.size !== undefined) updateData.size = body.size;
      if (body.shelf_life !== undefined) updateData.shelf_life = body.shelf_life;
      if (body.weight !== undefined) updateData.weight = body.weight;

      // Cost price
      if (body.cost_price_cents !== undefined) updateData.cost_price_cents = body.cost_price_cents;

      // Meta
      if (body.meta_title !== undefined) updateData.meta_title = body.meta_title;
      if (body.meta_description !== undefined) updateData.meta_description = body.meta_description;
      if (body.is_active !== undefined) updateData.is_active = body.is_active;
      if (body.is_featured !== undefined) updateData.is_featured = body.is_featured;
      if (body.related !== undefined) updateData.related = Array.isArray(body.related) ? body.related : [];

      const { data, error } = await admin
        .from('products')
        .update(updateData)
        .eq('id', body.id)
        .select('*')
        .single();

      if (error) {
        return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: `DB error: ${error.message}` }) };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok: true, product: data })
      };
    }

    // Validate requireds (name, slug, price)
    const name = String(body.name || '').trim();
    const slug = String(body.slug || '').trim();
    const price = Number(body.price);
    const stock = Number(body.stock ?? body.inventory_quantity ?? 0);
    const out_of_stock = body.out_of_stock === true;

    if (!name || !slug) {
      return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'Missing required fields (name, slug)' }) };
    }
    if (!Number.isFinite(price)) {
      return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'Invalid price' }) };
    }
    if (!Number.isFinite(stock)) {
      return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'Invalid stock' }) };
    }

    const supabaseUrl = process.env.SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!supabaseUrl || !serviceKey) {
      return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: 'Server not configured (SUPABASE envs missing)' }) };
    }
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const compareAt = body.compare_at_price == null ? null : Number(body.compare_at_price);

    // Validate status - only allow 'draft', 'active', 'published', or 'archived'
    const validStatuses = ['draft', 'active', 'published', 'archived'];
    const status = validStatuses.includes(body.status) ? body.status : 'active';

      // Product details arrays
      const rawVariants = Array.isArray(body.variants) ? body.variants : [];
      // Ensure at least one variant exists if price is set
      if (rawVariants.length === 0 && Number.isFinite(price)) {
         rawVariants.push({
          name: 'Default',
          price: price,
          price_cents: Math.round(price * 100),
          sku: body.sku || slug,
          inventory_quantity: stock,
          inventory_management: 'manual',
          option1: 'Default'
        });
      }

      let gallery = Array.isArray(body.gallery_urls) ? body.gallery_urls : [];
      if (gallery.length === 0 && body.thumbnail_url) {
        gallery = [body.thumbnail_url];
      }

    // Map to table schema using clean column names
    const row: any = {
      id: body.id ?? undefined,

      // Core fields
      name,
      slug,
      sku: body.sku ?? null,
      category: body.category ?? null,
      tags: Array.isArray(body.tags) ? body.tags : [],
      status: status,

      // Pricing - save BOTH price and price_cents columns for compatibility
      price: price,
      price_cents: Math.round(price * 100),
      compare_at_price: compareAt,
      compare_at_price_cents: compareAt == null ? null : Math.round(compareAt * 100),
      // sync stock fields
      out_of_stock: out_of_stock,
      stock: out_of_stock ? 0 : stock,
      stock_on_hand: out_of_stock ? 0 : stock,
      stock_qty: out_of_stock ? 0 : stock,
      inventory_quantity: out_of_stock ? 0 : stock,
      // descriptions
      short_description: body.short_description ?? null,
      overview: body.overview ?? null,

      // Images (use modern names)
      thumbnail_url: body.thumbnail_url ?? null,
      gallery_urls: gallery,
      hover_url: body.hover_url || body.hover_image || null,

      features: Array.isArray(body.features) ? body.features : [],
      how_to_use: Array.isArray(body.how_to_use) ? body.how_to_use : [],
      inci_ingredients: Array.isArray(body.inci_ingredients) ? body.inci_ingredients : [],
      key_ingredients: Array.isArray(body.key_ingredients) ? body.key_ingredients : [],
      claims: Array.isArray(body.claims) ? body.claims : [],
      variants: rawVariants,
      badges: Array.isArray(body.badges) ? body.badges : [],
      
      // Ensure images column is populated (legacy support)
      // images: gallery,

      // Details
      size: body.size ?? null,
      shelf_life: body.shelf_life ?? null,
      weight: body.weight ?? null,

      // Cost price for COGS calculation
      cost_price_cents: body.cost_price_cents ?? 0,

      // Meta - sync is_active with status for consistency
      meta_title: body.meta_title ?? null,
      meta_description: body.meta_description ?? null,
      is_active: status === 'active' || status === 'published',
      is_featured: body.is_featured ?? false,
      related: Array.isArray(body.related) ? body.related : [],

      // Timestamps
      updated_at: new Date().toISOString(),
    };

    // Upsert by id if provided, otherwise try to find by slug first
    let data, error;
    if (row.id) {
      // Update existing product by id
      const { data: updated, error: updateError } = await admin
        .from('products')
        .update(row)
        .eq('id', row.id)
        .select('*')
        .single();

      const updateMsg = String(updateError?.message || '');
      const tagsMissing = updateMsg.includes('column \"tags\"') || updateMsg.includes("'tags'") || updateMsg.toLowerCase().includes('schema cache');
      if (updateError && tagsMissing) {
        const retryRow = { ...row };
        delete retryRow.tags;
        const { data: retryUpdated, error: retryError } = await admin
          .from('products')
          .update(retryRow)
          .eq('id', row.id)
          .select('*')
          .single();
        data = retryUpdated;
        error = retryError;
      } else {
        data = updated;
        error = updateError;
      }
    } else {
      // Check if product with this slug exists
      const { data: existing } = await admin
        .from('products')
        .select('id')
        .eq('slug', row.slug)
        .maybeSingle();
      
      if (existing) {
        // Update existing by slug
        const { data: updated, error: updateError } = await admin
          .from('products')
          .update(row)
          .eq('id', existing.id)
          .select('*')
          .single();

        const updateMsg = String(updateError?.message || '');
        const tagsMissing = updateMsg.includes('column \"tags\"') || updateMsg.includes("'tags'") || updateMsg.toLowerCase().includes('schema cache');
        if (updateError && tagsMissing) {
          const retryRow = { ...row };
          delete retryRow.tags;
          const { data: retryUpdated, error: retryError } = await admin
            .from('products')
            .update(retryRow)
            .eq('id', existing.id)
            .select('*')
            .single();
          data = retryUpdated;
          error = retryError;
        } else {
          data = updated;
          error = updateError;
        }
      } else {
        // Insert new product
        delete row.id; // Remove undefined id
        const { data: inserted, error: insertError } = await admin
          .from('products')
          .insert(row)
          .select('*')
          .single();

        const insertMsg = String(insertError?.message || '');
        const tagsMissing = insertMsg.includes('column \"tags\"') || insertMsg.includes("'tags'") || insertMsg.toLowerCase().includes('schema cache');
        if (insertError && tagsMissing) {
          const retryRow = { ...row };
          delete retryRow.tags;
          const { data: retryInserted, error: retryError } = await admin
            .from('products')
            .insert(retryRow)
            .select('*')
            .single();
          data = retryInserted;
          error = retryError;
        } else {
          data = inserted;
          error = insertError;
        }
      }
    }

    if (error) {
      return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: `DB error: ${error.message}` }) };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, product: data })
    };
  } catch (e: any) {
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: e?.message || String(e) }) };
  }
};

export const handler = withAdminAuth(baseHandler);
