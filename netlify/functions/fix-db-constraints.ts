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

    console.log('Attempting to fix database constraints...');

    // We need to drop the existing constraint and add a new one that includes 'deleted'
    // Note: We can't easily "alter" a check constraint, we usually have to drop and add.
    
    // SQL to fix products table
    const sqlProducts = `
      ALTER TABLE products DROP CONSTRAINT IF EXISTS products_status_check;
      ALTER TABLE products ADD CONSTRAINT products_status_check 
      CHECK (status IN ('active', 'draft', 'archived', 'deleted', 'published'));
    `;

    // SQL to fix bundles table (just in case)
    const sqlBundles = `
      ALTER TABLE bundles DROP CONSTRAINT IF EXISTS bundles_status_check;
      ALTER TABLE bundles ADD CONSTRAINT bundles_status_check 
      CHECK (status IN ('active', 'draft', 'archived', 'deleted', 'published'));
    `;

    // Execute via RPC if available, or try to run raw SQL if enabled (unlikely for client, but maybe via pg function)
    // Since we don't have a direct SQL runner, we will try to use a postgres function if one exists for running SQL.
    // If not, we might be stuck unless we can use the Supabase SQL editor.
    // However, often 'rpc' is the way.
    
    // If we can't run DDL, we can't fix this via Netlify function unless there's a stored procedure exposing 'exec_sql'.
    // Assuming there isn't one, I will try to use the 'postgres' connection string if I had it, but I only have the API URL.
    
    // WORKAROUND:
    // If we can't change the constraint, we must use a status that IS allowed.
    // 'archived' is allowed. We can use 'archived' and maybe add a flag 'is_deleted'.
    // But the user specifically asked for "deleted" status in previous turns (or implied it).
    // The error `violates check constraint "products_status_check"` is definitive.
    
    // Let's try to see if there is an `exec_sql` function.
    const { data, error } = await supabase.rpc('exec_sql', { sql: sqlProducts + sqlBundles });
    
    if (error) {
      console.error('RPC exec_sql failed (might not exist):', error);
      
      // If RPC fails, we can't fix the constraint from here.
      // We should fall back to using 'archived' status for soft deletes in the delete-product.ts function
      // and update the code to filter out 'archived' items that are meant to be deleted.
      // OR, we instruct the user to run the SQL in their Supabase dashboard.
      
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          ok: false, 
          error: 'Could not update database constraints automatically. Please run this SQL in your Supabase SQL Editor:',
          sql: sqlProducts + sqlBundles
        })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, message: 'Database constraints updated successfully.' })
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
