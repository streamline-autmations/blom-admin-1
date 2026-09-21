import { createClient } from "@supabase/supabase-js";
import { withAdminAuth } from "./_lib/with-admin-auth";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const baseHandler = async (event) => {
  try {
    const { productId, status } = JSON.parse(event.body || "{}");

    if (!productId || !status) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing required fields: productId, status" })
      };
    }

    // Validate status
    const validStatuses = ['draft', 'active', 'archived'];
    if (!validStatuses.includes(status)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid status. Must be draft, active, or archived" })
      };
    }

    // Update only the status field - bypass all validation
    const { data: updatedProduct, error: updateError } = await supabase
      .from('products')
      .update({ status: status })
      .eq('id', productId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating product status:", updateError);
      throw new Error("Failed to update product status");
    }

    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        success: true,
        product: updatedProduct,
        message: `Product status updated to ${status}`
      }),
    };
  } catch (e) {
    console.error("Update product status error:", e);
    return {
      statusCode: 500,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ error: e.message || "Server error" }),
    };
  }
};

export const handler = withAdminAuth(baseHandler);
