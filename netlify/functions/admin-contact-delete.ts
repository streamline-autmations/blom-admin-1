// netlify/functions/admin-contact-delete.ts
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { withAdminAuth } from "./_lib/with-admin-auth";

const s = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const baseHandler: Handler = async (event) => {
  try {
    // Only allow POST requests
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method not allowed" };
    }

    // Parse the request body
    const { contactId } = JSON.parse(event.body || "{}");

    if (!contactId) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ ok: false, error: "Missing contactId" }) 
      };
    }

    // Delete the contact from the database
    const { data, error } = await s
      .from("contacts")
      .delete()
      .eq("id", contactId)
      .select(); // Return the deleted record

    if (error) {
      console.error("Database error:", error);
      return { 
        statusCode: 500, 
        body: JSON.stringify({ ok: false, error: error.message }) 
      };
    }

    if (!data || data.length === 0) {
      return { 
        statusCode: 404, 
        body: JSON.stringify({ ok: false, error: "Contact not found" }) 
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        ok: true, 
        data: data[0],
        message: "Contact deleted successfully" 
      })
    };

  } catch (error) {
    console.error("Function error:", error);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ 
        ok: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }) 
    };
  }
};

export const handler = withAdminAuth(baseHandler);
