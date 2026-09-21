// netlify/functions/admin-product.ts
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import { withAdminAuth } from "./_lib/with-admin-auth";

const s = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function fetchGithubProduct(slug: string) {
  const owner = process.env.GITHUB_REPO_OWNER!;
  const repo = process.env.GITHUB_REPO_NAME!;
  const branch = process.env.GITHUB_DEFAULT_BRANCH || "main";
  const token = process.env.GITHUB_TOKEN!;
  const path = `public/content/products/${slug}.json`;

  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${branch}`;
  const r = await fetch(url, {
    headers: { accept: "application/vnd.github+json", Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return null;
  const j = await r.json();
  const content = Buffer.from(j.content || "", "base64").toString("utf-8");
  try { return JSON.parse(content); } catch { return null; }
}

const baseHandler: Handler = async (e) => {
  try {
    const id = e.queryStringParameters?.id || "";
    const slugQ = e.queryStringParameters?.slug || "";
    if (!id && !slugQ) return { statusCode: 400, body: "Missing id or slug" };

    // 1) Supabase base row
    let q = s.from("products").select("*, prices:product_prices(price, created_at)").order("created_at", { ascending:false });
    const base = id ? await q.eq("id", id).single() : await q.eq("slug", slugQ).single();
    if (base.error) return { statusCode: 404, body: base.error.message };

    const p: any = base.data;
    const latestPrice = (p?.prices?.[0]?.price ?? p?.price) ?? 0;

    // 2) Ensure rich fields exist; if not, try GitHub JSON
    let rich: any = {
      title: p?.name || p?.title || "",
      name: p?.name || p?.title || "",
      slug: p?.slug || slugQ || "",
      price: Number(latestPrice),
      currency: p?.currency || "ZAR",
      thumbnail: p?.thumbnail || "",
      images: Array.isArray(p?.images) ? p.images : [],
      shortDescription: p?.short_description || p?.shortDescription || "",
      descriptionHtml: p?.description_html || p?.descriptionHtml || "",
      seo: p?.seo || {},
      sku: p?.sku || "",
      status: p?.active === false ? "draft" : "active",
      stock: p?.stock ?? 0,
      product_type: p?.product_type || "product",
      id: p?.id,
      created_at: p?.created_at,
      updated_at: p?.updated_at,
    };

    const needsGithub =
      !rich.descriptionHtml || (rich.images?.length ?? 0) === 0 || !rich.thumbnail;

    if (needsGithub && rich.slug) {
      const gh = await fetchGithubProduct(rich.slug);
      if (gh) {
        // merge, preferring Supabase scalar values where present
        rich = {
          ...gh,
          id: rich.id,
          price: Number(latestPrice || gh.price || 0),
          currency: rich.currency || gh.currency || "ZAR",
          stock: rich.stock ?? gh.stock ?? 0,
          status: rich.status || gh.status || "active",
          product_type: gh.product_type || rich.product_type || "product",
          thumbnail: rich.thumbnail || gh.thumbnail || "",
          images: (rich.images && rich.images.length ? rich.images : gh.images) || [],
          descriptionHtml: rich.descriptionHtml || gh.descriptionHtml || "",
          seo: rich.seo && Object.keys(rich.seo).length ? rich.seo : gh.seo || {},
        };
      }
    }

    return { statusCode: 200, body: JSON.stringify({ product: rich }) };
  } catch (err: any) {
    return { statusCode: 500, body: err.message || "admin-product failed" };
  }
};


export const handler = withAdminAuth(baseHandler);
