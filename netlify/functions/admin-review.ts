import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { withAdminAuth } from "./_lib/with-admin-auth";
const s = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type"
};

const baseHandler: Handler = async (e) => {
  if (e.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS };

  try {
    const id = e.queryStringParameters?.id || "";
    if (!id) return { statusCode: 400, headers: CORS, body: "Missing id" };

    // First get the review
    const { data: review, error } = await s
      .from("product_reviews")
      .select("*")
      .eq("id", id)
      .single();

    if (error) return { statusCode: 500, headers: CORS, body: error.message };
    if (!review) return { statusCode: 404, headers: CORS, body: "Review not found" };

    // Then get the product if product_id exists
    let product = null;
    if (review.product_id) {
      const { data: productData } = await s
        .from("products")
        .select("name, slug")
        .eq("id", review.product_id)
        .single();
      product = productData;
    }

    // Combine the data
    const result = {
      ...review,
      product,
      // Add legacy field mappings for backward compatibility
      author_name: review.name || review.reviewer_name,
      product_name: product?.name
    };

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ review: result }) };
  } catch (err:any) {
    return { statusCode: 500, headers: CORS, body: err.message || "admin-review failed" };
  }
};




export const handler = withAdminAuth(baseHandler);
