import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { withAdminAuth } from "./_lib/with-admin-auth";

const getSupabaseAdmin = () => {
  const supabaseUrl = process.env.SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
};

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*'
};

const baseHandler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    // Expecting: { slot_number: 1, product_id: "...", custom_image_url: "..." }

    if (!body.slot_number) throw new Error('Missing slot number');

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('featured_items')
      .update({
        product_id: body.product_id || null, // null means "clear this slot"
        custom_image_url: body.custom_image_url || null,
        custom_title: body.custom_title || null,
        updated_at: new Date().toISOString()
      })
      .eq('slot_number', body.slot_number)
      .select();

    if (error) throw error;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, data })
    };

  } catch (e: any) {
    console.error('Save Featured Error:', e);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ ok: false, error: e.message })
    };
  }
};

export const handler = withAdminAuth(baseHandler);
