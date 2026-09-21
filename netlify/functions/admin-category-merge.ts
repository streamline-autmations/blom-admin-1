import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { withAdminAuth } from "./_lib/with-admin-auth";

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*'
};

const baseHandler: Handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    const { sourceCategory, targetCategory } = JSON.parse(event.body || '{}');

    if (!sourceCategory || !targetCategory) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing source or target category' }) };
    }

    if (sourceCategory === targetCategory) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Source and target cannot be the same' }) };
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !serviceKey) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server config error' }) };
    }
    
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    console.log(`Merging category '${sourceCategory}' into '${targetCategory}'`);

    // Update Products
    const { data: products, error: prodError } = await supabase
      .from('products')
      .update({ category: targetCategory })
      .eq('category', sourceCategory)
      .select('id');

    if (prodError) throw prodError;

    // Update Bundles
    const { data: bundles, error: bundleError } = await supabase
      .from('bundles')
      .update({ category: targetCategory })
      .eq('category', sourceCategory)
      .select('id');

    if (bundleError) throw bundleError;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        ok: true, 
        message: `Merged ${products?.length || 0} products and ${bundles?.length || 0} bundles from "${sourceCategory}" to "${targetCategory}"`
      })
    };

  } catch (e: any) {
    console.error('Merge Error:', e);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ ok: false, error: e.message })
    };
  }
};

export const handler = withAdminAuth(baseHandler);
