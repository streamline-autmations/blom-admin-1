import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { withAdminAuth } from "./_lib/with-admin-auth";

const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

const baseHandler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ ok: false, error: 'Method not allowed' }) };
  }

  const SUPABASE_URL = process.env.SUPABASE_URL!;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: 'Missing Supabase service credentials' }) };
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const { id, slug, forceDelete = false } = body;
    
    if (!id && !slug) {
      return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'Provide id or slug' }) };
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    // Check if product has any order items
    const { data: orderItems, error: checkError } = await supabase
      .from('order_items')
      .select('id')
      .match(id ? { product_id: id } : { product_id: id })
      .limit(1);

    if (checkError) {
      console.error('Error checking order items:', checkError);
    }

    // Try to hard delete (will cascade delete order items if constraints allow)
    const { error } = await supabase
      .from('products')
      .delete()
      .match(id ? { id } : { slug });
    
    if (error) {
      // If foreign key constraint error, soft delete instead
      if (error.message.includes('foreign key constraint') || error.code === '23503') {
        console.log(`Hard delete failed for product ${id || slug} due to FK constraints. Soft deleting instead.`);
        
        // Try 'deleted' status first
        let { data, error: softDeleteError } = await supabase
          .from('products')
          .update({ 
            status: 'deleted', 
            is_active: false,
            updated_at: new Date().toISOString()
          })
          .match(id ? { id } : { slug })
          .select('*')
          .single();
        
        // If 'deleted' fails (e.g. due to constraint), try 'archived' as fallback
        if (softDeleteError && softDeleteError.message.includes('violates check constraint')) {
          console.log(`'deleted' status failed for product ${id || slug}. Falling back to 'archived'.`);
          const { data: archivedData, error: archiveError } = await supabase
            .from('products')
            .update({ 
              status: 'archived',
              name: `[DELETED] ${id || slug}`, // Mark it clearly
              is_active: false,
              updated_at: new Date().toISOString()
            })
            .match(id ? { id } : { slug })
            .select('*')
            .single();
          
          softDeleteError = archiveError;
          data = archivedData;
        }

        if (softDeleteError) {
          return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: `Soft delete failed: ${softDeleteError.message}` }) };
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ 
            ok: true, 
            deleted: true, // Pretend it was deleted to the client
            softDeleted: true,
            message: 'Product soft deleted successfully',
            product: data
          }),
        };
      }
      
      return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: `DB error: ${error.message}` }) };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        ok: true, 
        deleted: true,
        message: 'Product permanently deleted'
      }),
    };
  } catch (err: any) {
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: err?.message || 'Delete failed' }) };
  }
};

export const handler = withAdminAuth(baseHandler);
