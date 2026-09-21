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

    // Fetch distinct categories from products
    const { data: productCats, error: prodError } = await supabase
      .from('products')
      .select('category');
    
    if (prodError) throw prodError;

    // Fetch distinct categories from bundles
    const { data: bundleCats, error: bundleError } = await supabase
      .from('bundles')
      .select('category');

    if (bundleError) throw bundleError;

    // Aggregate counts
    const stats: Record<string, { products: number, bundles: number, total: number }> = {};

    const normalize = (cat: string | null) => cat ? cat.trim() : 'Uncategorized';

    productCats?.forEach((p) => {
      const cat = normalize(p.category);
      if (!stats[cat]) stats[cat] = { products: 0, bundles: 0, total: 0 };
      stats[cat].products++;
      stats[cat].total++;
    });

    bundleCats?.forEach((b) => {
      const cat = normalize(b.category);
      if (!stats[cat]) stats[cat] = { products: 0, bundles: 0, total: 0 };
      stats[cat].bundles++;
      stats[cat].total++;
    });

    // Convert to array and sort
    const sortedStats = Object.entries(stats)
      .map(([name, counts]) => ({ name, ...counts }))
      .sort((a, b) => b.total - a.total);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, stats: sortedStats })
    };

  } catch (e: any) {
    console.error('Error fetching category stats:', e);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ ok: false, error: e.message })
    };
  }
};

export const handler = withAdminAuth(baseHandler);
