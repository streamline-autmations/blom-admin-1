// Simple test function to debug order status updates
import { createClient } from "@supabase/supabase-js";
import { withAdminAuth } from "./_lib/with-admin-auth";

const baseHandler = async (e) => {
  if (e.httpMethod !== "POST") {
    return { 
      statusCode: 405, 
      headers: { "Content-Type": "application/json" }, 
      body: "Method Not Allowed" 
    };
  }

  try {
    console.log("🔧 Test function called");
    
    const body = JSON.parse(e.body || "{}");
    const { id, status } = body;
    
    console.log("🔧 Request data:", { id, status });
    console.log("🔧 Environment check:");
    console.log("🔧 SUPABASE_URL:", process.env.SUPABASE_URL ? "SET" : "MISSING");
    console.log("🔧 SUPABASE_SERVICE_ROLE_KEY:", process.env.SUPABASE_SERVICE_ROLE_KEY ? "SET" : "MISSING");

    if (!id || !status) {
      throw new Error("Missing id or status");
    }

    // Initialize Supabase client
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log("🔧 Supabase client created");

    // Test basic connection
    const { data: testData, error: testError } = await supabase
      .from("orders")
      .select("id, status")
      .eq("id", id)
      .single();

    console.log("🔧 Test query result:", { testData, testError });

    if (testError) {
      console.error("🔧 Test query failed:", testError);
      throw new Error(`Database connection failed: ${testError.message}`);
    }

    // Simple update test
    const now = new Date().toISOString();
    const patch = { 
      status, 
      updated_at: now 
    };

    console.log("🔧 Updating with patch:", patch);

    const { data: updated, error: updateErr } = await supabase
      .from("orders")
      .update(patch)
      .eq("id", id)
      .select("id, status, updated_at")
      .single();

    console.log("🔧 Update result:", { updated, updateErr });

    if (updateErr) {
      console.error("🔧 Update failed:", updateErr);
      throw updateErr;
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ 
        ok: true,
        debug: true,
        message: "Simple test update successful",
        result: { updated },
        before: testData,
        patch
      })
    };

  } catch (err) {
    console.error("🔧 Test function error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        ok: false,
        debug: true,
        error: err.message,
        stack: err.stack
      })
    };
  }
};

export const handler = withAdminAuth(baseHandler);
