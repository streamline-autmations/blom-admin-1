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
    const { id, slug } = body;
    
    if (!id && !slug) {
      return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'Provide id or slug' }) };
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    const { error } = await supabase
      .from('bundles')
      .delete()
      .match(id ? { id } : { slug });
    
    if (error) {
       // If foreign key constraint error, soft delete instead
       if (error.message.includes('foreign key constraint') || error.code === '23503') {
        console.log(`Hard delete failed for bundle ${id || slug} due to FK constraints. Soft deleting instead.`);
        
        // Try 'deleted' status first
        let { data, error: softDeleteError } = await supabase
          .from('bundles')
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
          console.log(`'deleted' status failed for bundle ${id || slug}. Falling back to 'archived'.`);
          const { data: archivedData, error: archiveError } = await supabase
            .from('bundles')
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
            message: 'Bundle soft deleted successfully',
            bundle: data
          }),
        };
      }

      return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: `DB error: ${error.message}` }) };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, deleted: true, message: 'Bundle permanently deleted' }),
    };
  } catch (err: any) {
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: err?.message || 'Delete failed' }) };
  }
};

export const handler = withAdminAuth(baseHandler);
