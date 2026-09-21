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
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ ok: false, error: 'Method Not Allowed' })
      };
    }

    if (!event.body) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ ok: false, error: 'Empty body' })
      };
    }

    const body = JSON.parse(event.body);
    const { query, params } = body;

    if (!query) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ ok: false, error: 'Missing query parameter' })
      };
    }

    // Use service role key for admin operations
    const supabaseUrl = process.env.SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!;

    if (!supabaseUrl || !serviceKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          ok: false,
          error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
        })
      };
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false }
    });

    // Execute the raw SQL query
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: query,
      sql_params: params || []
    });

    if (error) {
      // If the RPC function doesn't exist, provide helpful error
      if (error.message.includes('exec_sql')) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({
            ok: false,
            error: 'SQL execution RPC function not set up. Use PostgREST queries instead.',
            hint: 'Query using the REST API format (table + filters) rather than raw SQL'
          })
        };
      }

      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ ok: false, error: error.message })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, data })
    };

  } catch (e: any) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ ok: false, error: e?.message || String(e) })
    };
  }
};

export const handler = withAdminAuth(baseHandler);
