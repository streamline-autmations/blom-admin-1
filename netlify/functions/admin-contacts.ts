import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { withAdminAuth } from "./_lib/with-admin-auth";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const baseHandler: Handler = async (event) => {
  try {
    // Fetch from the CORRECT 'contacts' table
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return {
      statusCode: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(data)
    };
  } catch (e: any) {
    console.error("Fetch Contacts Error:", e);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: e.message || "Failed to fetch contacts" }) 
    };
  }
};

export const handler = withAdminAuth(baseHandler);
