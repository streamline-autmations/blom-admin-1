import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { withAdminAuth } from "./_lib/with-admin-auth";

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*'
};

/**
 * Admin Database Operations Netlify Function
 * Uses SERVICE ROLE KEY for full admin access
 *
 * Supports:
 * - Schema modifications (ALTER TABLE, CREATE TABLE, etc.)
 * - RLS policy management
 * - Index creation
 * - Data operations (bypassing RLS)
 */
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
    const { operation, table, data, filters, sql } = body;

    // Get service role key
    const supabaseUrl = process.env.SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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

    // Create admin client with service role key (bypasses RLS)
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false }
    });

    let result;

    switch (operation) {
      case 'select':
        // Read data (bypassing RLS)
        const { data: selectData, error: selectError } = await admin
          .from(table)
          .select(data || '*');

        if (selectError) throw selectError;
        result = { data: selectData };
        break;

      case 'insert':
        // Insert data (bypassing RLS)
        const { data: insertData, error: insertError } = await admin
          .from(table)
          .insert(data)
          .select();

        if (insertError) throw insertError;
        result = { data: insertData };
        break;

      case 'update':
        // Update data (bypassing RLS)
        let updateQuery = admin.from(table).update(data);

        // Apply filters
        if (filters) {
          Object.entries(filters).forEach(([key, value]) => {
            updateQuery = updateQuery.eq(key, value);
          });
        }

        const { data: updateData, error: updateError } = await updateQuery.select();

        if (updateError) throw updateError;
        result = { data: updateData };
        break;

      case 'delete':
        // Delete data (bypassing RLS)
        let deleteQuery = admin.from(table).delete();

        // Apply filters
        if (filters) {
          Object.entries(filters).forEach(([key, value]) => {
            deleteQuery = deleteQuery.eq(key, value);
          });
        }

        const { data: deleteData, error: deleteError } = await deleteQuery.select();

        if (deleteError) throw deleteError;
        result = { data: deleteData };
        break;

      case 'update_order_status':
        // Special case for order status updates
        const { order_id, new_status, current_status } = body;
        if (!order_id || !new_status) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
              ok: false,
              error: 'Missing order_id or new_status for update_order_status operation'
            })
          };
        }

        const now = new Date().toISOString();
        const updatePatch: any = { 
          status: new_status, 
          updated_at: now 
        };

        // Set timestamps based on status
        if (new_status === 'paid') updatePatch.paid_at = now;
        if (new_status === 'packed') updatePatch.order_packed_at = now;
        if (new_status === 'out_for_delivery') updatePatch.order_out_for_delivery_at = now;
        if (new_status === 'collected') {
          updatePatch.order_collected_at = now;
          updatePatch.fulfilled_at = now;
        }
        if (new_status === 'delivered') {
          updatePatch.order_delivered_at = now;
          updatePatch.fulfilled_at = now;
        }

        const { data: statusUpdateData, error: statusUpdateError } = await admin
          .from('orders')
          .update(updatePatch)
          .eq('id', order_id)
          .select()
          .single();

        if (statusUpdateError) throw statusUpdateError;
        result = { data: statusUpdateData, success: true };
        break;

      case 'raw_sql':
        // Execute raw SQL (for schema modifications)
        // Note: This requires creating a custom RPC function in Supabase
        const { data: sqlData, error: sqlError } = await admin.rpc('exec_sql', {
          sql_query: sql
        });

        if (sqlError) {
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
              ok: false,
              error: sqlError.message,
              hint: 'Raw SQL execution requires a custom RPC function. See documentation for setup.'
            })
          };
        }

        result = { data: sqlData };
        break;

      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            ok: false,
            error: `Unknown operation: ${operation}`,
            hint: 'Supported operations: select, insert, update, delete, raw_sql'
          })
        };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        ...result
      })
    };

  } catch (e: any) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        ok: false,
        error: e?.message || String(e)
      })
    };
  }
};

export const handler = withAdminAuth(baseHandler);
