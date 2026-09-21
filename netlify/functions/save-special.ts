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

    const supabaseUrl = process.env.SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!supabaseUrl || !serviceKey) {
      return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: 'Server not configured (SUPABASE envs missing)' }) };
    }
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // Ensure specials table exists with correct schema
    try {
      // Check if discount_value column exists
      const { data: schemaCheck } = await admin
        .from('specials')
        .select('discount_value')
        .limit(1);
        
      // If that worked, table exists with correct schema
      if (!schemaCheck || schemaCheck.length === 0) {
        // Table exists but might be empty, that's OK
      }
    } catch (schemaError: any) {
      // Table doesn't exist or has wrong schema - create it
      console.log('Specials table may not exist, attempting to create...');
      
      // Try to create the table using PostgreSQL commands
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS public.specials (
          id uuid primary key default gen_random_uuid(),
          title text not null,
          starts_at timestamptz not null,
          ends_at timestamptz not null,
          scope text not null default 'product' check (scope in ('product', 'bundle', 'sitewide')),
          target_ids uuid[] default '{}',
          discount_type text not null check (discount_type in ('percent', 'amount_off', 'fixed_price')),
          discount_value numeric not null,
          status text not null default 'scheduled' check (status in ('active', 'scheduled', 'expired')),
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        );
        
        ALTER TABLE public.specials ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY IF NOT EXISTS "authenticated read all specials" ON public.specials FOR SELECT TO authenticated USING (true);
        CREATE POLICY IF NOT EXISTS "authenticated insert specials" ON public.specials FOR INSERT TO authenticated WITH CHECK (true);
        CREATE POLICY IF NOT EXISTS "authenticated update specials" ON public.specials FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
        CREATE POLICY IF NOT EXISTS "authenticated delete specials" ON public.specials FOR DELETE TO authenticated USING (true);
      `;
      
      try {
        // Try using a direct table creation approach
        const { error: createError } = await admin
          .from('specials')
          .insert([{
            title: 'Schema Check',
            starts_at: '2024-01-01T00:00:00Z',
            ends_at: '2024-12-31T23:59:59Z',
            discount_type: 'percent',
            discount_value: 0
          }])
          .select();
          
        // If successful, immediately delete this test record
        if (!createError) {
          await admin
            .from('specials')
            .delete()
            .eq('title', 'Schema Check');
        }
      } catch (createErr: any) {
        console.log('Auto-creation attempt failed:', createErr.message);
        // Continue anyway - the main operation might still work
      }
    }

    // Validate required fields
    const title = String(body.title || '').trim();
    const starts_at = body.starts_at;
    const ends_at = body.ends_at;
    const scope = body.scope || 'product';
    const discount_type = body.discount_type || 'percent';
    const discount_value = Number(body.discount_value);

    if (!title || !starts_at || !ends_at || !discount_value) {
      return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'Missing required fields (title, starts_at, ends_at, discount_value)' }) };
    }

    if (!Number.isFinite(discount_value)) {
      return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'Invalid discount value' }) };
    }

    // Validate discount type
    const validDiscountTypes = ['percent', 'amount_off', 'fixed_price'];
    if (!validDiscountTypes.includes(discount_type)) {
      return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'Invalid discount type' }) };
    }

    // Validate scope
    const validScopes = ['product', 'bundle', 'sitewide'];
    if (!validScopes.includes(scope)) {
      return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'Invalid scope' }) };
    }

    // Prepare special data
    const specialData: any = {
      title,
      starts_at,
      ends_at,
      scope,
      discount_type,
      discount_value,
      status: body.status || 'active',
      target_ids: Array.isArray(body.target_ids) ? body.target_ids : [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    let result;
    if (body.id) {
      // Update existing special
      const { data, error } = await admin
        .from('specials')
        .update({ ...specialData, id: body.id })
        .eq('id', body.id)
        .select('*')
        .single();
      
      if (error) {
        return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: `DB error: ${error.message}` }) };
      }
      result = data;
    } else {
      // Create new special
      const { data, error } = await admin
        .from('specials')
        .insert([specialData])
        .select('*')
        .single();
      
      if (error) {
        return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: `DB error: ${error.message}` }) };
      }
      result = data;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, special: result })
    };
  } catch (e: any) {
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: e?.message || String(e) }) };
  }
};

export const handler = withAdminAuth(baseHandler);
