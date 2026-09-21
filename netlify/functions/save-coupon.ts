import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { withAdminAuth } from "./_lib/with-admin-auth";

// Helper to get Supabase admin client
const getSupabaseAdmin = () => {
  const supabaseUrl = process.env.SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false }
  });
};

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*' // Adjust for production
};

const baseHandler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ ok: false, error: 'Method Not Allowed' }) };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    console.log('Received payload:', body);

    // Basic validation
    if (!body.code || !body.type || body.value == null) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ ok: false, error: 'Missing required fields: code, type, value' })
      };
    }

    // Normalize and validate coupon type - strictly enforce database constraint values
    const normalizedType = String(body.type).toLowerCase().trim();
    
    // Map various inputs to valid database constraint values ('percent', 'fixed')
    let finalType;
    if (normalizedType === 'percentage' || normalizedType === 'percent' || normalizedType === '%') {
      finalType = 'percent';
    } else if (normalizedType === 'fixed' || normalizedType === 'amount' || normalizedType === 'rand' || normalizedType === 'r') {
      finalType = 'fixed';
    } else {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ ok: false, error: `Invalid coupon type: ${body.type}. Must be 'percent' (for %) or 'fixed' (for R)` })
      };
    }

    const supabase = getSupabaseAdmin();

    // Prepare data for Supabase, mapping to YOUR schema
    const couponData = {
      code: body.code.toUpperCase(),
      notes: body.description, // Map description -> notes
      is_active: body.is_active ?? true,

      type: finalType, // 'percent' or 'fixed'
      
      // FIX: Populate BOTH columns to prevent "0%" errors
      value: parseFloat(body.value), 
      percent: finalType === 'percent' ? parseFloat(body.value) : null,

      // Limitations (convert Rands from form to Cents for DB)
      min_order_cents: body.min_spend ? Math.round(parseFloat(body.min_spend) * 100) : 0,
      max_discount_cents: body.max_discount ? Math.round(parseFloat(body.max_discount) * 100) : null,

      // Usage
      max_uses: body.max_uses ? parseInt(body.max_uses) : 1,

      // Dates (valid_from defaults to now if not provided)
      valid_from: body.valid_from || new Date().toISOString(),
      valid_until: body.valid_until || null,

      // Product exclusions (array of UUIDs)
      excluded_product_ids: body.excluded_product_ids || [],
    };

    // Upsert logic: update if ID exists, insert if not
    let data, error;
    if (body.id) {
      // Update existing coupon
      const { data: updateData, error: updateError } = await supabase
        .from('coupons')
        .update(couponData)
        .eq('id', body.id)
        .select()
        .single();
      data = updateData;
      error = updateError;
    } else {
      // Create new coupon
      const { data: createData, error: createError } = await supabase
        .from('coupons')
        .insert(couponData)
        .select()
        .single();
      data = createData;
      error = createError;
    }

    if (error) {
      console.error('Supabase error:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ ok: false, error: error.message })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, coupon: data })
    };

  } catch (e: any) {
    console.error('Server error:', e);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ ok: false, error: e.message })
    };
  }
};

export const handler = withAdminAuth(baseHandler);
