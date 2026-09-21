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
  'Access-Control-Allow-Origin': '*'
};

const baseHandler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ ok: false, error: 'Method Not Allowed' }) };
  }

  try {
    const supabase = getSupabaseAdmin();

    // Find all sign-up coupons (pattern: BLOM####-XXXXXX)
    const { data: coupons, error: fetchError } = await supabase
      .from('coupons')
      .select('id, code, type, value')
      .like('code', 'BLOM____-%');

    if (fetchError) {
      console.error('Error fetching coupons:', fetchError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ ok: false, error: fetchError.message })
      };
    }

    if (!coupons || coupons.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok: true, message: 'No sign-up coupons found', updated: 0 })
      };
    }

    // Fix coupons that should be 10% but aren't
    const couponsToFix = coupons.filter(c =>
      c.type !== 'percentage' || c.value !== 10
    );

    if (couponsToFix.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          ok: true,
          message: 'All sign-up coupons are already correctly set to 10%',
          total: coupons.length,
          updated: 0
        })
      };
    }

    // Update each coupon to be 10% percentage discount with single use
    const updatePromises = couponsToFix.map(coupon =>
      supabase
        .from('coupons')
        .update({ type: 'percentage', value: 10, max_uses: 1 })
        .eq('id', coupon.id)
    );

    const results = await Promise.all(updatePromises);
    const errors = results.filter(r => r.error);

    if (errors.length > 0) {
      console.error('Some updates failed:', errors);
      return {
        statusCode: 207,
        headers,
        body: JSON.stringify({
          ok: true,
          message: `Updated ${couponsToFix.length - errors.length} coupons, ${errors.length} failed`,
          total: coupons.length,
          updated: couponsToFix.length - errors.length,
          failed: errors.length
        })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        message: `Successfully updated ${couponsToFix.length} sign-up coupons to 10% discount (single use)`,
        total: coupons.length,
        updated: couponsToFix.length
      })
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
